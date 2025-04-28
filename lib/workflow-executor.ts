import {
  extractGeometry,
  filterElements as filterElementsByProperty,
  transformElements,
  extractQuantities,
  manageProperties,
  manageClassifications,
  spatialQuery,
  queryRelationships,
  exportData,
  loadIfcFile,
  getIfcFile,
  IfcModel,
  getLastLoadedModel,
  extractGeometryWithGeom,
} from "@/lib/ifc-utils";

// Import the detailed filter function from its correct location
import { filterElements } from "@/lib/ifc/filter-utils";
// Import the specific clash detection function
import { performClashDetection } from "@/lib/ifc/analysis-utils";
import type { IfcElement } from "@/lib/ifc/ifc-loader";

// Add TypeScript interfaces at the top of the file
interface PropertyInfo {
  name: string;
  exists: boolean;
  value: any;
  psetName: string;
}

interface PropertyNodeElement {
  id: string;
  expressId?: number;
  type: string;
  properties?: {
    GlobalId?: string;
    Name?: string;
    [key: string]: any;
  };
  propertyInfo?: PropertyInfo;
  [key: string]: any;
}

// Helper function to safely convert values to JSON strings, avoiding cyclic references
function safeStringify(value: any): string {
  // Handle primitive values directly
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value !== "object") return String(value);

  // For objects, use a WeakSet to track objects that have been processed
  const seen = new WeakSet();

  // Custom replacer function for JSON.stringify that handles circular references
  const replacer = (key: string, value: any) => {
    // For non-objects, return the value directly
    if (typeof value !== "object" || value === null) return value;

    // For objects, check if we've seen it before to avoid cycles
    if (seen.has(value)) {
      return "[Circular Reference]";
    }

    // Mark this object as seen
    seen.add(value);
    return value;
  };

  try {
    return JSON.stringify(value, replacer);
  } catch (error) {
    console.warn("Error stringifying object:", error);
    return "[Complex Object]";
  }
}

// This is a simplified workflow executor
// In a real application, this would be more sophisticated with proper error handling and progress tracking
export class WorkflowExecutor {
  private nodes: any[] = [];
  private edges: any[] = [];
  private nodeResults: Map<string, any> = new Map();
  private isRunning = false;
  private abortController: AbortController | null = null;

  constructor(nodes: any[], edges: any[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  // Add getter for the final nodes list
  public getUpdatedNodes(): any[] {
    return this.nodes;
  }

  public async execute(): Promise<Map<string, any>> {
    if (this.isRunning) {
      throw new Error("Workflow is already running");
    }

    this.isRunning = true;
    this.nodeResults.clear();
    this.abortController = new AbortController();

    try {
      console.log("Starting workflow execution...");

      // Find all nodes that need to be processed (topological sort)
      const sortedNodes = this.topologicalSort();

      // Process each node in order
      for (const nodeId of sortedNodes) {
        console.log(`Processing node ${nodeId}`);
        await this.processNode(nodeId);
      }

      console.log("Workflow execution completed");
      return this.nodeResults;
    } catch (error) {
      console.error("Error executing workflow:", error);
      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  public stop(): void {
    if (this.isRunning && this.abortController) {
      this.abortController.abort();
      this.isRunning = false;
    }
  }

  private findInputNodes(): string[] {
    const nodesWithIncomingEdges = new Set(
      this.edges.map((edge) => edge.target)
    );

    return this.nodes
      .filter((node) => !nodesWithIncomingEdges.has(node.id))
      .map((node) => node.id);
  }

  private async processNode(nodeId: string): Promise<any> {
    // If we already processed this node, return the cached result
    if (this.nodeResults.has(nodeId)) {
      return this.nodeResults.get(nodeId);
    }

    // Find the node
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node with id ${nodeId} not found`);
    }

    // Get input values by processing upstream nodes
    const inputValues = await this.getInputValues(nodeId);

    // Process the node based on its type
    let result;
    switch (node.type) {
      case "ifcNode":
        console.log("Processing ifcNode", { node });

        // *** PRIORITIZE already loaded model data ***
        if (node.data?.model && node.data.model.elements && node.data.model.id?.startsWith('model-')) {
          console.log(`ifcNode ${node.id}: Using model data already present in the node.`);
          result = node.data.model; // Use the model object directly
        } else {
          // Fallback: Try loading via filename (if model isn't in node data yet)
          console.log(`ifcNode ${node.id}: Model data not found in node, attempting load via filename.`);
          const filename = node.data?.properties?.filename;
          if (!filename) {
            console.error(`ifcNode ${node.id} has no filename property.`);
            result = { type: "error", value: "No filename specified and no model data available" };
            break; // Break here if no filename either
          }

          const fileObject = getIfcFile(filename);
          if (!fileObject) {
            console.error(`File not found in cache for ifcNode ${node.id}: ${filename}`);
            result = { type: "error", value: `File not found: ${filename}` };
            break;
          }

          console.log(`ifcNode ${node.id}: Found file ${filename} in cache. Loading model...`);
          result = await loadIfcFile(fileObject);
          console.log(`ifcNode ${node.id}: Model loaded/retrieved for ${filename}`);
        }
        break;

      case "geometryNode":
        // Check if we should use actual geometry
        if (node.data.properties?.useActualGeometry) {
          // Use the full geometry extraction with web worker
          result = await this.executeGeometryNode(node);
        } else {
          // Use the simple extraction method
          result = extractGeometry(
            inputValues.input,
            node.data.properties?.elementType || "all",
            node.data.properties?.includeOpenings !== "false"
          );
        }
        break;

      case "filterNode":
        console.log("Processing filterNode", { node, inputValues });
        let elementsToFilter: IfcElement[] | undefined;
        const rawFilterInput = inputValues.input; // Get the raw input value from the previous node's result

        // Check if the input is the IfcModel object from ifcNode
        if (rawFilterInput && typeof rawFilterInput === 'object' && rawFilterInput.elements && Array.isArray(rawFilterInput.elements) && rawFilterInput.id?.startsWith('model-')) {
          console.log(`FilterNode ${node.id} received IfcModel object.`);
          elementsToFilter = rawFilterInput.elements;
        }
        // Check if input is from another node outputting { type: 'elements', value: [...] }
        else if (rawFilterInput && typeof rawFilterInput === 'object' && rawFilterInput.type === 'elements' && Array.isArray(rawFilterInput.value)) {
          console.log(`FilterNode ${node.id} received elements array directly.`);
          elementsToFilter = rawFilterInput.value;
        } else {
          console.warn(`Filter node ${node.id} received unexpected input structure:`, rawFilterInput);
          elementsToFilter = undefined; // Ensure it's undefined if structure is wrong
        }

        const filterProps = node.data?.properties;

        if (!elementsToFilter) { // Check if we successfully extracted elements
          console.error(`Filter node ${node.id} could not extract valid elements array from input.`);
          result = { type: "error", value: "Invalid input elements structure for filter" };
          break;
        }

        if (!filterProps?.filterType || !filterProps?.operator) {
          console.warn(`Filter node ${node.id} is not configured.`);
          result = { type: "error", value: "Filter not configured" };
          break;
        }

        const filteredElements = filterElements(
          elementsToFilter,
          filterProps.filterType,
          filterProps.operator,
          filterProps.value || "",
          filterProps.propertySet
        );

        console.log(`Filter node ${node.id} produced ${filteredElements.length} elements`);
        result = {
          type: "elements",
          value: filteredElements,
          count: filteredElements.length
        };
        break;

      case "transformNode":
        // Transform elements
        if (!inputValues.input) {
          console.warn(`No input provided to transform node ${nodeId}`);
          result = [];
        } else {
          result = transformElements(
            inputValues.input,
            [
              Number.parseFloat(node.data.properties?.translateX || 0),
              Number.parseFloat(node.data.properties?.translateY || 0),
              Number.parseFloat(node.data.properties?.translateZ || 0),
            ],
            [
              Number.parseFloat(node.data.properties?.rotateX || 0),
              Number.parseFloat(node.data.properties?.rotateY || 0),
              Number.parseFloat(node.data.properties?.rotateZ || 0),
            ],
            [
              Number.parseFloat(node.data.properties?.scaleX || 1),
              Number.parseFloat(node.data.properties?.scaleY || 1),
              Number.parseFloat(node.data.properties?.scaleZ || 1),
            ]
          );
        }
        break;

      case "quantityNode":
        // Extract quantities via worker
        if (!inputValues.input) {
          console.warn(`No input provided to quantity node ${nodeId}`);
          // Return a properly structured empty result that the watchNode can display safely
          result = {
            groups: { "Error": 0 },
            unit: "",
            total: 0,
            error: "No input data available"
          };
        } else {
          // The input should be the IfcModel object from the previous node
          const modelInput = inputValues.input as IfcModel;

          // Validate input has necessary properties for the worker call
          if (!modelInput || !modelInput.elements || !modelInput.name) {
            console.error("Invalid input to quantityNode: Missing model, elements, or name.", modelInput);
            // Return a properly structured empty result with error message
            result = {
              groups: { "Invalid Model": 0 },
              unit: "",
              total: 0,
              error: "Invalid input model"
            };
          } else {
            try {
              // Get quantityType and groupBy from node properties with defaults
              const quantityType = node.data.properties?.quantityType || "area";
              const groupBy = node.data.properties?.groupBy || "none";

              // Store the current settings back to the node data to ensure they persist
              // This is the key fix - we persist these values by updating the node data
              this.updateNodeDataInList(nodeId, {
                ...node.data,
                properties: {
                  ...node.data.properties,
                  quantityType: quantityType,
                  groupBy: groupBy
                }
              });

              // Await the async call to the worker via extractQuantities
              result = await extractQuantities(
                modelInput, // Pass the full model object
                quantityType,
                groupBy,
                undefined, // Placeholder for onProgress callback (optional)
                // --- Pass the callback to update node data with messageId ---
                (messageId: string) => {
                  // Update the node data, but keep our property settings
                  this.updateNodeDataInList(nodeId, {
                    ...node.data,
                    messageId: messageId,
                    properties: {
                      ...node.data.properties,
                      quantityType: quantityType,
                      groupBy: groupBy
                    }
                  });
                  console.log(`Stored messageId ${messageId} for quantity node ${nodeId}`);
                }
                // ---------------------------------------------------------
              );

              // Add the groupBy property to the result
              if (result && typeof result === 'object') {
                (result as any).groupBy = groupBy;
              }
            } catch (error) {
              console.error(`Error during quantity extraction for node ${nodeId}:`, error);
              // Return a properly structured error result that won't crash the UI
              result = {
                groups: { "Error": 0 },
                unit: "",
                total: 0,
                error: error instanceof Error ? error.message : String(error)
              };
            }
          }
        }
        break;

      case "propertyNode":
        console.log("Processing propertyNode", { node, inputValues });

        // Add debugging to see the structure of the inputs
        if (!inputValues || !inputValues.input) {
          console.warn("No input provided to property node");
          result = { elements: [] };
          break;
        }

        // Determine if input is model object or elements array
        let nodeElements = [];

        if (Array.isArray(inputValues.input)) {
          nodeElements = inputValues.input;
          console.log(
            "Input is an array with",
            nodeElements.length,
            "elements"
          );
        } else if (inputValues.input && inputValues.input.elements) {
          nodeElements = inputValues.input.elements;
          console.log(
            "Input is a model object with",
            nodeElements.length,
            "elements"
          );
        } else {
          console.warn("Unexpected input format:", typeof inputValues.input);
          console.log("Input:", inputValues.input);
          result = { elements: [] };
          break;
        }

        // Always log the first element to understand structure
        if (nodeElements.length > 0) {
          console.log(
            "Sample element structure:",
            JSON.stringify(nodeElements[0], null, 2)
          );

          // Check if psets are available
          if (nodeElements[0].psets) {
            console.log(
              "Element has psets:",
              Object.keys(nodeElements[0].psets)
            );

            // Check for common wall psets
            if (nodeElements[0].psets["Pset_WallCommon"]) {
              console.log(
                "Pset_WallCommon:",
                nodeElements[0].psets["Pset_WallCommon"]
              );
            }
          }
        }

        // Extract properties from the node configuration
        const propertyName = node.data.properties?.propertyName || "";
        const action = node.data.properties?.action || "get";
        const propertyValue = node.data.properties?.propertyValue || "";
        const targetPset = node.data.properties?.targetPset || "any";

        // Determine where property values should come from
        let valueToUse = propertyValue;
        if (
          node.data.properties?.useValueInput &&
          inputValues.valueInput !== undefined
        ) {
          // Log the original input value for debugging
          console.log("Using value from input:", inputValues.valueInput);

          // Handle different input types for valueInput
          let inputValue = inputValues.valueInput;

          // If it's a complex object, try to extract a usable value
          if (typeof inputValue === "object" && inputValue !== null) {
            // Check if it's a property node result (has elements with propertyInfo)
            if (
              inputValue.elements &&
              Array.isArray(inputValue.elements) &&
              inputValue.elements[0]?.propertyInfo
            ) {
              console.log("Input value is a property node result");

              // Extract values from the property node results
              // If there's only one unique value, use that
              if (
                inputValue.uniqueValues &&
                inputValue.uniqueValues.length === 1
              ) {
                valueToUse = inputValue.uniqueValues[0];
                console.log("Using single unique value:", valueToUse);
              }
              // If there are multiple unique values, use the value from the first matching element
              else if (
                inputValue.elements.length > 0 &&
                inputValue.elements[0].propertyInfo?.exists
              ) {
                valueToUse = inputValue.elements[0].propertyInfo.value;
                console.log(
                  "Using first element's property value:",
                  valueToUse
                );
              }
              // Fallback to the raw input if we couldn't extract a better value
              else {
                valueToUse = inputValue;
                console.log(
                  "Using complex object as value (might cause issues)"
                );
              }
            }
            // Otherwise just use the input value
            else {
              valueToUse = inputValue;
            }
          } else {
            // For primitive types, use directly
            valueToUse = inputValue;
          }
        }

        console.log("Final value used for property:", valueToUse);

        // Manage properties using the utility function with options object
        const updatedElements = manageProperties(nodeElements, {
          action: action.toLowerCase(),
          propertyName,
          propertyValue: valueToUse,
          targetPset,
        });

        // Return the result with the updated elements
        result = { elements: updatedElements };

        // Also store the results in the node data for UI access
        node.data.results = updatedElements;
        break;

      case "watchNode":
        // Process data for watch node
        console.log("Processing watchNode", { node, inputValues });

        if (!inputValues || !inputValues.input) {
          console.log("No input provided to watch node");
          result = null;
          break;
        }

        let processedData = inputValues.input;

        // Get actual input type for display
        let inputType = "unknown";
        let itemCount = 0;

        if (Array.isArray(processedData)) {
          // Check if this is an array of IFC elements with geometry
          if (
            processedData.length > 0 &&
            processedData[0].type &&
            processedData[0].type.startsWith("Ifc") &&
            (processedData[0].geometry ||
              processedData[0].properties?.hasSimplifiedGeometry)
          ) {
            console.log(
              "Watch node received IFC elements with geometry:",
              processedData.length
            );

            // For geometry elements, create a more useful summary
            const geometryTypes = processedData.reduce((types, el) => {
              types[el.type] = (types[el.type] || 0) + 1;
              return types;
            }, {});

            // Process as a special geometry result
            processedData = {
              elements: processedData,
              elementCount: processedData.length,
              geometryTypes,
              hasGeometry: true,
            };

            inputType = "geometryResult";
            itemCount = processedData.elements.length;
          } else {
            // Regular array
            inputType = "array";
            itemCount = processedData.length;
          }
        } else if (processedData === null) {
          inputType = "null";
        } else if (processedData === undefined) {
          inputType = "undefined";
        } else if (typeof processedData === "object") {
          // Check if this is coming from a property node with propertyInfo
          if (
            processedData.elements &&
            Array.isArray(processedData.elements) &&
            processedData.elements[0]?.propertyInfo
          ) {
            // This is property node output - extract the relevant data
            const elements: PropertyNodeElement[] = processedData.elements;
            const elementsWithProperty = elements.filter(
              (e: PropertyNodeElement) => e.propertyInfo?.exists
            );

            // Get first element's property info to determine what we're dealing with
            const firstProperty = elementsWithProperty[0]?.propertyInfo;

            if (firstProperty) {
              // Find unique values
              const uniqueValues = [
                ...new Set(
                  elementsWithProperty
                    .map((e: PropertyNodeElement) => e.propertyInfo?.value)
                    .map((v: any) =>
                      typeof v === "object" ? safeStringify(v) : String(v)
                    )
                ),
              ].map((v: string) => {
                try {
                  return JSON.parse(v);
                } catch {
                  return v;
                }
              });

              // Create a more concise result focused on the property but including GlobalId for reference
              processedData = {
                propertyName: firstProperty.name,
                psetName: firstProperty.psetName,
                found: elementsWithProperty.length > 0,
                totalElements: elements.length,
                elementsWithProperty: elementsWithProperty.length,
                type: typeof firstProperty.value,
                uniqueValues,
                // Add element references with ids and GlobalIds
                elements: elementsWithProperty.map(
                  (e: PropertyNodeElement) => ({
                    id: e.id,
                    expressId: e.expressId,
                    type: e.type,
                    GlobalId: e.properties?.GlobalId,
                    Name: e.properties?.Name,
                    value: e.propertyInfo?.value,
                  })
                ),
              };

              inputType = "propertyResults";
              itemCount = elementsWithProperty.length;
            }
          }
          // ADD CHECK: Check if this is coming from a quantity node
          else if (processedData.groups && typeof processedData.unit === 'string' && typeof processedData.total === 'number') {
            inputType = "quantityResults";
            itemCount = Object.keys(processedData.groups).length; // Count the number of groups
          }
          // Fallback for generic objects
          else {
            inputType = "object";
            itemCount = Object.keys(processedData).length;
          }
        } else {
          inputType = typeof processedData;
        }

        // Update the node data with input information for display
        node.data.inputData = {
          type: inputType,
          value: processedData,
          count: itemCount,
        };

        // Watch nodes don't change the data, just pass it through
        result = processedData;
        break;

      case "classificationNode":
        // Manage classifications
        if (!inputValues.input) {
          console.warn(`No input provided to classification node ${nodeId}`);
          result = [];
        } else {
          result = manageClassifications(
            inputValues.input,
            node.data.properties?.system || "uniclass",
            node.data.properties?.action || "get",
            node.data.properties?.code || ""
          );
        }
        break;

      case "spatialNode":
        // Spatial query
        if (!inputValues.input) {
          console.warn(`No input provided to spatial node ${nodeId}`);
          result = [];
        } else {
          result = spatialQuery(
            inputValues.input,
            inputValues.reference || [],
            node.data.properties?.queryType || "contained",
            Number.parseFloat(node.data.properties?.distance || 1.0)
          );
        }
        break;

      case "relationshipNode":
        // Relationship query
        if (!inputValues.input) {
          console.warn(`No input provided to relationship node ${nodeId}`);
          result = [];
        } else {
          result = queryRelationships(
            inputValues.input,
            node.data.properties?.relationType || "containment",
            node.data.properties?.direction || "outgoing"
          );
        }
        break;

      case "analysisNode":
        console.log("Processing analysisNode", { node, inputValues });
        // Get primary and reference inputs correctly
        const primaryInputAnalysis = inputValues.input; // Result from upstream node (Filter/IFC)
        const referenceInputAnalysis = inputValues.reference; // Result from upstream node (Filter/IFC)
        const analysisProps = node.data?.properties;

        // Extract element arrays from inputs
        const primaryElementsAnalysis = primaryInputAnalysis?.type === 'elements' ? primaryInputAnalysis.value : undefined;
        const referenceElementsAnalysis = referenceInputAnalysis?.type === 'elements' ? referenceInputAnalysis.value : undefined;

        if (!primaryElementsAnalysis || !Array.isArray(primaryElementsAnalysis)) {
          console.error(`Analysis node ${node.id} missing or invalid primary element array. Input received:`, primaryInputAnalysis);
          result = { type: "error", value: "Invalid primary elements for analysis" };
          break;
        }
        if (!referenceElementsAnalysis || !Array.isArray(referenceElementsAnalysis)) {
          console.error(`Analysis node ${node.id} missing or invalid reference element array. Input received:`, referenceInputAnalysis);
          result = { type: "error", value: "Invalid reference elements for analysis" };
          break;
        }

        const tolerance = analysisProps?.tolerance ?? 10;
        console.log(`AnalysisNode: Calling performClashDetection with tolerance: ${tolerance}mm`);

        result = await performClashDetection(
          primaryElementsAnalysis, // Pass the extracted array
          referenceElementsAnalysis, // Pass the extracted array
          { tolerance, showIn3DViewer: true }
        );
        console.log(`AnalysisNode ${node.id} completed clash detection. Clashes found: ${result?.clashes ?? 'Error'}`);
        break;

      case "exportNode":
        // Export
        if (!inputValues.input) {
          console.warn(`No input provided to export node ${nodeId}`);
          result = "";
        } else {
          result = exportData(
            inputValues.input,
            node.data.properties?.format || "csv",
            node.data.properties?.fileName || "export",
            node.data.properties?.properties || "Name,Type,Material"
          );
        }
        break;

      case "parameterNode":
        // Parameter
        result = node.data.properties?.value || "";
        break;

      case "viewerNode":
        console.log("Processing viewerNode", { node, inputValues });
        // Prioritize visualization data, then IFC model, then elements array
        let viewerInputData = inputValues.visualization; // From Analysis Node
        if (!viewerInputData) {
          viewerInputData = inputValues.input; // From IFC Node or Filter Node
        }

        result = {
          type: "viewerState", // Type indicates intent to update viewer
          // Pass the relevant data structure (could be IFC model OR clash results)
          value: viewerInputData
        };
        break;

      default:
        result = null;
    }

    // Cache the result
    this.nodeResults.set(nodeId, result);
    return result;
  }

  private async getInputValues(nodeId: string): Promise<Record<string, any>> {
    const inputEdges = this.edges.filter((edge) => edge.target === nodeId);
    const inputValues: Record<string, any> = {};

    for (const edge of inputEdges) {
      // Process the source node to get its output
      const sourceResult = await this.processNode(edge.source);

      // Map the output to the correct input based on the target handle
      if (edge.targetHandle === "input") {
        inputValues.input = sourceResult;
      } else if (edge.targetHandle === "reference") {
        inputValues.reference = sourceResult;
      } else if (edge.targetHandle === "valueInput") {
        inputValues.valueInput = sourceResult;
      } else {
        // Default case
        inputValues[edge.targetHandle || "input"] = sourceResult;
      }
    }

    return inputValues;
  }

  // Add a new method to perform topological sort of nodes
  private topologicalSort(): string[] {
    // Create a graph representation
    const graph: Record<string, string[]> = {};
    this.nodes.forEach((node) => {
      graph[node.id] = [];
    });

    // Add edges to the graph
    this.edges.forEach((edge) => {
      if (graph[edge.source]) {
        graph[edge.source].push(edge.target);
      }
    });

    // Perform topological sort
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (tempVisited.has(nodeId)) {
        throw new Error("Workflow contains a cycle, cannot execute");
      }

      if (!visited.has(nodeId)) {
        tempVisited.add(nodeId);

        // Visit all neighbors
        if (graph[nodeId]) {
          for (const neighbor of graph[nodeId]) {
            visit(neighbor);
          }
        }

        tempVisited.delete(nodeId);
        visited.add(nodeId);
        result.unshift(nodeId); // Add to the beginning
      }
    };

    // Visit all nodes
    this.nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    });

    return result;
  }

  // Helper to update node data in the internal list
  private updateNodeDataInList(nodeId: string, newData: any) {
    this.nodes = this.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: newData } : n
    );
    // Note: This only updates the executor's internal list.
    // ReactFlow's state needs to be updated separately after execution completes.
  }

  // Execute geometry node with actual geometry extraction
  private async executeGeometryNode(node: any): Promise<any> {
    const nodeId = node.id;
    console.log(`Executing geometry node with actual geometry for ${nodeId}`);

    // Get input values - find the input node (usually an IFC node)
    const inputValues = await this.getInputValues(nodeId);
    if (!inputValues.input) {
      throw new Error(`No input provided to geometry node ${nodeId}`);
    }

    const model = inputValues.input;
    if (!model || !model.file) {
      throw new Error(
        `Input to geometry node ${nodeId} is not a valid IFC model with file reference`
      );
    }

    const elementType = node.data.properties?.elementType || "all";
    const includeOpenings = node.data.properties?.includeOpenings !== "false";

    // Update node state to loading
    let updatedNodeData = {
      ...node.data,
      isLoading: true,
      progress: { percentage: 5, message: "Starting geometry extraction..." },
      error: null,
    };
    this.updateNodeDataInList(nodeId, updatedNodeData);

    try {
      // Define progress callback
      const progressCallback = (percentage: number, message?: string) => {
        this.updateNodeDataInList(nodeId, {
          ...updatedNodeData,
          isLoading: true,
          progress: { percentage, message: message || "Processing..." },
        });
      };

      // Extract geometry with the actual geometry approach
      const elements = await extractGeometryWithGeom(
        model,
        elementType,
        includeOpenings,
        progressCallback
      );

      // Update node with results
      updatedNodeData = {
        ...updatedNodeData,
        elements,
        model,
        isLoading: false,
        progress: null,
      };
      this.updateNodeDataInList(nodeId, updatedNodeData);

      // Return just the elements for workflow processing
      return elements.map((el) => {
        // If the element has a geometry property with a 'simplified' type,
        // include that in the direct properties for easier access in watch nodes
        if (el.geometry && el.geometry.type === "simplified") {
          return {
            ...el,
            properties: {
              ...el.properties,
              hasSimplifiedGeometry: true,
              dimensions: el.geometry.dimensions,
            },
          };
        }
        return el;
      });
    } catch (error) {
      console.error(
        `Error during geometry extraction for node ${nodeId}:`,
        error
      );

      // Update node with error state
      updatedNodeData = {
        ...updatedNodeData,
        isLoading: false,
        progress: null,
        error: error instanceof Error ? error.message : String(error),
      };
      this.updateNodeDataInList(nodeId, updatedNodeData);

      // Rethrow the error
      throw error;
    }
  }
}
