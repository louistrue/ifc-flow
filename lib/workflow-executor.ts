import {
  extractGeometry,
  filterElements,
  transformElements,
  extractQuantities,
  manageProperties,
  manageClassifications,
  spatialQuery,
  queryRelationships,
  performAnalysis,
  exportData,
  loadIfcFile,
  IfcModel,
  getLastLoadedModel,
  extractGeometryWithGeom,
  getRawIfcContent,
} from "@/lib/ifc-utils";
import type { IfcElement } from "@/lib/ifc-utils";

// Add TypeScript interfaces at the top of the file

// Define an interface for the properties added by spatial hierarchy processing
interface SpatialHierarchyProperties {
  isSpatial?: boolean;
  spatialLevel?: number;
  spatialChildren?: string[];
  containedIn?: string;
  containmentStructure?: {
    building?: any;
    storey?: any;
    space?: any;
  };
}

// Combine IfcElement with our spatial properties
type EnhancedIfcElement = IfcElement & SpatialHierarchyProperties;

// Define NodePair interface
interface NodePair {
  node: any;
  inputValues: any;
}

interface PropertyInfo {
  name: string;
  exists: boolean;
  value: any;
  psetName: string;
}

interface PropertyNodeElement extends IfcElement {
  id: string;
  expressId: number;
  type: string;
  properties: {
    GlobalId?: string;
    Name?: string;
    [key: string]: any;
  };
  propertyInfo?: PropertyInfo;
  [key: string]: any;
}

interface Classification {
  system: string;
  code: string;
  description: string;
}

interface EnhancedElement extends IfcElement {
  psets: Record<string, any>;
  classifications?: Classification[];
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
        // Log the request
        console.log("Processing ifcNode", { node });

        if (node.data.modelInfo) {
          // If we already have model info, use it
          console.log("Using modelInfo from node data", node.data.modelInfo);
          result = node.data.modelInfo;
        } else if (node.data.file) {
          try {
            // If there's a file in the node data, load it
            const file = node.data.file;
            console.log("Loading IFC file from node data", file.name);
            result = await loadIfcFile(file);

            // Store the result in the node data for future reference
            node.data.modelInfo = result;
          } catch (err) {
            console.error("Error loading IFC file:", err);
            throw new Error(
              `Failed to load IFC file: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        } else {
          // Try to get the last loaded model
          const lastLoaded = getLastLoadedModel();
          if (lastLoaded) {
            // Use the last loaded model if available
            console.log(
              "Using last loaded model:",
              lastLoaded.id,
              "with",
              lastLoaded.elements.length,
              "elements"
            );
            result = lastLoaded;

            // Store it in the node data for future reference
            node.data.modelInfo = lastLoaded;
          } else {
            // No model info or file available - return empty structure
            console.warn(
              "No IFC model data available. Please load an IFC file first."
            );
            result = {
              id: `empty-model-${Date.now()}`,
              name: "No IFC Data",
              elements: [],
              errorMessage:
                "No IFC file loaded. Please load an IFC file first.",
            };
          }
        }

        // Make sure result is properly formatted with an elements array
        if (result && !result.elements && Array.isArray(result)) {
          // If result is just an array of elements, wrap it in a model object
          result = {
            id: `model-${Date.now()}`,
            name: "IFC Model",
            elements: result,
          };
        } else if (result && !Array.isArray(result.elements)) {
          // If elements is not an array, initialize it as empty array
          result.elements = result.elements || [];
        }

        console.log(
          `IFC node processed with ${result.elements?.length || 0} elements`
        );
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
        // Filter elements
        if (!inputValues.input) {
          console.warn(`No input provided to filter node ${nodeId}`);
          result = [];
        } else {
          // Get elements from input, handling both array and object formats
          let elementsToFilter = inputValues.input;

          // If the input is an object with elements array, use that
          if (
            !Array.isArray(elementsToFilter) &&
            elementsToFilter.elements &&
            Array.isArray(elementsToFilter.elements)
          ) {
            elementsToFilter = elementsToFilter.elements;
          }

          // Ensure we have an array before calling filter
          if (!Array.isArray(elementsToFilter)) {
            console.warn(
              `Input to filter node ${nodeId} is not an array or object with elements array`
            );
            result = [];
          } else {
            result = filterElements(
              elementsToFilter,
              node.data.properties?.property || "",
              node.data.properties?.operator || "equals",
              node.data.properties?.value || ""
            );
          }
        }
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
        // Extract quantities
        if (!inputValues.input) {
          console.warn(`No input provided to quantity node ${nodeId}`);
          result = { Total: 0 };
        } else {
          result = extractQuantities(
            inputValues.input,
            node.data.properties?.quantityType || "area",
            node.data.properties?.groupBy || "none",
            node.data.properties?.unit || ""
          );
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
          } else {
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
        console.log("Processing classificationNode", {
          nodeId,
          system: node.data.properties?.system || "custom",
          action: node.data.properties?.action || "get",
          code: node.data.properties?.code || "",
          useInputValues: node.data.properties?.useInputValues || false,
          inputCodes: inputValues["input-codes"],
          inputNames: inputValues["input-names"],
        });

        if (!inputValues || !inputValues.input) {
          console.warn(`No input provided to classification node ${nodeId}`);
          result = {
            elements: [],
            error: "No input provided. Connect an IFC node to this node.",
          };
        } else {
          try {
            // Handle different input types to ensure we pass a valid array of elements
            let elementsToProcess;
            let originalModel = null;

            // Keep track of the original model object if available
            if (Array.isArray(inputValues.input)) {
              elementsToProcess = inputValues.input;
            } else if (
              inputValues.input.elements &&
              Array.isArray(inputValues.input.elements)
            ) {
              elementsToProcess = inputValues.input.elements;
              originalModel = inputValues.input;
            } else {
              console.warn(
                `Invalid input format for classification node ${nodeId}`
              );
              elementsToProcess = [];
            }

            // Process with cleaned input - but only for "set" action
            // For "get" action, we use our enhanced detection directly
            const action = (
              node.data.properties?.action || "get"
            ).toLowerCase();
            let processedElements;

            if (action === "set") {
              // For set mode, use the standard function
              // Check for input values first
              const codes = inputValues["input-codes"];
              const names = inputValues["input-names"];

              // If we have input values, process each code-name pair
              if (codes || names) {
                // Convert input values to arrays
                const codesArray = Array.isArray(codes)
                  ? codes
                  : typeof codes === "string"
                  ? codes
                      .split(",")
                      .map((c) => c.trim())
                      .filter((c) => c.length > 0)
                  : [];
                const namesArray = Array.isArray(names)
                  ? names
                  : typeof names === "string"
                  ? names
                      .split(",")
                      .map((n) => n.trim())
                      .filter((n) => n.length > 0)
                  : [];

                console.log("Processing classifications with input values:", {
                  codes: codesArray,
                  names: namesArray,
                });

                // Process each code-name pair
                processedElements = elementsToProcess.map(
                  (element: IfcElement) => {
                    const enhancedElement: EnhancedElement = {
                      ...element,
                      psets: element.psets || {},
                      classifications: [],
                    };

                    // Create or update classifications for each code
                    const classifications: Classification[] = codesArray.map(
                      (code, index) => ({
                        system: (
                          node.data.properties?.system || "custom"
                        ).toLowerCase(),
                      code: code,
                        description: namesArray[index] || code,
                      })
                    );

                    // Store classifications in the element
                    enhancedElement.classifications = classifications;

                    // Also store in psets for IFC export
                    classifications.forEach((cls) => {
                      const psetName = `Pset_ClassificationReference_${cls.code}`;
                      enhancedElement.psets[psetName] = {
                        System: cls.system,
                        Code: cls.code,
                        Name: cls.description,
                        ItemReference: cls.code,
                        Description: `${cls.system} classification ${cls.code}`,
                      };
                    });

                    return enhancedElement;
                  }
                );

                // Log the number of elements processed
              console.log(
                  `Applied classifications to ${processedElements.length} elements`
                );

                // Log a sample of the processed elements
                if (processedElements.length > 0) {
                  console.log(
                    "Sample processed element:",
                    JSON.stringify(
                      {
                        id: processedElements[0].id,
                        type: processedElements[0].type,
                        classifications: processedElements[0].classifications,
                        psets: processedElements[0].psets,
                      },
                      null,
                      2
                    )
                  );
                }
              } else {
                // Fallback to using node properties if no input values
              processedElements = manageClassifications(
                elementsToProcess,
                (node.data.properties?.system || "custom").toLowerCase(),
                action,
                node.data.properties?.code || ""
              );
              }
            } else {
              // For get mode, use our already processed elements with classifications
              processedElements = elementsToProcess;
            }

            // Return result in standard format with proper typing
            const classificationResult: {
              elements: IfcElement[];
              count: number;
              uniqueClassifications?: Array<{
                system: string;
                code: string;
                description: string;
              }>;
              classificationCount?: number;
              modelClassifications?: Array<{
                name: string;
                references: Array<{
                  id: string;
                  name: string;
                }>;
              }>;
              systemsFound?: string[];
              type: string;
            } = {
              elements: processedElements,
              count: processedElements.length,
              type: "classifications", // Set a default type for all classification results
            };

            // For 'get' action, extract unique classifications for display
            if (
              (node.data.properties?.action || "get").toLowerCase() === "get"
            ) {
              const allClassifications = [];

              // Collect all classifications from all elements
              for (const element of processedElements) {
                if (
                  element.classifications &&
                  element.classifications.length > 0
                ) {
                  console.log(
                    `Adding ${element.classifications.length} classifications from element ${element.id} to result`
                  );
                  allClassifications.push(...element.classifications);
                }
              }

              // Extract unique classification systems and codes
              const uniqueClassifications = [];
              const seenCodes = new Set();

              for (const cls of allClassifications) {
                const key = `${cls.system}:${cls.code}`;
                if (!seenCodes.has(key) && cls.code) {
                  seenCodes.add(key);
                  uniqueClassifications.push(cls);
                }
              }

              // Log all classifications found for debugging
              console.log(
                `Found ${uniqueClassifications.length} unique classifications`
              );
              uniqueClassifications.forEach((cls) => {
                console.log(
                  `- ${cls.system}: ${cls.code} - ${cls.description || ""}`
                );
              });

              // Add to the result
              classificationResult.uniqueClassifications =
                uniqueClassifications;
              classificationResult.classificationCount =
                uniqueClassifications.length;

              // Group classifications by system for UI display
              const systemsMap = new Map();
              for (const cls of uniqueClassifications) {
                if (!systemsMap.has(cls.system)) {
                  systemsMap.set(cls.system, {
                    name: cls.system,
                    references: [],
                  });
                }

                systemsMap.get(cls.system).references.push({
                  id: cls.code,
                  name: cls.description || cls.code,
                });
              }

              // Update node data with classifications for display
              this.updateNodeDataInList(nodeId, {
                ...node.data,
                modelClassifications: Array.from(systemsMap.values()),
              });

              // Also add the full classification information to the result
              // for better display in watch nodes
              classificationResult.modelClassifications = Array.from(
                systemsMap.values()
              );
              classificationResult.systemsFound = Array.from(systemsMap.keys());

              // Format classifications in a descriptive way for display
              const formattedClassifications = uniqueClassifications.map(
                (cls) => ({
                  system: cls.system,
                  code: cls.code,
                  description: cls.description || cls.code,
                })
              );

              classificationResult.uniqueClassifications =
                formattedClassifications;
              classificationResult.type = "classifications";
            }

            result = classificationResult;
          } catch (error: any) {
            console.error(
              `Error processing classification node ${nodeId}:`,
              error
            );
            result = {
              elements: [],
              error: `Error processing classifications: ${
                error?.message || "Unknown error"
              }`,
            };
          }
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
        // Analysis
        if (!inputValues.input) {
          console.warn(`No input provided to analysis node ${nodeId}`);
          result = {};
        } else {
          result = performAnalysis(
            inputValues.input,
            inputValues.reference || [],
            node.data.properties?.analysisType || "clash",
            {
              tolerance: Number.parseFloat(
                node.data.properties?.tolerance || 10
              ),
              metric: node.data.properties?.metric || "area",
            }
          );
        }
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
        // Process data for viewer node
        console.log("Processing viewerNode", { node, inputValues });

        if (!inputValues || !inputValues.input) {
          console.log("No input provided to viewer node");
          result = null;
          break;
        }

        // Store input data in the node for rendering
        node.data.inputData = inputValues.input;

        // Viewer nodes pass through their input
        result = inputValues.input;
        break;

      case "spatialHierarchyNode":
        // Process spatial hierarchy node
        console.log("Processing spatialHierarchyNode", { node, inputValues });

        // If no input, create empty output
        if (!inputValues.input) {
          console.warn(`No input provided to spatial hierarchy node ${nodeId}`);
          result = {
            elements: [],
            spatialStructure: null,
            error: "No input provided. Connect an IFC node to this node.",
          };
          break;
        }

        // Extract elements from the input
        let elements = [];

        if (Array.isArray(inputValues.input)) {
          // Input is an array of elements
          elements = inputValues.input;
        } else if (
          inputValues.input.elements &&
          Array.isArray(inputValues.input.elements)
        ) {
          // Input is a model with elements array
          elements = inputValues.input.elements;

          // Store the model data
          node.data.inputData = {
            model: inputValues.input,
            elements: elements,
          };
        } else {
          console.warn(`Invalid input to spatial hierarchy node ${nodeId}`);
          result = {
            elements: [],
            spatialStructure: null,
            error: "Invalid input format. Make sure the input is an IFC model.",
          };
          break;
        }

        console.log(
          `SpatialHierarchyNode: Processing ${elements.length} elements`
        );

        // Extract proper containment structure
        const containmentStructures = extractContainmentStructure(elements);

        // Add containment information to elements
        containmentStructures.forEach((structure) => {
          const element = elements.find(
            (el: EnhancedIfcElement) =>
              el.properties?.GlobalId === structure.elementId
          );

          if (element) {
            element.containmentStructure = {
              building: structure.building,
              storey: structure.storey,
              space: structure.space,
            };

            // Set containedIn property for backward compatibility
            if (structure.storey) {
              element.containedIn = structure.storey.id;
            } else if (structure.building) {
              element.containedIn = structure.building.id;
            } else if (structure.space) {
              element.containedIn = structure.space.id;
            }
          }
        });

        // Find spatial elements
        const spatialTypes = [
          "IFCPROJECT",
          "IFCSITE",
          "IFCBUILDING",
          "IFCBUILDINGSTOREY",
          "IFCSPACE",
        ];

        const spatialElements = elements.filter((el: EnhancedIfcElement) =>
          spatialTypes.includes(el.type.toUpperCase())
        );

        // Mark spatial elements and set up hierarchy
        spatialElements.forEach((element: EnhancedIfcElement) => {
          element.isSpatial = true;

          // Set spatial level
          switch (element.type.toUpperCase()) {
            case "IFCPROJECT":
              element.spatialLevel = 0;
              break;
            case "IFCSITE":
              element.spatialLevel = 1;
              break;
            case "IFCBUILDING":
              element.spatialLevel = 2;
              break;
            case "IFCBUILDINGSTOREY":
              element.spatialLevel = 3;
              break;
            case "IFCSPACE":
              element.spatialLevel = 4;
              break;
          }
        });

        // Create spatial relationships using containment information
        const buildingSpatialMap: Record<string, string[]> = {};
        const storeySpatialMap: Record<string, string[]> = {};

        containmentStructures.forEach((structure) => {
          if (structure.building && structure.storey) {
            const buildingId = structure.building.id;
            const storeyId = structure.storey.id;

            // Add storey to building's children
            if (!buildingSpatialMap[buildingId]) {
              buildingSpatialMap[buildingId] = [];
            }
            if (!buildingSpatialMap[buildingId].includes(storeyId)) {
              buildingSpatialMap[buildingId].push(storeyId);
            }
          }

          if (structure.storey && structure.elementId) {
            const storeyId = structure.storey.id;

            // Add element to storey's children
            if (!storeySpatialMap[storeyId]) {
              storeySpatialMap[storeyId] = [];
            }
            if (!storeySpatialMap[storeyId].includes(structure.elementId)) {
              storeySpatialMap[storeyId].push(structure.elementId);
            }
          }
        });

        // Set spatial children
        for (const [buildingId, storeyIds] of Object.entries(
          buildingSpatialMap
        )) {
          const building = elements.find(
            (el: EnhancedIfcElement) => el.properties?.GlobalId === buildingId
          );

          if (building) {
            building.spatialChildren = storeyIds;
          }
        }

        for (const [storeyId, elementIds] of Object.entries(storeySpatialMap)) {
          const storey = elements.find(
            (el: EnhancedIfcElement) => el.properties?.GlobalId === storeyId
          );

          if (storey) {
            storey.spatialChildren = elementIds;
          }
        }

        // Gather statistics about the model
        const modelStructure = analyzeModelStructure(elements);

        console.log(
          "SpatialHierarchyNode processor: Model structure report",
          modelStructure
        );

        // Get node configuration
        const spatialType =
          node.data.properties?.spatialType || "IFCBUILDINGSTOREY";
        const spatialId = node.data.properties?.[spatialType.toLowerCase()];
        const elementType = node.data.properties?.elementType;

        console.log("SpatialHierarchyNode processor: Configuration", {
          spatialType,
          spatialId,
          elementType,
        });

        // Process according to configuration
        let outputElements: any[] = [];

        if (spatialId) {
          // If a specific spatial element is selected
          const selectedSpatial = elements.find(
            (el: EnhancedIfcElement) => el.id === spatialId
          );

          if (selectedSpatial && selectedSpatial.spatialChildren) {
            console.log(
              `SpatialHierarchyNode processor: Found selected ${spatialType} with ID ${spatialId}`
            );

            // Get all child elements
            outputElements = elements.filter(
              (el: EnhancedIfcElement) =>
                selectedSpatial.spatialChildren?.includes(el.id) ||
                selectedSpatial.spatialChildren?.includes(
                  el.properties?.GlobalId
                )
            );

            console.log(
              `SpatialHierarchyNode processor: Selected spatial element has ${outputElements.length} contained elements`
            );
          } else {
            console.log(
              `SpatialHierarchyNode processor: Selected spatial element not found or has no children`
            );
          }
        } else if (elementType) {
          // If an element type is selected
          console.log(
            `SpatialHierarchyNode processor: Using element type filter: ${elementType}`
          );
          outputElements = elements.filter(
            (el: EnhancedIfcElement) => el.type.toUpperCase() === elementType
          );
          console.log(
            `SpatialHierarchyNode processor: Found ${outputElements.length} elements of type ${elementType}`
          );
        } else {
          // No selection made, analyze model structure and make a best guess
          console.log(
            "SpatialHierarchyNode processor: No selection made - analyzing model structure"
          );

          if (
            modelStructure.spatialElements &&
            Object.keys(modelStructure.spatialElements).length > 0
          ) {
            // Model has spatial structure, use storeys by default
            const storeys = elements.filter(
              (el: EnhancedIfcElement) =>
                el.type.toUpperCase() === "IFCBUILDINGSTOREY"
            );

            if (storeys.length > 0) {
              console.log(
                `SpatialHierarchyNode processor: Found ${storeys.length} building storeys`
              );
              const firstStorey = storeys[0];

              if (
                firstStorey.spatialChildren &&
                firstStorey.spatialChildren.length > 0
              ) {
                outputElements = elements.filter(
                  (el: EnhancedIfcElement) =>
                    firstStorey.spatialChildren?.includes(el.id) ||
                    firstStorey.spatialChildren?.includes(
                      el.properties?.GlobalId
                    )
                );

                console.log(
                  `SpatialHierarchyNode processor: Using first storey with ${outputElements.length} elements`
                );
              }
            } else {
              // Try buildings if no storeys
              const buildings = elements.filter(
                (el: EnhancedIfcElement) =>
                  el.type.toUpperCase() === "IFCBUILDING"
              );

              if (buildings.length > 0) {
                console.log(
                  `SpatialHierarchyNode processor: No storeys found, using building with ${
                    buildings[0].spatialChildren?.length || 0
                  } children`
                );

                if (
                  buildings[0].spatialChildren &&
                  buildings[0].spatialChildren.length > 0
                ) {
                  outputElements = elements.filter(
                    (el: EnhancedIfcElement) =>
                      buildings[0].spatialChildren?.includes(el.id) ||
                      buildings[0].spatialChildren?.includes(
                        el.properties?.GlobalId
                      )
                  );
                }
              }
            }
          } else {
            // No spatial structure, analyze available element types
            const availableTypes = Object.keys(
              modelStructure.elementTypes || {}
            );
            console.log(
              "SpatialHierarchyNode processor: Available types",
              availableTypes
            );

            // If model only has walls, select all walls
            if (
              availableTypes.length === 1 &&
              availableTypes[0] === "IFCWALL"
            ) {
              console.log(
                "SpatialHierarchyNode processor: Simple IFC file with only walls detected"
              );

              const walls = elements.filter(
                (el: EnhancedIfcElement) => el.type.toUpperCase() === "IFCWALL"
              );

              // Do wall-specific analysis
              if (walls.length > 0) {
                console.log(
                  "SpatialHierarchyNode processor: Auto-selecting all wall elements"
                );
                outputElements = walls;

                // Analyze wall properties
                const wallAnalysis = analyzeWallElements(walls);
                console.log(
                  "SpatialHierarchyNode processor: Wall elements analysis",
                  wallAnalysis
                );
              }
            } else if (availableTypes.includes("IFCBUILDINGSTOREY")) {
              // Use the first storey if available
              const storey = elements.find(
                (el: EnhancedIfcElement) =>
                  el.type.toUpperCase() === "IFCBUILDINGSTOREY"
              );
              if (storey) {
                console.log(
                  "SpatialHierarchyNode processor: Using first building storey"
                );
                outputElements = [storey];
              }
            } else if (availableTypes.includes("IFCBUILDING")) {
              // Use the first building if available
              const building = elements.find(
                (el: EnhancedIfcElement) =>
                  el.type.toUpperCase() === "IFCBUILDING"
              );
              if (building) {
                console.log(
                  "SpatialHierarchyNode processor: Using first building"
                );
                outputElements = [building];
              }
            } else if (availableTypes.length > 0) {
              // Use the first available type
              const firstType = availableTypes[0];
              console.log(
                `SpatialHierarchyNode processor: Using first available type: ${firstType}`
              );
              outputElements = elements.filter(
                (el: EnhancedIfcElement) => el.type.toUpperCase() === firstType
              );
            }
          }
        }

        // Set node output
        result = {
          elements: outputElements,
          spatialStructure: {
            elements: spatialElements,
            containment: containmentStructures,
          },
          model: inputValues.model,
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

// Add these utility functions at the end of the file
function analyzeModelStructure(elements: EnhancedIfcElement[]) {
  // Count elements by type
  const typeCount: Record<string, number> = {};
  elements.forEach((el: EnhancedIfcElement) => {
    const type = el.type.toUpperCase();
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  // Find property sets
  const psetTypes = new Set<string>();
  elements.forEach((el: EnhancedIfcElement) => {
    if (el.psets) {
      Object.keys(el.psets).forEach((pset) => psetTypes.add(pset));
    }
  });

  // Analyze spatial structure elements
  const spatialElements = elements.filter((el) => el.isSpatial);
  const project = elements.find((el) => el.type.toUpperCase() === "IFCPROJECT");
  const sites = elements.filter((el) => el.type.toUpperCase() === "IFCSITE");
  const buildings = elements.filter(
    (el) => el.type.toUpperCase() === "IFCBUILDING"
  );
  const storeys = elements.filter(
    (el) => el.type.toUpperCase() === "IFCBUILDINGSTOREY"
  );
  const spaces = elements.filter((el) => el.type.toUpperCase() === "IFCSPACE");

  // Analyze building topology
  const buildingStructure: any = {
    project: project
      ? {
          id: project.id,
          name: project.properties?.Name || "Unnamed Project",
          children: project.spatialChildren || [],
        }
      : null,
    sites: sites.length,
    buildings: buildings.length,
    storeys: storeys.length,
    spaces: spaces.length,
  };

  // Analyze containment relationships
  const containmentMap: Record<string, string[]> = {};
  const elementsWithContainment = elements.filter((el) => el.containedIn);
  elementsWithContainment.forEach((el) => {
    if (el.containedIn) {
      if (!containmentMap[el.containedIn]) {
        containmentMap[el.containedIn] = [];
      }
      containmentMap[el.containedIn].push(el.id);
    }
  });

  return {
    elementCount: elements.length,
    elementTypes: typeCount,
    propertySetTypes: Array.from(psetTypes),
    spatialElements: {
      count: spatialElements.length,
      project: project?.id,
      sites: sites.map((site) => site.id),
      buildings: buildings.map((building) => building.id),
      storeys: storeys.map((storey) => storey.id),
      spaces: spaces.map((space) => space.id),
    },
    containmentMap,
    buildingStructure,
    hasSpatialStructure: spatialElements.length > 0,
  };
}

function analyzeWallElements(walls: EnhancedIfcElement[]) {
  // Skip if no walls
  if (!walls || walls.length === 0) return null;

  // Analyze wall properties
  const wallHeights = walls.map((wall) => {
    let height = null;

    // Try to find height in various property locations
    if (wall.properties && wall.properties.Height) {
      height = wall.properties.Height;
    } else if (wall.psets) {
      // Look in common property sets
      for (const psetName of Object.keys(wall.psets)) {
        const pset = wall.psets[psetName];
        if (pset.Height) {
          height = pset.Height;
          break;
        }
        if (pset.height) {
          height = pset.height;
          break;
        }
        if (pset.TotalHeight) {
          height = pset.TotalHeight;
          break;
        }
      }
    }

    // Look at geometry if available
    if (!height && wall.geometry && wall.geometry.dimensions) {
      height = wall.geometry.dimensions.z;
    }

    return {
      id: wall.id,
      height,
      name: wall.properties?.Name || wall.id,
      globalId: wall.properties?.GlobalId,
    };
  });

  // Count walls with found heights
  const wallsWithHeight = wallHeights.filter((w) => w.height !== null).length;

  // Find common psets in walls
  const psetFrequency: Record<string, number> = {};
  walls.forEach((wall) => {
    if (wall.psets) {
      Object.keys(wall.psets).forEach((pset) => {
        psetFrequency[pset] = (psetFrequency[pset] || 0) + 1;
      });
    }
  });

  return {
    count: walls.length,
    wallsWithHeightInfo: wallsWithHeight,
    commonPropertySets: psetFrequency,
    walls: wallHeights.slice(0, 3), // Only return first 3 walls for brevity
  };
}

// Add a proper containment extraction function based on the Python algorithm
function extractContainmentStructure(
  elements: EnhancedIfcElement[]
): Record<string, any>[] {
  console.log("Extracting containment structures for all elements...");

  // Create lookup maps for faster access
  const elementsById: Record<string, EnhancedIfcElement> = {};
  elements.forEach((el) => {
    if (el.properties?.GlobalId) {
      elementsById[el.properties.GlobalId] = el;
    } else if (el.id) {
      // Fallback to using element ID if GlobalId is missing
      elementsById[el.id] = el;
    }
  });

  // Find all relationship elements
  const relationshipElements = elements.filter((el) =>
    el.type.toUpperCase().startsWith("IFCREL")
  );

  // Find the spatial containment relationships
  const spatialRelationships = relationshipElements.filter(
    (rel) => rel.type.toUpperCase() === "IFCRELCONTAINEDINSPATIALSTRUCTURE"
  );
  console.log(
    `Found ${spatialRelationships.length} spatial containment relationships`
  );

  // Find the aggregation relationships
  const aggregationRelationships = relationshipElements.filter(
    (rel) => rel.type.toUpperCase() === "IFCRELAGGREGATES"
  );
  console.log(
    `Found ${aggregationRelationships.length} aggregation relationships`
  );

  // --- Function to find parent via IfcRelAggregates ---
  const findParentAggregate = (
    childId: string,
    targetParentType?: string
  ): EnhancedIfcElement | null => {
    for (const rel of aggregationRelationships) {
      const relatedObjects = Array.isArray(rel.properties?.RelatedObjects)
        ? rel.properties?.RelatedObjects
        : [rel.properties?.RelatedObjects];

      if (relatedObjects.includes(childId)) {
        const parentId = rel.properties?.RelatingObject;
        const parentElement = elementsById[parentId];
        if (parentElement) {
          if (
            !targetParentType ||
            parentElement.type.toUpperCase() === targetParentType
          ) {
            return parentElement;
          }
          // If target type specified but doesn't match, keep searching upwards
          // Note: This basic recursive search might need limits in complex models
          // return findParentAggregate(parentId, targetParentType);
        }
      }
    }
    return null;
  };
  // --- End of helper function ---

  // Process each element (excluding relationships) to find its containment structure
  const results: Record<string, any>[] = [];
  elements.forEach((element) => {
    // Skip relationship elements themselves
    if (element.type.toUpperCase().startsWith("IFCREL")) return;

    const elementId = element.properties?.GlobalId || element.id;
    if (!elementId) return;

    const structure: {
      elementId: string;
      building: any;
      storey: any;
      space: any;
    } = {
      elementId: elementId,
      building: null,
      storey: null,
      space: null,
    };

    // Find spatial relationships where this element is contained
    for (const rel of spatialRelationships) {
      const relatedElements = Array.isArray(rel.properties?.RelatedElements)
        ? rel.properties?.RelatedElements
        : [rel.properties?.RelatedElements];

      if (relatedElements.includes(elementId)) {
        const containerId = rel.properties?.RelatingStructure;
        const container = elementsById[containerId];

        if (!container) continue;

        const containerType = container.type.toUpperCase();

        if (containerType === "IFCBUILDINGSTOREY") {
          structure.storey = {
            id: container.properties?.GlobalId || container.id,
            name: container.properties?.Name,
            elevation: container.properties?.Elevation,
            description: container.properties?.Description,
          };
          // Find building via aggregation
          const building = findParentAggregate(containerId, "IFCBUILDING");
          if (building) {
            structure.building = {
              id: building.properties?.GlobalId || building.id,
              name: building.properties?.Name,
              description: building.properties?.Description,
            };
          }
          // Found direct container, break from this loop
          break;
        } else if (containerType === "IFCSPACE") {
          structure.space = {
            id: container.properties?.GlobalId || container.id,
            name: container.properties?.Name,
            description: container.properties?.Description,
          };
          // Find storey via aggregation
          const storey = findParentAggregate(containerId, "IFCBUILDINGSTOREY");
          if (storey) {
            structure.storey = {
              id: storey.properties?.GlobalId || storey.id,
              name: storey.properties?.Name,
              elevation: storey.properties?.Elevation,
              description: storey.properties?.Description,
            };
            // Find building via storey's aggregation
            const building = findParentAggregate(
              storey.properties?.GlobalId || storey.id,
              "IFCBUILDING"
            );
            if (building) {
              structure.building = {
                id: building.properties?.GlobalId || building.id,
                name: building.properties?.Name,
                description: building.properties?.Description,
              };
            }
          }
          // Found direct container, break from this loop
          break;
        } else if (containerType === "IFCBUILDING") {
          // Element directly contained in building? Less common but possible.
          structure.building = {
            id: container.properties?.GlobalId || container.id,
            name: container.properties?.Name,
            description: container.properties?.Description,
          };
          // Found direct container, break from this loop
          break;
        } else if (containerType === "IFCSITE") {
          // Element directly contained in site?
          // You might want to add site info or traverse up to project here
          break;
        }
      }
    }

    // Clean up nulls and add if we found some structure
    const finalStructure = {
      elementId: structure.elementId,
      building: structure.building,
      storey: structure.storey,
      space: structure.space,
    };

    if (
      finalStructure.building ||
      finalStructure.storey ||
      finalStructure.space
    ) {
      results.push(finalStructure);
    }
  });

  console.log(`Extracted ${results.length} containment structures`);
  return results;
}

// Update processSpatialHierarchyNode to use NodePair type
function processSpatialHierarchyNode(nodePair: NodePair): void {
  const { node, inputValues } = nodePair;

  console.log("Processing spatialHierarchyNode", { node, inputValues });

  // Ensure elements array exists before accessing it
  if (!inputValues.elements || !Array.isArray(inputValues.elements)) {
    console.log("SpatialHierarchyNode processor: No elements to process");
    return;
  }

  const elements: EnhancedIfcElement[] = inputValues.elements;
  console.log(
    `SpatialHierarchyNode processor: Processing ${elements.length} elements`
  );

  // Extract proper containment structure
  const containmentStructures = extractContainmentStructure(elements);

  // Add containment information to elements
  containmentStructures.forEach((structure) => {
    const element = elements.find(
      (el: EnhancedIfcElement) =>
        el.properties?.GlobalId === structure.elementId
    );

    if (element) {
      element.containmentStructure = {
        building: structure.building,
        storey: structure.storey,
        space: structure.space,
      };

      // Set containedIn property for backward compatibility
      if (structure.storey) {
        element.containedIn = structure.storey.id;
      } else if (structure.building) {
        element.containedIn = structure.building.id;
      } else if (structure.space) {
        element.containedIn = structure.space.id;
      }
    }
  });

  // Find spatial elements
  const spatialTypes = [
    "IFCPROJECT",
    "IFCSITE",
    "IFCBUILDING",
    "IFCBUILDINGSTOREY",
    "IFCSPACE",
  ];

  const spatialElements = elements.filter((el: EnhancedIfcElement) =>
    spatialTypes.includes(el.type.toUpperCase())
  );

  // Mark spatial elements and set up hierarchy
  spatialElements.forEach((element: EnhancedIfcElement) => {
    element.isSpatial = true;

    // Set spatial level
    switch (element.type.toUpperCase()) {
      case "IFCPROJECT":
        element.spatialLevel = 0;
        break;
      case "IFCSITE":
        element.spatialLevel = 1;
        break;
      case "IFCBUILDING":
        element.spatialLevel = 2;
        break;
      case "IFCBUILDINGSTOREY":
        element.spatialLevel = 3;
        break;
      case "IFCSPACE":
        element.spatialLevel = 4;
        break;
    }
  });

  // Create spatial relationships using containment information
  const buildingSpatialMap: Record<string, string[]> = {};
  const storeySpatialMap: Record<string, string[]> = {};

  containmentStructures.forEach((structure) => {
    if (structure.building && structure.storey) {
      const buildingId = structure.building.id;
      const storeyId = structure.storey.id;

      // Add storey to building's children
      if (!buildingSpatialMap[buildingId]) {
        buildingSpatialMap[buildingId] = [];
      }
      if (!buildingSpatialMap[buildingId].includes(storeyId)) {
        buildingSpatialMap[buildingId].push(storeyId);
      }
    }

    if (structure.storey && structure.elementId) {
      const storeyId = structure.storey.id;

      // Add element to storey's children
      if (!storeySpatialMap[storeyId]) {
        storeySpatialMap[storeyId] = [];
      }
      if (!storeySpatialMap[storeyId].includes(structure.elementId)) {
        storeySpatialMap[storeyId].push(structure.elementId);
      }
    }
  });

  // Set spatial children
  for (const [buildingId, storeyIds] of Object.entries(buildingSpatialMap)) {
    const building = elements.find(
      (el: EnhancedIfcElement) => el.properties?.GlobalId === buildingId
    );

    if (building) {
      building.spatialChildren = storeyIds;
    }
  }

  for (const [storeyId, elementIds] of Object.entries(storeySpatialMap)) {
    const storey = elements.find(
      (el: EnhancedIfcElement) => el.properties?.GlobalId === storeyId
    );

    if (storey) {
      storey.spatialChildren = elementIds;
    }
  }

  // Gather statistics about the model
  const modelStructure = analyzeModelStructure(elements);

  console.log(
    "SpatialHierarchyNode processor: Model structure report",
    modelStructure
  );

  // Get node configuration
  const spatialType = node.data.properties?.spatialType || "IFCBUILDINGSTOREY";
  const spatialId = node.data.properties?.[spatialType.toLowerCase()];
  const elementType = node.data.properties?.elementType;

  console.log("SpatialHierarchyNode processor: Configuration", {
    spatialType,
    spatialId,
    elementType,
  });

  // Process according to configuration
  let outputElements: any[] = [];

  if (spatialId) {
    // If a specific spatial element is selected
    const selectedSpatial = elements.find(
      (el: EnhancedIfcElement) => el.id === spatialId
    );

    if (selectedSpatial && selectedSpatial.spatialChildren) {
      console.log(
        `SpatialHierarchyNode processor: Found selected ${spatialType} with ID ${spatialId}`
      );

      // Get all child elements
      outputElements = elements.filter(
        (el: EnhancedIfcElement) =>
          selectedSpatial.spatialChildren?.includes(el.id) ||
          selectedSpatial.spatialChildren?.includes(el.properties?.GlobalId)
      );

      console.log(
        `SpatialHierarchyNode processor: Selected spatial element has ${outputElements.length} contained elements`
      );
    } else {
      console.log(
        `SpatialHierarchyNode processor: Selected spatial element not found or has no children`
      );
    }
  } else if (elementType) {
    // If an element type is selected
    console.log(
      `SpatialHierarchyNode processor: Using element type filter: ${elementType}`
    );
    outputElements = elements.filter(
      (el: EnhancedIfcElement) => el.type.toUpperCase() === elementType
    );
    console.log(
      `SpatialHierarchyNode processor: Found ${outputElements.length} elements of type ${elementType}`
    );
  } else {
    // No selection made, analyze model structure and make a best guess
    console.log(
      "SpatialHierarchyNode processor: No selection made - analyzing model structure"
    );

    if (
      modelStructure.spatialElements &&
      Object.keys(modelStructure.spatialElements).length > 0
    ) {
      // Model has spatial structure, use storeys by default
      const storeys = elements.filter(
        (el: EnhancedIfcElement) =>
          el.type.toUpperCase() === "IFCBUILDINGSTOREY"
      );

      if (storeys.length > 0) {
        console.log(
          `SpatialHierarchyNode processor: Found ${storeys.length} building storeys`
        );
        const firstStorey = storeys[0];

        if (
          firstStorey.spatialChildren &&
          firstStorey.spatialChildren.length > 0
        ) {
          outputElements = elements.filter(
            (el: EnhancedIfcElement) =>
              firstStorey.spatialChildren?.includes(el.id) ||
              firstStorey.spatialChildren?.includes(el.properties?.GlobalId)
          );

          console.log(
            `SpatialHierarchyNode processor: Using first storey with ${outputElements.length} elements`
          );
        }
      } else {
        // Try buildings if no storeys
        const buildings = elements.filter(
          (el: EnhancedIfcElement) => el.type.toUpperCase() === "IFCBUILDING"
        );

        if (buildings.length > 0) {
          console.log(
            `SpatialHierarchyNode processor: No storeys found, using building with ${
              buildings[0].spatialChildren?.length || 0
            } children`
          );

          if (
            buildings[0].spatialChildren &&
            buildings[0].spatialChildren.length > 0
          ) {
            outputElements = elements.filter(
              (el: EnhancedIfcElement) =>
                buildings[0].spatialChildren?.includes(el.id) ||
                buildings[0].spatialChildren?.includes(el.properties?.GlobalId)
            );
          }
        }
      }
    } else {
      // No spatial structure, analyze available element types
      const availableTypes = Object.keys(modelStructure.elementTypes || {});
      console.log(
        "SpatialHierarchyNode processor: Available types",
        availableTypes
      );

      // If model only has walls, select all walls
      if (availableTypes.length === 1 && availableTypes[0] === "IFCWALL") {
        console.log(
          "SpatialHierarchyNode processor: Simple IFC file with only walls detected"
        );

        const walls = elements.filter(
          (el: EnhancedIfcElement) => el.type.toUpperCase() === "IFCWALL"
        );

        // Do wall-specific analysis
        if (walls.length > 0) {
          console.log(
            "SpatialHierarchyNode processor: Auto-selecting all wall elements"
          );
          outputElements = walls;

          // Analyze wall properties
          const wallAnalysis = analyzeWallElements(walls);
          console.log(
            "SpatialHierarchyNode processor: Wall elements analysis",
            wallAnalysis
          );
        }
      } else if (availableTypes.includes("IFCBUILDINGSTOREY")) {
        // Use the first storey if available
        const storey = elements.find(
          (el: EnhancedIfcElement) =>
            el.type.toUpperCase() === "IFCBUILDINGSTOREY"
        );
        if (storey) {
          console.log(
            "SpatialHierarchyNode processor: Using first building storey"
          );
          outputElements = [storey];
        }
      } else if (availableTypes.includes("IFCBUILDING")) {
        // Use the first building if available
        const building = elements.find(
          (el: EnhancedIfcElement) => el.type.toUpperCase() === "IFCBUILDING"
        );
        if (building) {
          console.log("SpatialHierarchyNode processor: Using first building");
          outputElements = [building];
        }
      } else if (availableTypes.length > 0) {
        // Use the first available type
        const firstType = availableTypes[0];
        console.log(
          `SpatialHierarchyNode processor: Using first available type: ${firstType}`
        );
        outputElements = elements.filter(
          (el: EnhancedIfcElement) => el.type.toUpperCase() === firstType
        );
      }
    }
  }

  // Set node output
  node.data.outputData = {
    elements: outputElements,
    spatialStructure: {
      elements: spatialElements,
      containment: containmentStructures,
    },
    model: inputValues.model,
  };
}
