import { getLastLoadedModel, querySqliteDatabase } from "@/lib/ifc-utils";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";
import { aiLogger } from "@/lib/logger";
import { getServerSQLiteManager } from "@/lib/server-sqlite";
import { validateAndSanitizeInput, validateModelSelection } from "@/lib/input-validator";
import { rateLimit, checkSuspiciousActivity } from "@/lib/rate-limiter";
import { validateTurnstileToken } from "@/lib/turnstile";
import { resolveModelSlug } from "@/lib/model-utils";

export async function POST(req: Request) {
    try {
        // Get client identifier for security checks
        const forwarded = req.headers.get('x-forwarded-for');
        const clientIp = forwarded ? forwarded.split(',')[0] :
            req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const clientId = `${clientIp}-${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;

        // Check for suspicious activity
        if (checkSuspiciousActivity(clientId)) {
            aiLogger.warn('Blocked suspicious activity', { clientId, ip: clientIp });
            return new Response(
                JSON.stringify({ error: 'Access temporarily restricted' }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': '900' // 15 minutes
                    }
                }
            );
        }

        // Parse and validate input - simplified for now
        const rawInput = await req.json();

        // Debug logging to see what we're receiving
        console.log('🔍 Raw input received:', {
            hasMessages: !!rawInput.messages,
            messageCount: rawInput.messages?.length || 0,
            firstMessage: rawInput.messages?.[0] ? {
                role: rawInput.messages[0].role,
                hasContent: !!rawInput.messages[0].content,
                hasParts: !!rawInput.messages[0].parts,
                contentLength: rawInput.messages[0].content?.length || 0,
                partsLength: rawInput.messages[0].parts?.length || 0
            } : null,
            hasModelData: !!rawInput.modelData,
            hasTurnstileToken: !!rawInput.turnstileToken,
            keys: Object.keys(rawInput)
        });

        // Basic validation - just check for required fields
        if (!rawInput.messages || !Array.isArray(rawInput.messages) || rawInput.messages.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Messages array is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // SECURITY: Validate and sanitize all input
        const validationResult = validateAndSanitizeInput(rawInput);
        if (!validationResult.isValid || validationResult.isDangerous) {
            aiLogger.warn('Input validation failed', {
                clientId,
                ip: clientIp,
                errors: validationResult.errors,
                isDangerous: validationResult.isDangerous,
                isSuspicious: validationResult.isSuspicious
            });
            return new Response(
                JSON.stringify({
                    error: 'Invalid input',
                    message: validationResult.isDangerous ?
                        'Request blocked for security reasons.' :
                        'Request contains invalid data.'
                }),
                { status: validationResult.isDangerous ? 403 : 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Log suspicious activity (but allow it through)
        if (validationResult.isSuspicious) {
            aiLogger.warn('Suspicious input detected but allowed', {
                clientId,
                ip: clientIp,
                warnings: validationResult.warnings
            });
        }

        // Parse input (already validated)
        const { messages = [], model: selectedModel, modelId, modelData, turnstileToken, sessionVerified } = rawInput;

        // Check if this is a verified session or needs initial verification
        let hasTurnstileToken = false;

        // If sessionVerified is true, this node has already been verified
        if (sessionVerified) {
            hasTurnstileToken = true;
            aiLogger.info('Using verified session', { clientId, ip: clientIp });
        }
        // Otherwise, validate the Turnstile token for first-time verification
        else if (turnstileToken) {
            try {
                const turnstileResult = await validateTurnstileToken(turnstileToken, clientIp);
                if (turnstileResult.success) {
                    hasTurnstileToken = true;
                    aiLogger.info('Turnstile initial verification successful', { clientId, ip: clientIp });
                } else {
                    aiLogger.warn('Turnstile verification failed', {
                        clientId,
                        ip: clientIp,
                        errors: turnstileResult['error-codes']
                    });
                    return new Response(
                        JSON.stringify({
                            error: 'Verification failed',
                            message: 'Please refresh the page and try again.',
                            details: turnstileResult['error-codes']
                        }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            } catch (error) {
                aiLogger.error('Turnstile validation error', {
                    clientId,
                    ip: clientIp,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                return new Response(
                    JSON.stringify({
                        error: 'Verification error',
                        message: 'Unable to verify your request. Please try again.'
                    }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }
        // No token and no session verification
        else {
            aiLogger.warn('Missing Turnstile token and not a verified session', { clientId, ip: clientIp });
            return new Response(
                JSON.stringify({
                    error: 'Verification required',
                    message: 'Please complete verification to access the AI chat.'
                }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }



        // SECURITY: Apply rate limiting based on verification status
        const rateLimitConfig = hasTurnstileToken ?
            { windowMs: 60 * 1000, maxRequests: 15 } : // Verified users get higher limits
            { windowMs: 60 * 1000, maxRequests: 5 };   // Unverified users get lower limits

        const rateLimitResult = await rateLimit(clientId, rateLimitConfig);

        if (!rateLimitResult.allowed) {
            aiLogger.warn('Rate limit exceeded', {
                clientId,
                ip: clientIp,
                remaining: rateLimitResult.remaining,
                resetTime: rateLimitResult.resetTime
            });

            return new Response(
                JSON.stringify({
                    error: 'Rate limit exceeded',
                    message: 'Too many requests. Please try again later.',
                    retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
                    resetTime: rateLimitResult.resetTime
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
                        'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
                        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
                    }
                }
            );
        }

        console.log('✅ Security checks passed:', {
            clientId: clientId.substring(0, 10) + '...',
            rateLimitRemaining: rateLimitResult.remaining,
            turnstileVerified: hasTurnstileToken,
            inputValidated: validationResult.isValid,
            suspicious: validationResult.isSuspicious,
            messageCount: messages.length
        });

        // Start conversation tracking
        const conversationStart = Date.now();
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Extract user prompt for logging
        const lastUserMessage = messages[messages.length - 1];
        const userPrompt = typeof lastUserMessage?.content === 'string'
            ? lastUserMessage.content
            : Array.isArray(lastUserMessage?.parts)
                ? lastUserMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
                : '';

        // Check if API key is available
        if (!process.env.OPENROUTER_API_KEY) {
            console.error("❌ OpenRouter API key not configured");
            return new Response(
                JSON.stringify({ error: "OpenRouter API key not configured" }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        // Initialize OpenRouter provider
        const openrouter = createOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY!,
        });

        // Use shared model utilities - no more duplication!

        // Validate model selection
        const requestedModel = selectedModel || modelId;
        if (requestedModel && !validateModelSelection(requestedModel)) {
            aiLogger.warn('Invalid model selection attempted', {
                clientId,
                requestedModel,
                ip: clientIp
            });
            return new Response(
                JSON.stringify({ error: 'Invalid model selection' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Use model data from client or fallback to server-side model
        const model = modelData || getLastLoadedModel();
        console.log("📊 IFC Model Context:", {
            source: modelData ? "client" : "server",
            hasModel: !!model,
            modelId: model?.id,
            modelName: model?.name,
            totalElements: model?.totalElements,
            elementCounts: model?.elementCounts,
            elementsCount: model?.elements?.length
        });

        let modelContext = "No IFC model is currently loaded. If you cannot access model data, do not guess. Ask the user to load a model or confirm the requested data cannot be retrieved.";
        if (model) {
            // Use the provided elementCounts - this contains ALL element types dynamically
            const elementCounts = model.elementCounts || {};

            // Dynamically generate element breakdown from ALL types in the model
            const elementBreakdown = Object.entries(elementCounts)
                .filter(([_, count]) => (count as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number)) // Sort by count descending
                .map(([type, count]) => `- ${type.replace('Ifc', '')}: ${count}`)
                .join('\n');

            // Extract sample elements with rich data (for system message only)
            const sampleElementsData = model.elements?.slice(0, 5) || [];

            // Log actual element count being sent
            console.log(`📊 Sending ${model.elements?.length || 0} elements to AI for processing`);

            // Get property sets from sample elements
            const propertySets = new Set<string>();
            const materials = new Set<string>();
            const classifications = new Set<string>();
            let hasQuantities = false;

            sampleElementsData.forEach((el: any) => {
                // Collect property set names
                if (el.psets) {
                    Object.keys(el.psets).forEach(psetName => propertySets.add(psetName));
                }

                // Check for quantities
                if (el.quantities) {
                    hasQuantities = true;
                }

                // Collect materials
                if (el.material) {
                    materials.add(typeof el.material === 'string' ? el.material : el.material.Name || 'Unknown');
                }

                // Collect classifications
                if (el.classification) {
                    classifications.add(el.classification);
                }
            });

            // Format sample elements with details
            const sampleElements = sampleElementsData.map((el: any) => {
                const details = [];
                if (el.properties?.Name) details.push(el.properties.Name);
                if (el.quantities?.Area) details.push(`Area: ${el.quantities.Area}m²`);
                if (el.quantities?.Volume) details.push(`Vol: ${el.quantities.Volume}m³`);
                return `${el.type}: ${details.join(', ') || el.id}`;
            }).join('\n  ');

            // Build context sections
            const propertyContext = propertySets.size > 0
                ? `\nProperty Sets found: ${Array.from(propertySets).slice(0, 10).join(', ')}${propertySets.size > 10 ? `, and ${propertySets.size - 10} more` : ''}`
                : '';

            const materialContext = materials.size > 0
                ? `\nMaterials detected: ${Array.from(materials).join(', ')}`
                : '';

            const quantityContext = hasQuantities
                ? '\nQuantity data: Available (areas, volumes, lengths, counts)'
                : '';

            modelContext = `Current IFC model: "${model.name || 'Unnamed'}" (${model.schema || 'Unknown schema'})
Total elements: ${model.totalElements || model.elements?.length || 0}

ELEMENT TYPES IN THIS MODEL:
${elementBreakdown}

SAMPLE ELEMENTS WITH DATA:
  ${sampleElements}
${propertyContext}${materialContext}${quantityContext}

AVAILABLE DATA:
- Element geometry and spatial relationships
- Property sets (Psets) with detailed attributes
- Quantities (areas, volumes, lengths, counts)
- Materials and material layers
- Classifications (Uniclass, OmniClass, etc.)
- Spatial structure (sites, buildings, storeys, spaces)
- Type information and element relationships

SQLite DATABASE SCHEMA (IfcOpenShell ifc2sql):
The model includes a SQLite database with the following structure:

INDIVIDUAL IFC ELEMENT TABLES:
- IfcWallStandardCase: ifc_id (PK), GlobalId, Name, Description, ObjectType, etc.
- IfcSlab: ifc_id (PK), GlobalId, Name, Description, ObjectType, etc.  
- IfcBeam: ifc_id (PK), GlobalId, Name, Description, ObjectType, etc.
- IfcColumn: ifc_id (PK), GlobalId, Name, Description, ObjectType, etc.
- And many other IFC element tables...

SUPPORTING TABLES:
- id_map: ifc_id (PK), ifc_class -- Maps entity IDs to IFC class names
- psets: ifc_id, pset_name, name, value -- Flattened property data
- metadata: preprocessor, schema, mvd -- Database metadata

OPTIMIZED QUERY PATTERNS:
- Element counts: SELECT COUNT(*) FROM IfcWallStandardCase (or IfcWall for some models)
- Element names: SELECT ifc_id, GlobalId, Name, ObjectType FROM IfcWallStandardCase
- Element properties: SELECT w.Name, p.pset_name, p.name, p.value FROM IfcWallStandardCase w JOIN psets p ON w.ifc_id = p.ifc_id
- All element types: SELECT ifc_class, COUNT(*) FROM id_map GROUP BY ifc_class ORDER BY COUNT(*) DESC
- Quantities: SELECT w.Name, p.value FROM IfcWallStandardCase w JOIN psets p ON w.ifc_id = p.ifc_id WHERE p.pset_name = 'BaseQuantities'
- Flexible wall query: Use IfcWallStandardCase for most models, IfcWall for simpler models

IMPORTANT RULES:
- Use specific IFC tables (IfcWallStandardCase, IfcSlab, etc.) for direct element access
- Join with psets table using ifc_id for properties and quantities
- Use id_map for cross-element-type queries
- GlobalId is the unique IFC identifier, Name is the human-readable name

You have access to the FULL IFC data including all properties, quantities, materials, and classifications. The data comes from IfcOpenShell processing and includes complete BIM information.`;
        }

        const systemMsg = `You are a BIM consultant analyzing IFC building models. You provide clear, direct answers to user questions about the building model.

CRITICAL RULES:
1. ALWAYS use the querySqlite tool FIRST for ANY question about the model - even simple ones
2. NEVER respond without querying the database first
3. NEVER mention ANY technical details: SQL, queries, databases, tools, tool names, implementation details
4. NEVER include ANY SQL syntax, query text, or technical commands in your response
5. NEVER say "querySqlite", "SELECT", "FROM", or any SQL keywords
6. Use ONLY the clean data results to provide natural, conversational responses

MANDATORY TOOL USAGE:
- For "How many walls?" → Use querySqlite to count walls
- For "What materials?" → Use querySqlite to get materials  
- For "Show properties" → Use querySqlite to get properties
- For "Total area?" → Use querySqlite to calculate areas
- For ANY model question → Use querySqlite FIRST

RESPONSE FORMAT:
- Use querySqlite tool silently to get data
- When tool returns results, USE THEM CONFIDENTLY
- Respond with clean, natural language only
- No technical jargon, no SQL, no tool mentions
- Just provide the building model information
- If tool gives you data, trust it and present it clearly

Example Responses (AFTER using the tool):
- User: "How many walls are there?" → "There are 114 walls in this building model."
- User: "What materials are used?" → "The walls use these materials: Limestone wall 100, Reinforced concrete wall - prefab 100, Concrete wall - 370."
- User: "total m2?" → "The total area is 1,250 m² across all elements."

FORBIDDEN in responses:
❌ "querySqlite: SELECT COUNT(*) FROM elements"
❌ "I'll query the database"
❌ "Executing SQL query"
❌ "SELECT", "FROM", "WHERE" keywords
❌ Any technical implementation details
❌ Responding without using the tool first
❌ "I'm sorry, it seems there was an issue" (when tool executed successfully)
❌ Apologizing when you have valid tool results

${modelContext}

IMPORTANT: Always use the querySqlite tool for data questions. Never promise to get data - get it first, then respond with the actual information.`;

        console.log("💬 System Message:", systemMsg.substring(0, 200) + "...");

        // Resolve to OpenRouter model slug and create chat model
        const modelSlug = resolveModelSlug(selectedModel);
        const aiModel = openrouter.chat(modelSlug);
        console.log(`🤖 Using AI model (OpenRouter): ${modelSlug}`);

        // Do not modify UI messages from the client; include system via the system field below

        // Create the stream with IfcOpenShell execution tool
        // Filter out incomplete tool calls before conversion (AI SDK v5 doesn't support incomplete tool inputs)
        const filteredMessages = messages.map((msg: any) => {
            if (msg.role === 'assistant' && msg.parts) {
                // Filter out incomplete tool calls (input-streaming state)
                const filteredParts = msg.parts.filter((part: any) => {
                    if (part.type && part.type.startsWith('tool-') && part.state === 'input-streaming') {
                        // Filtering incomplete tool call for AI SDK v5 compatibility
                        return false;
                    }
                    return true;
                });
                return { ...msg, parts: filteredParts };
            }
            return msg;
        });

        // Convert UI messages from client to ModelMessages expected by core
        const modelMessages = await convertToModelMessages(filteredMessages);

        // Tools are now handled client-side, so no server-side intent classification needed

        // Define tools completely server-side with execute functions - use model data
        const tools = model ? {
            "querySqlite": {
                description: `Retrieve building model data using the actual IfcOpenShell ifc2sql database schema. Use individual IFC tables and join with psets for properties.`,
                inputSchema: z.object({
                    query: z.string().describe(`SQL query using the actual schema: Individual IFC tables (IfcWallStandardCase or IfcWall, IfcSlab, IfcBeam, IfcColumn) with columns (ifc_id, GlobalId, Name, ObjectType). Join with psets table for properties. Examples: SELECT COUNT(*) FROM IfcWallStandardCase; SELECT Name FROM IfcWall ORDER BY Name; SELECT w.Name, p.value FROM IfcWallStandardCase w JOIN psets p ON w.ifc_id = p.ifc_id WHERE p.name = 'Height'. Use id_map to find available tables: SELECT DISTINCT ifc_class FROM id_map WHERE ifc_class LIKE '%Wall%'`),
                    description: z.string().describe('What information this query will retrieve')
                }),
                outputSchema: z.object({
                    message: z.string().optional().describe('Human readable message about the query result'),
                    count: z.number().optional().describe('Count of elements found'),
                    walls: z.array(z.object({
                        Name: z.string()
                    })).optional().describe('List of wall elements with names'),
                    results: z.array(z.any()).optional().describe('General query results'),
                    query: z.string().optional().describe('The original query that was executed'),
                    note: z.string().optional().describe('Additional notes about the result')
                }),
                execute: async ({ query, description }: { query: string; description: string }) => {
                    try {
                        // Get the server-side SQLite manager for real database access
                        const sqliteManager = await getServerSQLiteManager(model.id);

                        if (!sqliteManager) {
                            return {
                                type: 'error',
                                message: 'Could not connect to SQLite database',
                                description: description,
                                query: query,
                                error: 'Database connection failed'
                            };
                        }

                        // Execute the real SQL query against the actual database
                        const result = await sqliteManager.executeQuery(query, description);
                        return result;

                    } catch (error) {
                        return {
                            type: 'error',
                            message: error instanceof Error ? error.message : 'Query failed',
                            description: description,
                            query: query,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                }
            }
        } : undefined;

        // Track tool availability for semantic analysis
        const toolsAvailable = !!tools;
        const toolNames = tools ? Object.keys(tools) : [];

        // Detect continuation turn (client auto-resubmit after tool-result)
        const isContinuation = (() => {
            try {
                const reversed = [...messages].reverse();
                for (const m of reversed) {
                    if ((m as any).role === 'user') {
                        // Handle AI SDK v5 message format with parts array
                        const content = (m as any).content;
                        const parts = (m as any).parts;
                        let text = '';

                        if (typeof content === 'string') {
                            text = content.trim();
                        } else if (Array.isArray(content)) {
                            text = content.filter((p: any) => p?.type === 'text').map((p: any) => p.text || '').join('').trim();
                        } else if (Array.isArray(parts)) {
                            // AI SDK v5 format: message.parts array
                            text = parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text || '').join('').trim();
                        }

                        // Checking if this is a continuation message

                        return text.length === 0;
                    }
                }
            } catch (e) {
                // Error in continuation detection, defaulting to false
            }
            return false;
        })();

        // Classify intent from last user text to decide if we should force a tool call
        const lastUserText = (() => {
            try {
                const reversed = [...messages].reverse();
                for (const m of reversed) {
                    if ((m as any).role === 'user') {
                        // Handle AI SDK v5 message format with parts array
                        const content = (m as any).content;
                        const parts = (m as any).parts;
                        let text = '';

                        if (typeof content === 'string') {
                            text = content;
                        } else if (Array.isArray(content)) {
                            text = content.filter((p: any) => p?.type === 'text').map((p: any) => p.text || '').join(' ');
                        } else if (Array.isArray(parts)) {
                            // AI SDK v5 format: message.parts array
                            text = parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text || '').join(' ');
                        }

                        // Extracting user text for intent classification

                        return text;
                    }
                }
            } catch (e) {
                // Error in user text extraction, defaulting to empty
            }
            return '';
        })().toLowerCase();

        const dataKeywords = [
            'list', 'count', 'how many', 'materials', 'material', 'schedule', 'areas', 'area', 'volumes', 'volume',
            'find', 'show', 'walls', 'wall', 'slabs', 'slab', 'doors', 'windows', 'elements', 'pset', 'properties', 'names', 'name',
            'total', 'm2', 'm²', 'm3', 'm³', 'square', 'cubic', 'length', 'height', 'width', 'thickness', 'quantities', 'quantity'
        ];
        const intentDataNeeded = dataKeywords.some(k => lastUserText.includes(k));

        // For AI SDK v5, be more aggressive about tool calling
        const shouldForceQuery = tools && !isContinuation && (intentDataNeeded || messages.length <= 2);
        const finalToolChoice = shouldForceQuery ? 'forced querySqlite' : (isContinuation ? 'none' : 'auto');
        const matchedKeywords = dataKeywords.filter(k => lastUserText.includes(k));

        // Log semantic analysis
        if (!isContinuation && userPrompt) {
            aiLogger.logSemanticAnalysis({
                userIntent: userPrompt,
                detectedKeywords: matchedKeywords,
                toolChoice: finalToolChoice,
                queryGenerated: 'pending', // Will be updated after tool execution
                resultQuality: 'pending' as any,
                semanticAccuracy: matchedKeywords.length > 0 ? 0.8 : 0.5
            });
        }

        const result = await streamText({
            model: aiModel,
            system: systemMsg,
            messages: modelMessages,
            tools: tools,
            maxRetries: 2,
            // Force querySqlite for first few messages or when data is clearly needed
            toolChoice: shouldForceQuery ? ({ type: 'tool', toolName: 'querySqlite' } as const) :
                isContinuation ? ('none' as const) :
                    ('auto' as const),
            onFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
                console.log('🔧 [SERVER] Stream finished:', {
                    finishReason,
                    hasText: !!text,
                    textLength: text?.length || 0,
                    toolCallsCount: toolCalls?.length || 0,
                    toolResultsCount: toolResults?.length || 0
                });

                if (toolCalls && toolCalls.length > 0) {
                    console.log('🔧 [SERVER] Tool calls made:', toolCalls.map(tc => ({
                        toolName: tc.toolName,
                        toolCallId: tc.toolCallId
                    })));
                }

                if (toolResults && toolResults.length > 0) {
                    console.log('🔧 [SERVER] Tool results:', toolResults.map(tr => ({
                        toolCallId: tr.toolCallId,
                        result: tr,
                        keys: Object.keys(tr),
                        outputType: typeof tr.output,
                        outputValue: tr.output,
                        outputIsString: typeof tr.output === 'string'
                    })));
                }

                // Check if we have tool results but no text - this indicates the AI needs to continue
                if (toolResults && toolResults.length > 0 && (!text || text.trim() === '')) {
                    console.log('🔧 [SERVER] Tool executed but no response text - AI should continue automatically');
                }
            }
        });

        // Track conversation completion and return response
        return result.toUIMessageStreamResponse();
    } catch (error) {
        console.error("Chat API error:", error);
        return new Response(
            JSON.stringify({
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}
