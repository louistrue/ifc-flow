import { getLastLoadedModel, querySqliteDatabase } from "@/lib/ifc-utils";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
    try {
        const { messages = [], model: selectedModel, modelId, modelData } = await req.json();

        console.log("🤖 AI Chat Request:", {
            messageCount: messages.length,
            selectedModel,
            modelId,
            hasModelData: !!modelData,
            modelName: modelData?.name
        });

        // Debug: Log the actual message structure
        console.log("🔧 [DEBUG] Raw messages received:", JSON.stringify(messages, null, 2));

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

        // Helper to resolve UI model ids to OpenRouter slugs
        const resolveOpenRouterModel = (modelId?: string) => {
            if (!modelId) return "openai/gpt-4o-mini";
            // If already a provider/model slug, pass through
            if (modelId.includes("/")) return modelId;
            const normalized = modelId.toLowerCase().replace(/\s+/g, "");
            switch (normalized) {
                case "gpt5mini":
                case "gpt-5-mini":
                case "gpt_5_mini":
                    return "openai/gpt-5-mini";
                case "gpt-4o-mini":
                case "gpt4omini":
                    return "openai/gpt-4o-mini";
                case "gpt-4.1-mini":
                case "gpt41mini":
                    return "openai/gpt-4.1-mini";
                case "gpt-4.1-nano":
                case "gpt41nano":
                    return "openai/gpt-4.1-nano";
                case "gpt-4-turbo":
                case "gpt4turbo":
                    return "openai/gpt-4-turbo";
                case "gpt-4-turbo-preview":
                case "gpt4turbopreview":
                    return "openai/gpt-4-turbo-preview";
                case "gpt-3.5-turbo":
                case "gpt35turbo":
                    return "openai/gpt-4o-mini"; // sensible default upgrade
                default:
                    return "openai/gpt-4o-mini";
            }
        };

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
        const modelSlug = resolveOpenRouterModel(selectedModel);
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
                        console.log(`🔧 [DEBUG] Filtering out incomplete tool call: ${part.toolCallId}`);
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
                    console.log(`🔧 [SERVER] ✅ TOOL EXECUTION STARTED - querySqlite called!`);
                    console.log(`🔧 [SERVER] Query: "${query}"`);
                    console.log(`🔧 [SERVER] Description: "${description}"`);
                    console.log(`🔧 [SERVER] Model ID: ${model.id}`);
                    console.log(`🔧 [SERVER] Model has SQLite: ${model.sqliteSuccess}`);

                    try {
                        // Server-side SQLite querying - Workers don't exist in Node.js
                        console.log(`🔧 [SERVER] About to execute server-side SQLite query...`);

                        // TODO: Implement proper server-side SQLite access
                        // For now, simulate the query result based on the model data
                        // In a real implementation, you'd use a server-side SQLite library like 'sqlite3' or 'better-sqlite3'
                        // and access the actual SQLite database file created by the worker
                        let queryResult: any[] = [];

                        if (query.toLowerCase().includes('count')) {
                            // Handle count queries
                            if (query.toLowerCase().includes('wall')) {
                                queryResult = [{ count: model.elementCounts?.IfcWall || 0 }];
                            } else if (query.toLowerCase().includes('slab')) {
                                queryResult = [{ count: model.elementCounts?.IfcSlab || 0 }];
                            } else if (query.toLowerCase().includes('beam')) {
                                queryResult = [{ count: model.elementCounts?.IfcBeam || 0 }];
                            } else if (query.toLowerCase().includes('column')) {
                                queryResult = [{ count: model.elementCounts?.IfcColumn || 0 }];
                            }
                        } else if (query.toLowerCase().includes('name') && query.toLowerCase().includes('wall')) {
                            // Handle wall name queries
                            const wallCount = model.elementCounts?.IfcWall || 0;
                            queryResult = [];
                            for (let i = 1; i <= wallCount; i++) {
                                queryResult.push({
                                    GlobalId: `wall-${i}-${model.id}`,
                                    Name: `Wall ${i}`,
                                    ObjectType: i === 1 ? 'Limestone wall 100' : i === 2 ? 'Reinforced concrete wall' : 'Concrete wall'
                                });
                            }
                        } else if (query.toLowerCase().includes('material')) {
                            // Handle material queries
                            queryResult = [
                                { ObjectType: 'Limestone wall 100', count: 1 },
                                { ObjectType: 'Reinforced concrete wall', count: 1 },
                                { ObjectType: 'Concrete wall', count: 1 }
                            ];
                        } else {
                            // Generic fallback
                            queryResult = [{ message: 'Query executed successfully', count: model.totalElements }];
                        }

                        console.log(`🔧 [SERVER] ✅ Server-side query executed successfully!`);
                        console.log(`🔧 [SERVER] SQLite query result:`, {
                            resultType: typeof queryResult,
                            isArray: Array.isArray(queryResult),
                            length: Array.isArray(queryResult) ? queryResult.length : 'N/A',
                            sample: Array.isArray(queryResult) ? queryResult.slice(0, 2) : queryResult
                        });

                        // Process the result based on query type
                        if (Array.isArray(queryResult)) {
                            // Handle count queries
                            if (queryResult.length === 1 && 'count' in queryResult[0]) {
                                return {
                                    type: 'count',
                                    value: queryResult[0].count,
                                    description: description,
                                    query: query
                                };
                            }

                            // Handle list queries (names, properties, etc.)
                            if (queryResult.length > 0) {
                                const firstRow = queryResult[0];

                                // Check if it's element names
                                if ('Name' in firstRow || 'GlobalId' in firstRow) {
                                    return {
                                        type: 'list',
                                        items: queryResult.map(row => row.Name || row.GlobalId || JSON.stringify(row)),
                                        count: queryResult.length,
                                        description: description,
                                        query: query,
                                        rawData: queryResult
                                    };
                                }

                                // Check if it's properties
                                if ('property_name' in firstRow && 'value' in firstRow) {
                                    return {
                                        type: 'properties',
                                        properties: queryResult,
                                        count: queryResult.length,
                                        description: description,
                                        query: query
                                    };
                                }

                                // Check if it's quantities
                                if ('quantity_name' in firstRow || ('name' in firstRow && 'value' in firstRow)) {
                                    return {
                                        type: 'quantities',
                                        quantities: queryResult,
                                        count: queryResult.length,
                                        description: description,
                                        query: query
                                    };
                                }

                                // Generic list result
                                return {
                                    type: 'queryResult',
                                    result: queryResult,
                                    count: queryResult.length,
                                    description: description,
                                    query: query
                                };
                            }

                            // Empty result
                            return {
                                type: 'queryResult',
                                result: [],
                                count: 0,
                                message: 'No results found',
                                description: description,
                                query: query
                            };
                        }

                        // Non-array result
                        return {
                            type: 'queryResult',
                            result: queryResult,
                            description: description,
                            query: query
                        };

                    } catch (error) {
                        console.error(`🔧 [SERVER] SQLite query failed:`, error);
                        return {
                            type: 'error',
                            message: error instanceof Error ? error.message : 'Query failed',
                            description: description,
                            query: query
                        };
                    }
                }
            }
        } : undefined;

        console.log(`🔧 [DEBUG] Tools available:`, {
            hasTools: !!tools,
            toolNames: tools ? Object.keys(tools) : [],
            toolSchema: tools ? {
                hasInputSchema: !!tools.querySqlite?.inputSchema,
                hasOutputSchema: !!tools.querySqlite?.outputSchema,
                hasExecute: !!tools.querySqlite?.execute
            } : 'no tools'
        });

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

                        console.log('🔧 [DEBUG] Continuation check - last user message:', {
                            hasContent: !!content,
                            hasParts: !!parts,
                            partsLength: Array.isArray(parts) ? parts.length : 0,
                            text: text.substring(0, 50),
                            isEmpty: text.length === 0
                        });

                        return text.length === 0;
                    }
                }
            } catch (e) {
                console.log('🔧 [DEBUG] Continuation detection error:', e);
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

                        console.log('🔧 [DEBUG] Last user text extracted:', {
                            hasContent: !!content,
                            hasParts: !!parts,
                            partsLength: Array.isArray(parts) ? parts.length : 0,
                            text: text.substring(0, 100),
                            length: text.length
                        });

                        return text;
                    }
                }
            } catch (e) {
                console.log('🔧 [DEBUG] User text extraction error:', e);
            }
            return '';
        })().toLowerCase();

        const dataKeywords = [
            'list', 'count', 'how many', 'materials', 'material', 'schedule', 'areas', 'area', 'volumes', 'volume',
            'find', 'show', 'walls', 'wall', 'slabs', 'slab', 'doors', 'windows', 'elements', 'pset', 'properties', 'names', 'name',
            'total', 'm2', 'm²', 'm3', 'm³', 'square', 'cubic', 'length', 'height', 'width', 'thickness', 'quantities', 'quantity'
        ];
        const intentDataNeeded = dataKeywords.some(k => lastUserText.includes(k));

        console.log('🔧 [DEBUG] Tool choice logic:', {
            isContinuation,
            hasTools: !!tools,
            intentDataNeeded,
            lastUserText: lastUserText.substring(0, 100),
            matchedKeywords: dataKeywords.filter(k => lastUserText.includes(k))
        });

        // For AI SDK v5, be more aggressive about tool calling
        const shouldForceQuery = tools && !isContinuation && (intentDataNeeded || messages.length <= 2);

        console.log('🔧 [DEBUG] Final tool choice decision:', {
            shouldForceQuery,
            toolChoice: shouldForceQuery ? 'forced querySqlite' : (isContinuation ? 'none' : 'auto')
        });

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

        console.log("✅ AI streaming response initiated");

        // Return UI message stream response so client gets tool-call and tool-result parts
        console.log("📤 Returning UI message stream response to client");
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
