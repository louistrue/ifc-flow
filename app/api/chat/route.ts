import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { getLastLoadedModel } from "@/lib/ifc-utils";
import { countElements } from "@/lib/ai/model-helpers";
import { executeServerPython } from "@/lib/server-python-executor";
import { z } from "zod";

export async function POST(req: Request) {
    try {
        const { messages = [], modelId, modelData } = await req.json();

        console.log("🤖 AI Chat Request:", {
            messageCount: messages.length,
            lastMessage: messages[messages.length - 1]?.content?.substring(0, 100) + "...",
            modelId,
            hasModelData: !!modelData,
            modelName: modelData?.name
        });

        // Check if API key is available
        if (!process.env.OPENAI_API_KEY) {
            console.error("❌ OpenAI API key not configured");
            return new Response(
                JSON.stringify({ error: "OpenAI API key not configured" }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                }
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

        let modelContext = "No IFC model is currently loaded.";
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

You have access to the FULL IFC data including all properties, quantities, materials, and classifications. The data comes from IfcOpenShell processing and includes complete BIM information.

For complex queries requiring:
- Detailed quantity takeoffs
- Material schedules
- Property extraction
- Spatial analysis
- Classification queries

Recommend using workflow nodes like Python nodes with IfcOpenShell for precise calculations, or specific analysis nodes for structured data extraction.`;
        }

        const systemMsg = `You are an AI assistant with FULL ACCESS to IFC (Industry Foundation Classes) building information modeling data through IfcOpenShell processing.

CRITICAL RESPONSE RULES:
1. ALWAYS provide clear, formatted text responses that the user can see
2. When you use the executeIfcOpenShell tool, ALWAYS show the actual results in your response
3. NEVER give empty responses - if a tool runs, show its output
4. Tool calls alone are NOT visible to users - you MUST describe the results in text
5. After calling a tool, ALWAYS write a text response describing what you found

RESPONSE PATTERN: When using tools, follow this pattern:
- Call the tool to get data
- THEN write a text response like "There are 171 walls in the model" or "I found the following wall types..."

${modelContext}

IMPORTANT CAPABILITIES:
- You can answer questions about ALL element types, not just common ones
- You have access to quantities (areas, volumes, lengths) when available
- You can discuss materials, property sets, and classifications
- You understand spatial relationships and building structure
- You can provide insights on any IFC entity type in the model

🔧 POWERFUL TOOL AVAILABLE:
You have the 'executeIfcOpenShell' tool to run Python code with IfcOpenShell.

IMPORTANT: When you use this tool, it returns a complete, formatted response string.
Just pass through whatever the tool returns - it's already formatted for the user.

When users ask about:
- Element counts (walls, doors, etc.) → USE the tool with: len(ifc_file.by_type('IfcWall'))
- External/internal elements → USE the tool with: len([w for w in ifc_file.by_type('IfcWall') if w.IsExternal])
- Areas, volumes, lengths → USE the tool
- Properties or materials → USE the tool
- Any specific data from the model → USE the tool

IMPORTANT: For queries about "external walls" or "walls with IsExternal=true":
Always use: len([w for w in ifc_file.by_type('IfcWall') if w.IsExternal])

The tool will return responses like:
- "There are 171 Walls in the model."
- "The total area is 450 m²."
- "No items found."

JUST USE THE TOOL'S RESPONSE AS YOUR ANSWER!

Example tool usage patterns:
- Count elements: len(ifc_file.by_type('IfcWall'))
- Count with property: len([w for w in ifc_file.by_type('IfcWall') if w.IsExternal])
- List properties: [w.Name for w in ifc_file.by_type('IfcWall')]
- Total wall area: sum([w.Area for w in ifc_file.by_type('IfcWall')])
- Materials: ifcopenshell.util.element.get_material(element)
- Properties: ifcopenshell.util.element.get_psets(element)

For property-based queries like "walls with IsExternal=true":
Use: len([w for w in ifc_file.by_type('IfcWall') if w.IsExternal])

CRITICAL - TOOL RESULT DISPLAY RULES:
When you use the executeIfcOpenShell tool:
1. The tool will return a text string with the result
2. YOU MUST include this result in your response
3. The tool result IS your response - just pass it through
4. NEVER return an empty response after using a tool
5. If you call executeIfcOpenShell, its return value IS what you should say

Example: If the tool returns "There are 171 Walls in the model", that's exactly what you should respond with.

REMEMBER: Users CANNOT see tool calls - they only see your text response!
The tool result string is already formatted for the user - just include it in your response.

Example good responses:
- "There are 171 walls in the model"
- "The unique wall types are: Separation wall (non LB), Exterior wall cavity wall..."
- "The total wall area is 2,450 m²"
- "Here are the wall names I found in the model: [list of names]"

Example bad responses:
- "" (empty response after tool call)
- "I've counted the walls" (without showing the number)
- "The code executed successfully" (without showing results)
- Just running a tool without any text response

Please provide helpful, accurate responses about the building model and BIM workflows. Always use the actual data from the model when answering questions.`;

        console.log("💬 System Message:", systemMsg.substring(0, 200) + "...");

        // Create the stream with IfcOpenShell execution tool
        const result = await streamText({
            model: openai("gpt-4o-mini"),
            messages: [
                { role: "system", content: systemMsg },
                ...messages
            ],
            toolChoice: "auto", // Allow the model to choose when to use tools
            onFinish: async ({ text, toolCalls, toolResults }) => {
                console.log("Stream finished:", {
                    textLength: text?.length || 0,
                    toolCallsCount: toolCalls?.length || 0,
                    toolResultsCount: toolResults?.length || 0,
                    toolResults: toolResults
                });

                // If there were tool calls but no text, log a warning
                if (toolCalls && toolCalls.length > 0 && (!text || text.trim() === '')) {
                    console.warn("⚠️ Tool calls made but no text response generated!");
                    console.log("Tool results available:", toolResults);
                }
            },
            tools: model ? {
                executeIfcOpenShell: tool({
                    description: `Execute Python code to analyze the IFC model. Returns a formatted text string with the result that you should include in your response.`,
                    inputSchema: z.object({
                        code: z.string().describe(`Python code using IfcOpenShell. Available variables:
                        - ifc_file: The loaded IFC model
                        - elements: List of all elements
                        Common patterns:
                        - ifc_file.by_type('IfcWall') - get elements by type
                        - ifcopenshell.util.element.get_psets(element) - get property sets
                        - element.IsDefinedBy - access relationships
                        - for space in ifc_file.by_type('IfcSpace'): ... - iterate spaces`),
                        description: z.string().describe('Brief description of what this analysis does'),
                        returnType: z.enum(['quantity', 'list', 'analysis', 'properties']).describe('Type of data being returned')
                    }),
                    execute: async ({ code, description, returnType }) => {
                        try {
                            console.log(`🐍 Executing IfcOpenShell: ${description}`);
                            console.log(`Code preview: ${code.substring(0, 200)}...`);
                            console.log(`Return type: ${returnType}`);

                            // Build the full Python code with proper context
                            const fullCode = `
# IfcOpenShell is already imported
# ifc_file contains the loaded model
import ifcopenshell.util.element

# User code:
${code}

# Return the result
if 'result' in locals():
    result
else:
    "No result variable defined"
`;

                            // Execute Python code on the server (without Worker)
                            const executionResult = await executeServerPython(
                                code, // Use the original code, not fullCode
                                model,
                                returnType
                            );

                            console.log(`✅ IfcOpenShell execution complete:`, executionResult);

                            if (executionResult.success) {
                                // Format the result as a string that will be included in the response
                                let formattedResult = '';
                                const res = executionResult.result;

                                try {

                                    if (res && typeof res === 'object') {
                                        // Handle count results
                                        if (res.type === 'count' && res.value !== undefined) {
                                            if (res.property) {
                                                // Property-based count (e.g., IsExternal=True)
                                                formattedResult = `There are ${res.value} ${res.elementType?.replace('Ifc', '')}${res.value !== 1 ? 's' : ''} with ${res.property}=True`;
                                                if (res.totalElements) {
                                                    formattedResult += ` (out of ${res.totalElements} total ${res.elementType?.replace('Ifc', '')}s).`;
                                                } else {
                                                    formattedResult += ' in the model.';
                                                }
                                            } else {
                                                // Simple count
                                                formattedResult = `There are ${res.value} ${res.elementType?.replace('Ifc', '')}${res.value !== 1 ? 's' : ''} in the model.`;
                                            }
                                        }
                                        // Handle list results (materials, names, etc.)
                                        else if (res.type === 'list') {
                                            if (res.values && Array.isArray(res.values)) {
                                                // Ensure all values are numbers and filter out non-numeric values
                                                const numericValues = res.values.filter(v => typeof v === 'number' && !isNaN(v));
                                                const total = numericValues.length > 0
                                                    ? numericValues.reduce((sum: number, val: number) => Number(sum) + Number(val), 0)
                                                    : 0;
                                                const count = res.values.length;

                                                // Ensure total is a valid number
                                                const totalNum = Number(total) || 0;

                                                if (res.property === 'Area') {
                                                    if (totalNum === 0 && count === 0) {
                                                        formattedResult = `No area data found for ${res.elementType?.replace('Ifc', '')}s. The area property may not be defined in this IFC model.`;
                                                    } else if (totalNum === 0) {
                                                        formattedResult = `The total area is 0 m² for ${res.elementCount || count} ${res.elementType?.replace('Ifc', '')}s. Area properties may not be defined.`;
                                                    } else {
                                                        formattedResult = `The total area of all ${res.elementType?.replace('Ifc', '')}s is ${totalNum.toFixed(2)} m² (from ${count} elements).`;
                                                    }
                                                } else if (res.property) {
                                                    if (count === 0) {
                                                        formattedResult = `No ${res.property} data found for ${res.elementType?.replace('Ifc', '')}s.`;
                                                    } else if (numericValues.length > 0) {
                                                        formattedResult = `Found ${res.property} data for ${count} ${res.elementType?.replace('Ifc', '')}s. Total: ${totalNum.toFixed(2)}`;
                                                    } else {
                                                        // Non-numeric property values
                                                        formattedResult = `Found ${res.property} data for ${count} ${res.elementType?.replace('Ifc', '')}s.`;
                                                    }
                                                } else {
                                                    if (count === 0) {
                                                        formattedResult = `No data found for ${res.elementType?.replace('Ifc', '')}s.`;
                                                    } else if (numericValues.length > 0) {
                                                        formattedResult = `Found data for ${count} ${res.elementType?.replace('Ifc', '')}s with total: ${totalNum.toFixed(2)}`;
                                                    } else {
                                                        formattedResult = `Found data for ${count} ${res.elementType?.replace('Ifc', '')}s.`;
                                                    }
                                                }
                                            } else if (res.uniqueValues && Array.isArray(res.uniqueValues)) {
                                                if (res.property === 'Name' || res.property === 'Material') {
                                                    formattedResult = `Found ${res.uniqueCount} unique ${res.property.toLowerCase()}s:\n${res.uniqueValues.slice(0, 10).join('\n')}${res.uniqueCount > 10 ? `\n... and ${res.uniqueCount - 10} more` : ''}`;
                                                } else if (res.property === 'Area') {
                                                    const numericValues = res.uniqueValues.filter((v: any) => typeof v === 'number' && !isNaN(v));
                                                    const total = numericValues.length > 0
                                                        ? numericValues.reduce((sum: number, val: number) => Number(sum) + Number(val), 0)
                                                        : 0;
                                                    const totalNum = Number(total) || 0;
                                                    formattedResult = `Found ${res.uniqueCount} unique area values. Total: ${totalNum.toFixed(2)} m²`;
                                                } else {
                                                    formattedResult = `Found ${res.uniqueCount} unique values: ${res.uniqueValues.map((v: any) => {
                                                        if (typeof v === 'number' && !isNaN(v)) {
                                                            return Number(v).toFixed(2);
                                                        }
                                                        return String(v);
                                                    }).slice(0, 5).join(', ')}${res.uniqueCount > 5 ? '...' : ''}`;
                                                }
                                            } else if (res.items && Array.isArray(res.items)) {
                                                if (res.items.length === 0) {
                                                    formattedResult = `No ${res.property || 'items'} found for ${res.elementType?.replace('Ifc', '')}s.`;
                                                } else {
                                                    formattedResult = `Found ${res.items.length} ${res.property || 'item'}s:\n${res.items.slice(0, 10).join('\n')}${res.items.length > 10 ? `\n... and ${res.items.length - 10} more` : ''}`;
                                                }
                                            } else {
                                                formattedResult = `Found ${res.foundCount || 0} items.`;
                                            }
                                        }
                                        // Handle area/volume calculations
                                        else if (res.unit === 'm²' || res.unit === 'm³') {
                                            if (res.value === 0 && res.message) {
                                                formattedResult = res.message;
                                            } else if (res.value === 0) {
                                                formattedResult = `No ${res.propertyRequested || 'quantity'} data found for ${res.elementType?.replace('Ifc', '')}s in this model.`;
                                            } else {
                                                formattedResult = `Total ${res.propertyRequested || 'value'}: ${res.value.toFixed(2)} ${res.unit} for ${res.elementCount} ${res.elementType?.replace('Ifc', '')}s.`;
                                            }
                                        }
                                        // Handle material results
                                        else if (res.type === 'materials' && res.materials) {
                                            if (res.materials.length === 0) {
                                                formattedResult = `No materials defined for ${res.elementType?.replace('Ifc', '')}s in this model.`;
                                            } else {
                                                const uniqueMaterials = [...new Set(res.materials)];
                                                formattedResult = `Materials used in ${res.elementType?.replace('Ifc', '')}s:\n${uniqueMaterials.slice(0, 10).join('\n')}${uniqueMaterials.length > 10 ? `\n... and ${uniqueMaterials.length - 10} more` : ''}`;
                                            }
                                        }
                                        // Handle generic value results
                                        else if (res.value !== undefined) {
                                            if (typeof res.value === 'number') {
                                                // Check if this is likely an area/volume calculation based on context
                                                if (res.value === 0 && (res.elementType || res.elementCount)) {
                                                    formattedResult = `No quantity data found for ${res.elementType?.replace('Ifc', '')}s. The requested property may not be defined in this IFC model.`;
                                                } else if (res.value === 0) {
                                                    formattedResult = `The calculated value is 0. This may indicate the property is not defined in the model.`;
                                                } else {
                                                    formattedResult = `Result: ${res.value}${res.unit ? ' ' + res.unit : ''}`;
                                                }
                                            } else {
                                                formattedResult = `Result: ${JSON.stringify(res.value)}`;
                                            }
                                        }
                                        // Fallback for complex objects
                                        else {
                                            if (res.message) {
                                                formattedResult = res.message;
                                            } else if (res.elementType) {
                                                formattedResult = `Analysis complete for ${res.elementCount || 'all'} ${res.elementType?.replace('Ifc', '')}s.`;
                                            } else {
                                                formattedResult = `Analysis complete. ${res.elementCount ? `Processed ${res.elementCount} elements.` : ''}`;
                                            }
                                        }
                                    } else {
                                        formattedResult = String(executionResult.result);
                                    }

                                } catch (formatError) {
                                    console.error('Error formatting tool result:', formatError);
                                    // Fallback to simple string representation
                                    formattedResult = `Analysis complete. Result: ${JSON.stringify(executionResult.result).substring(0, 200)}`;
                                }

                                // Return the formatted result as a string directly
                                // This should be included in the AI's response
                                console.log(`🔧 Tool result formatted: ${formattedResult}`);
                                return formattedResult;
                            } else {
                                const errorMessage = `Error: ${executionResult.error || 'Execution failed'}`;
                                console.log(`❌ Tool error: ${errorMessage}`);
                                return errorMessage;
                            }
                        } catch (error) {
                            console.error(`❌ IfcOpenShell execution failed:`, error);
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            return `Error executing Python: ${errorMsg}. Check the syntax and ensure the IFC model is loaded correctly.`;
                        }
                    }
                })
            } : undefined
        });

        console.log("✅ AI streaming response initiated");

        // Store tool results that we can use if AI doesn't generate text
        let capturedToolResult = '';

        // Create a custom stream that ensures tool results are included
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                let hasText = false;

                // Collect text from the stream
                for await (const chunk of result.textStream) {
                    if (chunk) {
                        controller.enqueue(encoder.encode(chunk));
                        hasText = true;
                        console.log("Streaming text chunk:", chunk.substring(0, 50));
                    }
                }

                // If no text was generated, try to get tool results
                if (!hasText) {
                    // Try to access the tool results from the finished stream
                    try {
                        const toolResults = await result.toolResults;
                        console.log("Tool results from stream:", toolResults);

                        if (toolResults && toolResults.length > 0) {
                            // Process all tool results (there might be multiple)
                            let combinedResult = '';

                            for (const toolResult of toolResults) {
                                console.log("Processing tool result:", toolResult);

                                // Extract the actual output from the tool result
                                if (toolResult && typeof toolResult === 'object') {
                                    const resultObj = toolResult as any;

                                    // The tool result is wrapped in an object with 'output' field
                                    let extractedResult = '';
                                    if (resultObj.output) {
                                        extractedResult = resultObj.output;
                                    } else if (resultObj.result) {
                                        extractedResult = resultObj.result;
                                    } else if (resultObj.value) {
                                        extractedResult = resultObj.value;
                                    }

                                    if (extractedResult) {
                                        combinedResult += (combinedResult ? '\n' : '') + extractedResult;
                                    }
                                } else if (typeof toolResult === 'string') {
                                    combinedResult += (combinedResult ? '\n' : '') + toolResult;
                                }
                            }

                            if (combinedResult) {
                                capturedToolResult = combinedResult;
                                console.log("Using combined tool results:", capturedToolResult);
                                controller.enqueue(encoder.encode(capturedToolResult));
                            } else {
                                console.log("Could not extract any tool results");
                            }
                        }
                    } catch (e) {
                        console.error("Error accessing tool results:", e);
                    }
                }

                // If still no content, use fallback based on query
                if (!hasText && !capturedToolResult) {
                    // Fallback to query-based responses if no tool result captured
                    console.log("No text from AI and no tool result captured, using fallback");
                    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

                    // Check for area/m2 queries first
                    if (lastMessage.includes('m2') || lastMessage.includes('m²') || lastMessage.includes('area')) {
                        // Determine which element type from context
                        let elementType = '';
                        let elementCount = 0;

                        if (lastMessage.includes('wall')) {
                            elementType = 'Wall';
                            elementCount = model?.elementCounts?.IfcWall || 0;
                        } else if (lastMessage.includes('door')) {
                            elementType = 'Door';
                            elementCount = model?.elementCounts?.IfcDoor || 0;
                        } else if (lastMessage.includes('slab')) {
                            elementType = 'Slab';
                            elementCount = model?.elementCounts?.IfcSlab || 0;
                        } else if (lastMessage.includes('window')) {
                            elementType = 'Window';
                            elementCount = model?.elementCounts?.IfcWindow || 0;
                        } else {
                            // Check previous messages for context
                            const prevMessage = messages[messages.length - 2]?.content?.toLowerCase() || '';
                            if (prevMessage.includes('wall')) elementType = 'Wall';
                            else if (prevMessage.includes('door')) elementType = 'Door';
                            else if (prevMessage.includes('slab')) elementType = 'Slab';
                            else if (prevMessage.includes('window')) elementType = 'Window';
                        }

                        if (elementType) {
                            const response = `Calculating area for ${elementType}s... Area data may not be available in this IFC model.`;
                            controller.enqueue(encoder.encode(response));
                            console.log("Added area calculation fallback:", response);
                        } else {
                            controller.enqueue(encoder.encode("Please specify which elements you want the area for."));
                        }
                    }
                    // Check for property-based queries (e.g., IsExternal)
                    else if (lastMessage.includes('isexternal') || lastMessage.includes('is external') || lastMessage.includes('external')) {
                        let elementType = '';
                        if (lastMessage.includes('wall')) {
                            elementType = 'Wall';
                            // Try to count external walls if we have element data
                            if (model?.elements) {
                                const walls = model.elements.filter((el: any) => el.type === 'IfcWall');
                                let externalCount = 0;
                                walls.forEach((wall: any) => {
                                    if (wall.properties?.IsExternal === true || wall.properties?.IsExternal === 'True' ||
                                        (wall.psets && Object.values(wall.psets).some((pset: any) =>
                                            pset?.IsExternal === true || pset?.IsExternal === 'True'))) {
                                        externalCount++;
                                    }
                                });
                                const response = `There are ${externalCount} external walls (out of ${walls.length} total walls).`;
                                controller.enqueue(encoder.encode(response));
                                console.log("Added external walls fallback:", response);
                            } else {
                                const response = `Checking for external walls... This requires detailed property analysis.`;
                                controller.enqueue(encoder.encode(response));
                            }
                        } else {
                            const response = `Property-based filtering requires detailed element analysis.`;
                            controller.enqueue(encoder.encode(response));
                        }
                    }
                    // Check for material queries
                    else if (lastMessage.includes('material')) {
                        let elementType = '';
                        if (lastMessage.includes('wall')) elementType = 'Wall';
                        else if (lastMessage.includes('door')) elementType = 'Door';
                        else if (lastMessage.includes('slab')) elementType = 'Slab';

                        const response = elementType
                            ? `Material information for ${elementType}s may not be available in this IFC model.`
                            : `Material information may not be available in this IFC model.`;
                        controller.enqueue(encoder.encode(response));
                        console.log("Added material fallback:", response);
                    }
                    // Count queries
                    else if (lastMessage.includes('wall')) {
                        const wallCount = model?.elementCounts?.IfcWall || 0;
                        const response = `There are ${wallCount} walls in the model.`;
                        controller.enqueue(encoder.encode(response));
                        console.log("Added wall count fallback:", response);
                    } else if (lastMessage.includes('door')) {
                        const doorCount = model?.elementCounts?.IfcDoor || 0;
                        const response = `There are ${doorCount} doors in the model.`;
                        controller.enqueue(encoder.encode(response));
                        console.log("Added door count fallback:", response);
                    } else if (lastMessage.includes('window')) {
                        const windowCount = model?.elementCounts?.IfcWindow || 0;
                        const response = `There are ${windowCount} windows in the model.`;
                        controller.enqueue(encoder.encode(response));
                        console.log("Added window count fallback:", response);
                    } else if (lastMessage.includes('slab')) {
                        const slabCount = model?.elementCounts?.IfcSlab || 0;
                        const response = `There are ${slabCount} slabs in the model.`;
                        controller.enqueue(encoder.encode(response));
                        console.log("Added slab count fallback:", response);
                    } else if (lastMessage.includes('floor') || lastMessage.includes('storey')) {
                        const storeyCount = model?.elementCounts?.IfcBuildingStorey || 0;
                        const response = storeyCount > 0
                            ? `There are ${storeyCount} building storeys in the model.`
                            : `No building storey information found in this model.`;
                        controller.enqueue(encoder.encode(response));
                        console.log("Added storey count fallback:", response);
                    } else {
                        const fallback = "I've analyzed the model. Please ask a specific question about elements, areas, or materials.";
                        controller.enqueue(encoder.encode(fallback));
                        console.log("Added generic fallback");
                    }
                }

                controller.close();
            }
        });

        const response = new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });

        // Log for debugging
        console.log("📤 Returning custom stream response to client");

        return response;
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
