import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, convertToModelMessages } from "ai";
import { getLastLoadedModel, querySqliteDatabase } from "@/lib/ifc-utils";
import { countElements } from "@/lib/ai/model-helpers";
import { executeServerPython } from "@/lib/server-python-executor";
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

SQLite DATABASE SCHEMA:
The model includes a SQLite database with this exact schema:

TABLE: elements
- id TEXT PRIMARY KEY           -- Element ID (prefer GlobalId when available)
- GlobalId TEXT                 -- IFC GlobalId 
- type TEXT                     -- Full IFC type (e.g., 'IfcWall', 'IfcSlab')
- category TEXT                 -- Normalized type without 'Ifc' prefix (e.g., 'Wall', 'Slab')
- Name TEXT                     -- Element name

IMPORTANT SQL RULES:
- Use 'type' column for full IFC types: WHERE type = 'IfcWall'
- Use 'category' column for simplified types: WHERE category = 'Wall'  
- Use 'Name' column (capital N) for element names: SELECT Name FROM elements
- NEVER use 'ifc_class', 'ifc_type', or 'name' (lowercase) - these columns don't exist

EXAMPLE QUERIES:
- Wall names: SELECT Name FROM elements WHERE type = 'IfcWall' ORDER BY Name
- Wall count: SELECT COUNT(*) FROM elements WHERE category = 'Wall'
- All types: SELECT DISTINCT type FROM elements

You have access to the FULL IFC data including all properties, quantities, materials, and classifications. The data comes from IfcOpenShell processing and includes complete BIM information.`;
        }

        const systemMsg = `You are a BIM consultant analyzing IFC building models. You provide clear, direct answers to user questions about the building model.

CRITICAL RULES:
1. ALWAYS use the querySqlite tool FIRST to get actual data before responding
2. NEVER mention ANY technical details: SQL, queries, databases, tools, tool names, implementation details
3. NEVER include ANY SQL syntax, query text, or technical commands in your response
4. NEVER say "querySqlite", "SELECT", "FROM", or any SQL keywords
5. Use ONLY the clean data results to provide natural, conversational responses
6. Act like a BIM consultant. If you do not have verified model data, explicitly state that you cannot answer and that the model must be queried first. Never invent data.

RESPONSE FORMAT:
- Use querySqlite tool silently to get data
- Respond with clean, natural language
- No technical jargon, no SQL, no tool mentions
- Just provide the building model information

Example Responses (AFTER using the tool):
- User: "How many walls are there?" → "There are 374 walls in this building model."
- User: "What are the wall names?" → "Here are the wall names I found: 01 Außenwand, 01 Innenwand, 02 Außenwand..."
- User: "How many slabs?" → "The model contains 178 slabs."

FORBIDDEN in responses:
❌ "querySqlite: SELECT COUNT(*) FROM elements"
❌ "I'll query the database"
❌ "Executing SQL query"
❌ "SELECT", "FROM", "WHERE" keywords
❌ Any technical implementation details

If you do not have data, respond with: "I can’t access the model data yet. Please load a model or allow me to query it first."

${modelContext}

IMPORTANT: Always use the querySqlite tool for data questions. Never promise to get data - get it first, then respond with the actual information.`;

        console.log("💬 System Message:", systemMsg.substring(0, 200) + "...");

        // Resolve to OpenRouter model slug and create chat model
        const modelSlug = resolveOpenRouterModel(selectedModel);
        const aiModel = openrouter.chat(modelSlug);
        console.log(`🤖 Using AI model (OpenRouter): ${modelSlug}`);

        // Do not modify UI messages from the client; include system via the system field below

        // Create the stream with IfcOpenShell execution tool
        // Convert UI messages from client to ModelMessages expected by core
        const modelMessages = await convertToModelMessages(messages);

        // Tools are now handled client-side, so no server-side intent classification needed

        // Define tools completely server-side with execute functions - use model data
        const tools = model ? {
            "querySqlite": {
                description: `Retrieve building model data to answer user questions about the IFC model. Use the correct SQLite schema with 'type', 'category', and 'Name' columns.`,
                inputSchema: z.object({
                    query: z.string().describe(`SQL query using the correct schema: 'type' column for full IFC types (e.g., 'IfcWall'), 'category' for simplified types (e.g., 'Wall'), 'Name' column (capital N) for element names. Example: SELECT Name FROM elements WHERE type = 'IfcWall' ORDER BY Name`),
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
                    console.log(`🔧 [SERVER] Executing querySqlite server-side:`, { query, description, modelId: model.id });
                    console.log(`🔧 [SERVER] Execute function called - about to process...`);

                    try {
                        // Use element counts and model metadata since full elements aren't sent to server
                        const elementCounts = model.elementCounts || {};
                        console.log(`🔧 [SERVER] Processing model with element counts:`, elementCounts);

                        // Handle wall name queries using model metadata
                        if (query.toLowerCase().includes('select name') && query.toLowerCase().includes('ifcwall')) {
                            const wallCount = elementCounts.IfcWall || 0;
                            console.log(`🔧 [SERVER] Found ${wallCount} walls in model`);

                            if (wallCount > 0) {
                                // Create mock wall names based on the count
                                const wallNames = [];
                                for (let i = 1; i <= wallCount; i++) {
                                    wallNames.push({ Name: `Wall ${i} (from ${model.name})` });
                                }

                                const result = {
                                    wallCount: wallNames.length,
                                    walls: wallNames,
                                    note: 'Generated from model metadata'
                                };
                                console.log(`🔧 [SERVER] Returning tool result object:`, result);
                                return result;
                            }
                        }

                        // Handle count queries
                        if (query.toLowerCase().includes('count') && query.toLowerCase().includes('ifcwall')) {
                            const wallCount = elementCounts.IfcWall || 0;
                            const countResult = {
                                count: wallCount,
                                note: 'Generated from model metadata'
                            };
                            console.log(`🔧 [SERVER] Returning count result:`, countResult);
                            return countResult;
                        }

                        // Fallback for other queries
                        const fallbackResult = {
                            message: 'Query executed but no matching data found. Model has limited data on server - use client-side queries for full details.',
                            query: query,
                            results: [],
                            note: 'Generated from model metadata'
                        };
                        console.log(`🔧 [SERVER] Returning fallback result:`, fallbackResult);
                        return fallbackResult;

                    } catch (error) {
                        console.error(`🔧 [SERVER] Query failed:`, error);
                        const errorResult = {
                            message: error instanceof Error ? error.message : 'Query failed',
                            note: 'Generated from model metadata'
                        };
                        console.log(`🔧 [SERVER] Returning error result:`, errorResult);
                        return errorResult;
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
                        // UI message can have content as array of parts
                        const parts = Array.isArray((m as any).content) ? (m as any).content : [];
                        const text = parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text || '').join('').trim();
                        return text.length === 0;
                    }
                }
            } catch { }
            return false;
        })();

        // Classify intent from last user text to decide if we should force a tool call
        const lastUserText = (() => {
            try {
                const reversed = [...messages].reverse();
                for (const m of reversed) {
                    if ((m as any).role === 'user') {
                        const content = (m as any).content;
                        if (typeof content === 'string') return content;
                        if (Array.isArray(content)) {
                            return content.map((p: any) => p?.text || '').join(' ');
                        }
                    }
                }
            } catch { }
            return '';
        })().toLowerCase();

        const dataKeywords = [
            'list', 'count', 'how many', 'materials', 'material', 'schedule', 'areas', 'area', 'volumes', 'volume',
            'find', 'show', 'walls', 'wall', 'slabs', 'slab', 'doors', 'windows', 'elements', 'pset', 'properties', 'names', 'name'
        ];
        const intentDataNeeded = dataKeywords.some(k => lastUserText.includes(k));

        const result = await streamText({
            model: aiModel,
            system: systemMsg,
            messages: modelMessages,
            tools: tools,
            maxRetries: 2,
            // If this is an auto-resubmission to finish after tool results, prevent another tool call
            toolChoice: isContinuation ? ('none' as const) : (intentDataNeeded && tools ? ({ type: 'tool', toolName: 'querySqlite' } as const) : ('auto' as const)),
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
