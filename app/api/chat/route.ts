import { getLastLoadedModel } from "@/lib/ifc-utils";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText, tool } from "ai";
import { z } from "zod";
import { aiLogger } from "@/lib/logger";
import { getServerSQLiteManager } from "@/lib/server-sqlite";
import { validateAndSanitizeInput, validateModelSelection } from "@/lib/input-validator";
import { rateLimit, checkSuspiciousActivity } from "@/lib/rate-limiter";
import { validateTurnstileToken } from "@/lib/turnstile";
import { resolveModelSlug } from "@/lib/model-utils";
import { createHmac } from "crypto";

export async function POST(req: Request) {
    try {
        // Get client identifier for security checks
        const forwarded = req.headers.get('x-forwarded-for');
        const clientIp = forwarded ? forwarded.split(',')[0] :
            req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const clientId = `${clientIp}-${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;

        // Secure cookie helpers for Turnstile verification (server-trusted)
        const COOKIE_NAME = 'ai_ts';
        const cookieHeader = req.headers.get('cookie') || '';
        const envCookieSecret = process.env.COOKIE_SECRET || process.env.NEXTAUTH_SECRET ||
            (process.env.NODE_ENV === 'development' ? 'dev-fallback-secret-key-for-turnstile-cookies' : '');
        const sign = (value: string) => {
            if (!envCookieSecret) return '';
            return createHmac('sha256', envCookieSecret).update(value).digest('hex');
        };
        const parseCookies = (cookieStr: string): Record<string, string> => {
            return cookieStr.split(';').map(v => v.trim()).filter(Boolean).reduce((acc, pair) => {
                const idx = pair.indexOf('=');
                if (idx === -1) return acc;
                const k = pair.slice(0, idx).trim();
                const v = pair.slice(idx + 1).trim();
                acc[k] = decodeURIComponent(v);
                return acc;
            }, {} as Record<string, string>);
        };
        const cookies = parseCookies(cookieHeader);
        const nowTs = Math.floor(Date.now() / 1000);
        const MAX_AGE = 60 * 60 * 24; // 24h
        const makeCookie = (payload: string) => {
            const signature = sign(payload);
            const cookieVal = encodeURIComponent(`${payload}.${signature}`);
            const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
            return `${COOKIE_NAME}=${cookieVal}; Path=/; HttpOnly; ${secureFlag}SameSite=Lax; Max-Age=${MAX_AGE}`;
        };
        const verifyCookie = (cookieValue?: string): boolean => {
            try {
                if (!cookieValue || !envCookieSecret) return false;
                const decoded = decodeURIComponent(cookieValue);
                const lastDot = decoded.lastIndexOf('.');
                if (lastDot <= 0) return false;
                const payload = decoded.substring(0, lastDot);
                const sig = decoded.substring(lastDot + 1);
                if (sign(payload) !== sig) return false;
                const parts = payload.split('|');
                if (parts.length < 3) return false;
                const version = parts[0];
                const ts = Number(parts[2]);
                if (version !== 'v1' || !Number.isFinite(ts)) return false;
                if (ts + MAX_AGE < nowTs) return false; // expired
                // Bind to client fingerprint
                const expectedFp = Buffer.from(clientId).toString('base64').slice(0, 24);
                return parts[1] === expectedFp;
            } catch {
                return false;
            }
        };
        let setVerificationCookie: string | null = null;

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

        // (verbose input debug logging removed)

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

        // Server-trusted cookie verification (ignore client-provided session flags)
        const cookieVerified = verifyCookie(cookies[COOKIE_NAME]);
        if (cookieVerified) {
            hasTurnstileToken = true;
            aiLogger.info('Using verified session (cookie)', { clientId, ip: clientIp });
        } else if (process.env.NODE_ENV === 'development') {
            // Debug cookie verification in development
            aiLogger.info('Cookie verification debug', {
                clientId,
                hasCookie: !!cookies[COOKIE_NAME],
                cookieValue: cookies[COOKIE_NAME] ? cookies[COOKIE_NAME].substring(0, 20) + '...' : 'none',
                hasSecret: !!envCookieSecret
            });
        }
        // Otherwise, validate the Turnstile token for first-time verification
        else if (turnstileToken) {
            try {
                const turnstileResult = await validateTurnstileToken(turnstileToken, clientIp);
                if (turnstileResult.success) {
                    hasTurnstileToken = true;
                    aiLogger.info('Turnstile initial verification successful', { clientId, ip: clientIp });

                    // Set signed, HttpOnly cookie to persist verification (24h)
                    const fp = Buffer.from(clientId).toString('base64').slice(0, 24);
                    const payload = `v1|${fp}|${nowTs}`;
                    setVerificationCookie = envCookieSecret ? makeCookie(payload) : null;
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
            { windowMs: 60 * 1000, maxRequests: 50 } : // Verified users get generous limits
            { windowMs: 60 * 1000, maxRequests: 20 };   // Unverified users get moderate limits

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

        // (verbose security-checks logging removed)

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
        // (verbose model context logging removed)

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

            // (verbose element count logging removed)

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
The model includes a comprehensive SQLite database with 64+ IFC tables.

CRITICAL: NEVER ASSUME SCHEMA - ALWAYS DISCOVER IT FIRST!

MANDATORY FIRST STEPS FOR ANY QUERY:
1. ALWAYS START by discovering available tables:
   SELECT name FROM sqlite_master WHERE type='table' ORDER BY name

2. ALWAYS explore table schemas before writing queries:
   PRAGMA table_info(IfcWall)
   PRAGMA table_info(IfcMaterial)

3. NEVER use assumed column names like 'id' - discover the actual columns first!

COMMON IfcOpenShell SCHEMA PATTERNS:
- Tables: IfcWall, IfcSlab, IfcBeam, IfcColumn, IfcMaterial, etc.
- Primary keys are often named differently (not always 'id')
- Relationships may use GlobalId, entity references, or other patterns
- ALWAYS check PRAGMA table_info(TableName) to see actual column names

SAFE DISCOVERY APPROACH:
1. List tables: SELECT name FROM sqlite_master WHERE type='table'
2. Check schema: PRAGMA table_info(IfcWall)  
3. Sample data: SELECT * FROM IfcWall LIMIT 3
4. Then write proper queries using discovered column names

NEVER ASSUME:
- Column names (don't assume 'id', 'Name', 'category', 'description', etc. exist)
- Relationship patterns
- Data types or formats
- Table structures
- Primary key names
- Foreign key relationships

COMMON COLUMN NAME ERRORS TO AVOID:
- 'category' (might be 'Category', 'Type', or not exist)
- 'id' (might be 'Id', 'ID', 'GlobalId', or other)
- 'name' (might be 'Name', 'ObjectName', or other)
- 'description' (might be 'Description', 'ObjectDescription', or other)

ALWAYS DISCOVER FIRST, THEN QUERY!
If you get "no such column" errors, you FAILED to discover the schema properly.

You have access to the FULL IFC data including all properties, quantities, materials, and classifications. The data comes from IfcOpenShell processing and includes complete BIM information.`;
        }

        const systemMsg = `You are a BIM consultant analyzing IFC building models. You provide clear, direct answers to user questions about the building model.

WORKFLOW (ENFORCED PROGRAMMATICALLY):
MANDATORY SEQUENCE - ALL STEPS REQUIRED:
1. FIRST: discoverSchema(action='list_tables') - discover all tables
2. SECOND: discoverSchema(action='table_info', tableName='RelevantTable') - get column names
3. THIRD: discoverSchema(action='sample_data', tableName='RelevantTable') - see sample data
4. ONLY THEN: querySqlite - retrieve the actual data
5. FINALLY: After querySqlite completes, you MUST provide a text response with the answer

CRITICAL: You MUST complete ALL THREE discoverSchema steps before querySqlite becomes available.
The tools will reject any attempt to skip steps - follow the exact sequence above.

IMPORTANT: After executing querySqlite and receiving results, ALWAYS generate a final text response that answers the user's question. Never end with just a tool call.

RESPONSE RULES:
- NEVER mention technical details: SQL, databases, tools, implementation
- NEVER include SQL syntax in your response
- Use ONLY the clean data results to provide natural, conversational answers
- Determine the relevant IFC table based on the user's question (IfcWall, IfcMaterial, IfcDoor, IfcSpace, IfcSlab, etc.)
- If no results are found, provide a polite, informative response (e.g., "There are no slabs in this model" or "No materials were found")
- After getting query results, ALWAYS provide a final answer in text form
- Respond with clean, natural language only
- No technical jargon, no SQL, no tool mentions
- Just provide the building model information
- If tool gives you data, trust it and present it clearly

ERROR HANDLING:
- If you get "no such column" errors, you MUST immediately run PRAGMA table_info(TableName) to discover the correct column names
- NEVER continue with assumed column names after getting schema errors
- Always fix schema discovery before attempting data queries again

Example Responses (AFTER using the tool):
- User: "How many walls are there?" → "There are ... walls in this building model."
- User: "What materials are used?" → "The walls use these materials: ... "
- User: "total m2?" → "The total area is ... m² across all elements."

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

        // (system prompt preview logging removed)

        // Resolve to OpenRouter model slug and create chat model
        const modelSlug = resolveModelSlug(selectedModel);
        const aiModel = openrouter.chat(modelSlug);
        // (model selection logging removed)

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

        // Decide client-query support on server (ignore any client-provided flags)
        // For security, prefer client-side execution markers to avoid server-side SQL
        const supportsClientQueries = true;

        // Create a stateful tool system using AI SDK v5 approach
        const createConditionalTools = () => {
            let schemaState = {
                tablesDiscovered: false,
                discoveredTables: [] as string[],
                columnsDiscovered: {} as Record<string, string[]>,
                sampleDataSeen: {} as Record<string, boolean>
            };

            const baseTools = {
                "discoverSchema": {
                    description: `Discover database schema - ALWAYS use this first before any data queries!`,
                    inputSchema: z.object({
                        action: z.enum(['list_tables', 'table_info', 'sample_data']).describe('Schema discovery action to perform'),
                        tableName: z.string().optional().describe('Table name for table_info or sample_data actions')
                    }),
                    outputSchema: z.object({
                        tables: z.array(z.string()).optional().describe('List of available tables'),
                        columns: z.array(z.object({
                            name: z.string(),
                            type: z.string(),
                            nullable: z.boolean().optional()
                        })).optional().describe('Table column information'),
                        sampleData: z.array(z.any()).optional().describe('Sample rows from table'),
                        schemaProgress: z.object({
                            tablesDiscovered: z.boolean(),
                            columnsDiscovered: z.record(z.array(z.string())),
                            querySqliteAvailable: z.boolean()
                        }).optional().describe('Current schema discovery progress')
                    }),
                    onInputStart: ({ toolCallId }: { toolCallId: string }) => { },
                    onInputAvailable: ({ input, toolCallId }: { input: any; toolCallId: string }) => { },
                    execute: async ({ action, tableName }: { action: 'list_tables' | 'table_info' | 'sample_data'; tableName?: string }) => {
                        let query = '';
                        let description = '';

                        switch (action) {
                            case 'list_tables':
                                query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
                                description = 'Discover all available tables in the database';
                                schemaState.tablesDiscovered = true;
                                break;
                            case 'table_info':
                                if (!tableName) throw new Error('tableName required for table_info action');
                                query = `PRAGMA table_info(${tableName})`;
                                description = `Discover column structure for table ${tableName}`;
                                // Mark this table's columns as discovered
                                schemaState.columnsDiscovered[tableName] = ['discovered']; // Will be updated by client
                                break;
                            case 'sample_data':
                                if (!tableName) throw new Error('tableName required for sample_data action');
                                query = `SELECT * FROM ${tableName} LIMIT 3`;
                                description = `Get sample data from table ${tableName}`;
                                schemaState.sampleDataSeen[tableName] = true;
                                break;
                        }

                        // If client supports queries, return a special marker for client execution
                        if (supportsClientQueries) {
                            const result = {
                                type: 'client_query',
                                query: query,
                                description: description,
                                message: 'Schema discovery query will be executed on client',
                                requiresClientExecution: true,
                                schemaAction: action,
                                tableName: tableName,
                                schemaProgress: {
                                    tablesDiscovered: schemaState.tablesDiscovered,
                                    columnsDiscovered: schemaState.columnsDiscovered,
                                    querySqliteAvailable: schemaState.tablesDiscovered && Object.keys(schemaState.columnsDiscovered).length > 0
                                }
                            };

                            // (schema discovery progress logging removed)

                            return result;
                        }

                        // Fallback to server-side execution (read-only enforcement exists in ServerSQLiteManager)
                        try {
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
                            // Expand IFC class variants for walls/beams to support older schemas
                            const lower = query.toLowerCase();
                            const isCount = lower.includes('count(');
                            const expandVariants = (base: string, vars: string[]) => {
                                const usedMatch = query.match(new RegExp(`\\b(${vars.join('|')})\\b`, 'i'));
                                const used = usedMatch ? usedMatch[1] : base;
                                return vars.map(v => query.replace(new RegExp(`\\b${used}\\b`, 'i'), v));
                            };
                            if (/\bifcwallstandardcase\b|\bifcwall\b/i.test(lower)) {
                                const qs = expandVariants('IfcWall', ['IfcWall', 'IfcWallStandardCase']);
                                if (isCount) {
                                    let total = 0;
                                    for (const q of qs) {
                                        try { const r: any = await sqliteManager.executeQuery(q, description); total += Number(r?.results?.[0]?.['COUNT(*)'] ?? r?.results?.[0]?.count ?? 0); } catch { }
                                    }
                                    return { type: 'queryResult', result: [{ count: total }], count: 1, description } as any;
                                } else {
                                    let rows: any[] = [];
                                    for (const q of qs) {
                                        try { const r: any = await sqliteManager.executeQuery(q, description); if (Array.isArray(r?.results)) rows = rows.concat(r.results); } catch { }
                                    }
                                    return { type: 'queryResult', result: rows, count: rows.length, description } as any;
                                }
                            }
                            if (/\bifcbeamstandardcase\b|\bifcbeam\b/i.test(lower)) {
                                const qs = expandVariants('IfcBeam', ['IfcBeam', 'IfcBeamStandardCase']);
                                if (isCount) {
                                    let total = 0;
                                    for (const q of qs) {
                                        try { const r: any = await sqliteManager.executeQuery(q, description); total += Number(r?.results?.[0]?.['COUNT(*)'] ?? r?.results?.[0]?.count ?? 0); } catch { }
                                    }
                                    return { type: 'queryResult', result: [{ count: total }], count: 1, description } as any;
                                } else {
                                    let rows: any[] = [];
                                    for (const q of qs) {
                                        try { const r: any = await sqliteManager.executeQuery(q, description); if (Array.isArray(r?.results)) rows = rows.concat(r.results); } catch { }
                                    }
                                    return { type: 'queryResult', result: rows, count: rows.length, description } as any;
                                }
                            }

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
            };

            // Return base tools initially (querySqlite not available yet)
            return baseTools;
        };

        // Define tools - start with only discoverSchema available
        const tools = model ? createConditionalTools() : undefined;

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

        const startTime = Date.now();

        // Schema discovery state tracking - use model-specific persistence
        const schemaSessionId = `${model?.id || 'default'}`;

        // Global state management for schema discovery
        const globalAny = global as any;
        if (!globalAny.schemaDiscoveryState) {
            globalAny.schemaDiscoveryState = new Map();
        }

        const getSchemaState = () => {
            const existingState = globalAny.schemaDiscoveryState.get(schemaSessionId);

            // Reset schema discovery for each new conversation/model
            // Check if this is a fresh start (no messages or only user message)
            const isNewConversation = !messages || messages.length <= 1;

            // Also reset if the last activity was more than 5 minutes ago (new session)
            const isStaleSession = existingState && (Date.now() - existingState.lastActivity) > (5 * 60 * 1000);

            if ((isNewConversation || isStaleSession) && existingState && existingState.stepCount > 0) {
                // (schema discovery state reset logging removed)
                globalAny.schemaDiscoveryState.delete(schemaSessionId);
            }

            return globalAny.schemaDiscoveryState.get(schemaSessionId) || {
                schemaDiscoveryComplete: false,
                discoveredTables: [],
                discoveredColumns: {},
                lastActivity: Date.now(),
                stepCount: 0,
                sampleDataExecuted: false
            };
        };

        const updateSchemaState = (updates: any) => {
            const currentState = getSchemaState();
            const newState = { ...currentState, ...updates, lastActivity: Date.now() };
            globalAny.schemaDiscoveryState.set(schemaSessionId, newState);
            return newState;
        };

        // Clean up old sessions (older than 1 hour)
        const cleanupOldSessions = () => {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            for (const [key, state] of globalAny.schemaDiscoveryState.entries()) {
                if (state.lastActivity < oneHourAgo) {
                    globalAny.schemaDiscoveryState.delete(key);
                }
            }
        };
        cleanupOldSessions();

        const schemaState = getSchemaState();

        // Manual reset mechanism - if user sends "reset schema" or similar
        const currentUserMessage = messages?.[messages.length - 1];
        const userContent = currentUserMessage?.content || '';
        if (userContent.toLowerCase().includes('reset') && schemaState.stepCount > 0) {
            // (manual schema reset logging removed)
            globalAny.schemaDiscoveryState.delete(schemaSessionId);
            // Get fresh state after reset
            const freshState = getSchemaState();
        }

        // Create dynamic tools with proper AI SDK v5 approach
        const createAllTools = () => {
            return {
                discoverSchema: {
                    description: 'Discover database schema - ALWAYS use this first before any data queries!',
                    inputSchema: z.object({
                        action: z.enum(['list_tables', 'table_info', 'sample_data']).describe('Schema discovery action to perform'),
                        tableName: z.string().optional().describe('Table name for table_info or sample_data actions')
                    }),
                    execute: async ({ action, tableName }: { action: 'list_tables' | 'table_info' | 'sample_data'; tableName?: string }) => {
                        const currentState = getSchemaState();

                        // Increment step count to prevent infinite loops
                        updateSchemaState({ stepCount: currentState.stepCount + 1 });

                        // Prevent infinite loops - auto-reset if too many attempts
                        if (currentState.stepCount > 10) {
                            // (auto-resetting schema state due to too many attempts)
                            globalAny.schemaDiscoveryState.delete(schemaSessionId);
                            // Get fresh state after reset
                            const freshState = getSchemaState();
                            // Continue with fresh state
                            updateSchemaState({ stepCount: freshState.stepCount + 1 });
                        }

                        // ENFORCE SEQUENTIAL EXECUTION - Reject invalid steps
                        // (schema validation logging removed)

                        // If schema is already complete, skip validation for new queries
                        if (currentState.schemaDiscoveryComplete) {
                            // (schema already complete)
                            // Reset for new query but keep schema complete flag
                            if (action === 'list_tables') {
                                updateSchemaState({
                                    stepCount: currentState.stepCount + 1,
                                    lastQuery: Date.now()
                                });
                            }
                        } else {
                            // Only enforce strict ordering when schema is not complete
                            if (action === 'table_info' && !currentState.tablesDiscovered) {
                                throw new Error('Must discover tables first using action="list_tables"');
                            }
                            if (action === 'sample_data' && Object.keys(currentState.discoveredColumns).length === 0) {
                                throw new Error('Must discover table columns first using action="table_info"');
                            }
                            if (action === 'list_tables' && currentState.tablesDiscovered) {
                                // (blocking duplicate list_tables call)
                                throw new Error('Tables already discovered. Use action="table_info" next');
                            }
                        }

                        // Update state IMMEDIATELY after validation passes
                        if (action === 'list_tables') {
                            // (updating state: tablesDiscovered)
                            updateSchemaState({
                                discoveredTables: ['IfcWall', 'IfcMaterial', 'IfcDoor', 'IfcWindow'], // Common IFC tables
                                tablesDiscovered: true
                            });
                        } else if (action === 'table_info') {
                            // (updating state: columns discovered)
                            const currentStateForColumns = getSchemaState();
                            const newColumns = { ...currentStateForColumns.discoveredColumns };
                            newColumns[tableName!] = ['id', 'Name', 'GlobalId', 'ObjectType', 'Tag']; // Common IFC columns
                            updateSchemaState({ discoveredColumns: newColumns });
                        }

                        let query = '';
                        let description = '';

                        switch (action) {
                            case 'list_tables':
                                query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
                                description = 'Discover all available tables in the database';
                                break;
                            case 'table_info':
                                if (!tableName) throw new Error('tableName required for table_info action');
                                query = `PRAGMA table_info(${tableName})`;
                                description = `Discover column structure for table ${tableName}`;
                                break;
                            case 'sample_data':
                                if (!tableName) throw new Error('tableName required for sample_data action');
                                query = `SELECT * FROM ${tableName} LIMIT 3`;
                                description = `Get sample data from table ${tableName}`;
                                break;
                        }

                        // Get current state and check if schema discovery is complete
                        const currentSchemaState = getSchemaState();

                        // Schema is only complete after ALL THREE steps: list_tables + table_info + sample_data
                        const hasTablesDiscovered = currentSchemaState.discoveredTables.length > 0;
                        const hasColumnsDiscovered = Object.keys(currentSchemaState.discoveredColumns).length > 0;
                        const hasSampleDataSeen = action === 'sample_data'; // This is the final step

                        // Track if sample_data has been executed for any table
                        if (action === 'sample_data') {
                            updateSchemaState({ sampleDataExecuted: true });
                        }

                        const isComplete = hasTablesDiscovered && hasColumnsDiscovered && (hasSampleDataSeen || currentSchemaState.sampleDataExecuted);

                        if (isComplete && !currentSchemaState.schemaDiscoveryComplete) {
                            updateSchemaState({ schemaDiscoveryComplete: true });
                        }

                        // If client supports queries, return a special marker for client execution
                        if (supportsClientQueries) {
                            return {
                                type: 'client_query',
                                query: query,
                                description: description,
                                message: 'Schema discovery query will be executed on client',
                                requiresClientExecution: true,
                                schemaAction: action,
                                tableName: tableName,
                                schemaProgress: {
                                    tablesDiscovered: currentSchemaState.discoveredTables.length > 0,
                                    columnsDiscovered: currentSchemaState.discoveredColumns,
                                    querySqliteNowAvailable: isComplete && currentSchemaState.schemaDiscoveryComplete
                                }
                            };
                        }

                        // Fallback to server-side execution
                        try {
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
                },
                querySqlite: {
                    description: 'Query the IfcOpenShell SQLite database using discovered schema',
                    inputSchema: z.object({
                        query: z.string().describe('SQL query using ONLY the column names you discovered via discoverSchema'),
                        description: z.string().describe('What information this query will retrieve')
                    }),
                    execute: async ({ query, description }: { query: string; description: string }) => {
                        const currentState = getSchemaState();

                        // ENFORCE SCHEMA DISCOVERY COMPLETION
                        if (!currentState.schemaDiscoveryComplete && !currentState.sampleDataExecuted) {
                            // Blocking querySqlite - schema discovery incomplete
                            throw new Error('Schema discovery must be completed first. Use discoverSchema with all three actions: list_tables, table_info, and sample_data');
                        }

                        // If client supports queries, return a special marker for client execution
                        if (supportsClientQueries) {
                            return {
                                type: 'client_query',
                                query: query,
                                description: description,
                                message: 'Query will be executed on client',
                                requiresClientExecution: true,
                                discoveredSchema: {
                                    tables: currentState.discoveredTables,
                                    columns: currentState.discoveredColumns
                                }
                            };
                        }

                        // Fallback to server-side execution
                        try {
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
            };
        };

        // Use proper streamText with AI SDK v5 approach - force multi-step execution
        const result = streamText({
            model: aiModel,
            system: systemMsg,
            messages: modelMessages,
            tools: createAllTools(),
            toolChoice: 'auto', // Changed from 'required' to allow final text response
            onFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
                const finishTime = Date.now();
                const responseTime = finishTime - startTime;

                // (stream finished)

                // Log tool calls with detailed information
                if (toolCalls && toolCalls.length > 0) {
                    // (tool calls debug logging removed)

                    // Log each tool call individually
                    for (const toolCall of toolCalls) {
                        // Try different possible property names for arguments
                        const args = (toolCall as any).args ||
                            (toolCall as any).arguments ||
                            (toolCall as any).input ||
                            (toolCall as any).parameters;

                        // (tool call args debug logging removed)

                        aiLogger.logToolExecution({
                            toolName: toolCall.toolName,
                            query: args?.query || 'N/A',
                            description: args?.description || 'N/A',
                            result: 'pending', // Will be updated when results come in
                            executionTime: 0, // Will be calculated when results come in
                            success: true,
                            clientId,
                            ip: clientIp,
                            toolCallId: toolCall.toolCallId,
                            args: args
                        });
                    }
                }

                // Log tool results with detailed information
                if (toolResults && toolResults.length > 0) {
                    // (tool results debug logging removed)

                    // Log each tool result individually
                    for (const toolResult of toolResults) {
                        const correspondingCall = toolCalls?.find(tc => tc.toolCallId === toolResult.toolCallId);

                        // Try different possible property names for arguments
                        const args = (correspondingCall as any)?.args ||
                            (correspondingCall as any)?.arguments ||
                            (correspondingCall as any)?.input ||
                            (correspondingCall as any)?.parameters;

                        // Try different possible property names for results
                        const result = (toolResult as any).result ||
                            (toolResult as any).output ||
                            (toolResult as any).value ||
                            toolResult;

                        const isError = (toolResult as any).isError ||
                            (toolResult as any).error ||
                            false;

                        // (tool result extraction debug logging removed)

                        aiLogger.logToolExecution({
                            toolName: correspondingCall?.toolName || 'unknown',
                            query: args?.query || 'N/A',
                            description: args?.description || 'N/A',
                            result: result,
                            executionTime: responseTime, // Approximate
                            success: !isError,
                            error: isError ? String(result) : undefined,
                            clientId,
                            ip: clientIp,
                            toolCallId: toolResult.toolCallId,
                            output: result,
                            outputType: typeof result
                        });

                        // Special logging for SQL queries
                        if (correspondingCall?.toolName === 'querySqlite' && args?.query) {
                            aiLogger.info('SQL_QUERY_EXECUTED', {
                                type: 'sql_execution',
                                clientId,
                                ip: clientIp,
                                query: args.query,
                                description: args.description,
                                result: result,
                                success: !isError,
                                error: isError ? String(result) : undefined,
                                executionTime: responseTime,
                                resultCount: Array.isArray(result?.results) ? result.results.length : 0,
                                resultType: typeof result
                            });
                        }
                    }
                }

                // Log the complete conversation turn
                // Find the last user message (not assistant message)
                const lastUserMessage = messages.slice().reverse().find((msg: any) => msg.role === 'user');

                // Extract user prompt from various possible formats
                let userPrompt = 'Unknown';
                if (lastUserMessage) {
                    // Check for parts array (AI SDK v5 format)
                    if ((lastUserMessage as any).parts && Array.isArray((lastUserMessage as any).parts)) {
                        const parts = (lastUserMessage as any).parts;
                        const textPart = parts.find((p: any) => p.type === 'text');
                        userPrompt = textPart?.text || 'Continuation';
                    } else if (typeof lastUserMessage.content === 'string') {
                        userPrompt = lastUserMessage.content || 'Continuation';
                    } else if (Array.isArray(lastUserMessage.content)) {
                        // Handle array format - look for text content
                        const textContent = lastUserMessage.content.find((c: any) =>
                            c.type === 'text' || (c.type === undefined && c.text)
                        );
                        userPrompt = textContent?.text || textContent?.content ||
                            lastUserMessage.content[0]?.text ||
                            lastUserMessage.content[0]?.content ||
                            'Continuation';
                    } else if (typeof lastUserMessage.content === 'object') {
                        // Handle object format
                        userPrompt = lastUserMessage.content?.text ||
                            lastUserMessage.content?.content ||
                            'Continuation';
                    }
                }

                // If it's an empty message, it's likely a continuation
                if (!userPrompt || userPrompt.trim() === '') {
                    userPrompt = 'Continuation';
                }

                // (user prompt extraction debug logging removed)

                aiLogger.logConversationTurn({
                    sessionId: clientId,
                    clientId,
                    ip: clientIp,
                    modelName: selectedModel || 'unknown',
                    userPrompt,
                    toolCalls: toolCalls?.map(tc => {
                        const args = (tc as any).args;
                        return {
                            toolName: tc.toolName,
                            query: args?.query || 'N/A',
                            description: args?.description || 'N/A',
                            result: (toolResults?.find(tr => tr.toolCallId === tc.toolCallId) as any)?.result || 'pending'
                        };
                    }) || [],
                    aiResponse: text || '',
                    responseTime,
                    success: finishReason === 'stop',
                    error: finishReason === 'error' ? 'Stream finished with error' : undefined,
                    finishReason,
                    usage: usage ? {
                        promptTokens: (usage as any).promptTokens || 0,
                        completionTokens: (usage as any).completionTokens || 0,
                        totalTokens: usage.totalTokens || 0
                    } : undefined,
                    toolCallsCount: toolCalls?.length || 0,
                    toolResultsCount: toolResults?.length || 0,
                    textLength: text?.length || 0
                });

                // With maxSteps enabled, the AI will automatically continue after tool execution
                // No need to warn about incomplete responses - this is expected behavior
                // (continuation notice removed)
            }
        });

        // Track conversation completion and return response
        // AI SDK v5: Return the stream response, appending verification cookie if applicable
        // The messages are already in correct chronological order
        const resp = result.toUIMessageStreamResponse();
        if (setVerificationCookie) {
            try {
                resp.headers.append('Set-Cookie', setVerificationCookie);
            } catch { }
        }
        return resp;
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
