// IfcOpenShell integration for IFC data processing via Pyodide web worker
// Remove web-ifc imports as we're using pure IfcOpenShell now

// Define interfaces based on IfcOpenShell structure
export interface IfcElement {
  id: string;
  expressId: number;
  type: string;
  properties: Record<string, any>;
  geometry?: any;
  psets?: Record<string, any>;
  qtos?: Record<string, any>;
  propertyInfo?: {
    name: string;
    exists: boolean;
    value: any;
    psetName: string;
  };
  classifications?: Array<{
    system: string;
    code: string;
    description: string;
  }>;
  transformedGeometry?: {
    translation: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

export interface IfcModel {
  id: string;
  name: string;
  file?: any;
  schema?: string;
  project?: {
    GlobalId: string;
    Name: string;
    Description: string;
  };
  elementCounts?: Record<string, number>;
  totalElements?: number;
  elements: IfcElement[];
}

// Global reference to the last loaded model
let _lastLoadedModel: IfcModel | null = null;

// Cache for storing the original File objects of loaded IFC files
const ifcFileCache: Map<string, File> = new Map();

// Function to cache a File object
export function cacheIfcFile(file: File) {
  if (file && file.name) {
    if (!ifcFileCache.has(file.name)) {
      ifcFileCache.set(file.name, file);
      console.log(`Cached File object: ${file.name}`);
    }
  } else {
    console.warn("Attempted to cache an invalid File object.");
  }
}

// Function to get the last loaded model
export function getLastLoadedModel(): IfcModel | null {
  return _lastLoadedModel;
}

// Function to retrieve a stored File object
export function getIfcFile(fileName: string): File | null {
  return ifcFileCache.get(fileName) || null;
}

// Worker management
let ifcWorker: Worker | null = null;
let isWorkerInitialized = false;
let workerPromiseResolvers: Map<
  string,
  { resolve: Function; reject: Function }
> = new Map();
let workerMessageId = 0;

// Initialize the worker
export async function initializeWorker(): Promise<void> {
  if (isWorkerInitialized) {
    return;
  }

  try {
    console.log("Initializing IFC worker...");
    // Create worker
    ifcWorker = new Worker("/ifcWorker.js");

    // Add message handler
    ifcWorker.onmessage = (event) => {
      const { type, messageId, error, ...data } = event.data;

      console.log(`Worker message received: ${type}`, { messageId });

      // Handle different message types
      if (type === "error") {
        console.error("Worker error:", data.message, data.stack);
        // Resolve the corresponding promise
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers
            .get(messageId)!
            .reject(new Error(data.message));
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "initialized") {
        console.log("Worker initialized");
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve();
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "loadComplete") {
        console.log("IFC load complete with schema:", data.schema);
        if (messageId && workerPromiseResolvers.has(messageId)) {
          // Pass the complete model info object, not just a nested property
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "dataExtracted") {
        console.log(`Data extracted: ${data.elements.length} elements`);
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "ifcExported") {
        console.log(`IFC exported: ${data.fileName}`);
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "geometry") {
        console.log(
          `Geometry extracted: ${data.elements?.length || 0} elements`
        );
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data.elements || []);
          workerPromiseResolvers.delete(messageId);
        }
      }
      // Progress messages don't resolve promises
    };

    // Initialize the worker
    const messageId = `init_${Date.now()}`;
    await new Promise((resolve, reject) => {
      workerPromiseResolvers.set(messageId, { resolve, reject });
      ifcWorker!.postMessage({
        action: "init",
        messageId,
      });

      // Set a timeout for initialization
      setTimeout(() => {
        if (workerPromiseResolvers.has(messageId)) {
          console.error("Worker did not initialize within timeout period");
          reject(new Error("Worker initialization timed out"));
          workerPromiseResolvers.delete(messageId);
        }
      }, 30000); // 30 second timeout for initialization
    });

    isWorkerInitialized = true;
    console.log("Worker initialized successfully");
  } catch (err) {
    console.error("Error initializing worker:", err);
    throw new Error(
      `Failed to initialize worker: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

// Store raw IFC content for direct parsing when needed (used for classification extraction)
let _rawIfcContent: Map<string, string> = new Map();

// Function to store raw IFC content
export function storeRawIfcContent(fileName: string, content: string): void {
  if (fileName && content) {
    _rawIfcContent.set(fileName, content);
    console.log(
      `Stored raw IFC content for ${fileName}, length: ${content.length} chars`
    );
  }
}

// Function to get raw IFC content
export function getRawIfcContent(fileName: string): string | null {
  return _rawIfcContent.get(fileName) || null;
}

// Load an IFC file using IfcOpenShell via the worker
export async function loadIfcFile(
  file: File,
  onProgress?: (progress: number, message?: string) => void
): Promise<IfcModel> {
  console.log("Loading IFC file:", file.name);

  try {
    // Initialize the worker if needed
    await initializeWorker();
    console.log("Worker initialized for file load:", file.name);

    if (!ifcWorker) {
      throw new Error("IFC worker initialization failed");
    }

    // Set up a progress handler for this operation
    const progressHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === "progress" && onProgress) {
        onProgress(event.data.percentage, event.data.message);
      }
    };

    // Add the progress event listener
    ifcWorker.addEventListener("message", progressHandler);
    console.log("Added progress listener for file:", file.name);

    // Store the File object in the cache
    ifcFileCache.set(file.name, file);
    console.log(`Stored File object for ${file.name} in cache.`);

    // Try to read the file as text for raw IFC content storage
    // This is used for direct parsing of classifications
    try {
      const textReader = new FileReader();
      textReader.onload = (e) => {
        if (e.target?.result) {
          const content = e.target.result as string;
          storeRawIfcContent(file.name, content);
        }
      };
      textReader.readAsText(file);
    } catch (err) {
      console.warn("Could not read file as text for raw storage:", err);
    }

    // Read the file as ArrayBuffer - this instance will be transferred
    const arrayBuffer = await file.arrayBuffer();
    console.log(
      `File read as ArrayBuffer: ${file.name}, size: ${arrayBuffer.byteLength} bytes`
    );

    // Generate a unique message ID
    const messageId = `load_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log("Generated message ID for file load:", messageId);

    // Create a promise for this operation
    console.log("Sending loadIfc message to worker");
    const result = await new Promise((resolve, reject) => {
      workerPromiseResolvers.set(messageId, { resolve, reject });

      // Send the message to the worker
      ifcWorker!.postMessage(
        {
          action: "loadIfc",
          messageId,
          data: {
            arrayBuffer,
            filename: file.name,
          },
        },
        [arrayBuffer]
      ); // Transfer the arrayBuffer to avoid copying

      console.log("Message sent to worker with ID:", messageId);

      // Set a timeout to detect if the worker doesn't respond at all
      setTimeout(() => {
        if (workerPromiseResolvers.has(messageId)) {
          console.error("Worker did not respond within timeout period");
          reject(new Error("Worker did not respond within the timeout period"));
          workerPromiseResolvers.delete(messageId);
        }
      }, 30000); // 30 second timeout for initial response
    });

    console.log("Received loadIfc result:", result);

    // Set up a timeout to detect stalled processing
    const timeout = setTimeout(() => {
      const resolver = workerPromiseResolvers.get(messageId);
      if (resolver) {
        console.warn("IFC processing taking longer than expected.");
        // We don't reject, just warn
      }
    }, 60000); // 60 second timeout

    // The model info is directly in the result
    // Using 'as any' to bypass TypeScript type checking
    const modelInfo: any = result;

    // Clear the timeout
    clearTimeout(timeout);
    console.log("Received model info:", modelInfo);

    // Now request the detailed element data
    const messageId2 = `extract_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log("Starting element extraction with ID:", messageId2);

    const elementResult = await new Promise((resolve, reject) => {
      workerPromiseResolvers.set(messageId2, { resolve, reject });

      // Request all types that have at least one element
      const typesFromCounts = Object.entries(modelInfo.element_counts)
        .filter(([_, count]) => (count as number) > 0)
        .map(([type]) => type);

      // **Explicitly add relationship types needed for spatial hierarchy**
      const requiredRelationshipTypes = [
        "IfcRelContainedInSpatialStructure",
        "IfcRelAggregates",
        // Add other relevant relationship types if needed in the future
        // "IfcRelDefinesByProperties",
        // "IfcRelAssociatesMaterial"
      ];

      // Combine types from counts and required relationship types
      const typesToExtract = [
        ...new Set([...typesFromCounts, ...requiredRelationshipTypes]),
      ];

      console.log("Extracting element types:", typesToExtract);

      // Send the request with the combined types
      ifcWorker!.postMessage({
        action: "extractData",
        messageId: messageId2,
        data: { types: typesToExtract },
      });

      // Set a timeout to detect if the worker doesn't respond
      setTimeout(() => {
        if (workerPromiseResolvers.has(messageId2)) {
          console.error(
            "Worker did not respond to extractData within timeout period"
          );
          reject(
            new Error(
              "Worker did not respond to extractData within the timeout period"
            )
          );
          workerPromiseResolvers.delete(messageId2);
        }
      }, 30000); // 30 second timeout for element extraction
    });

    // Remove the progress event listener
    ifcWorker.removeEventListener("message", progressHandler);
    console.log("Progress listener removed");

    // Combine the information into our model structure
    const { elements } = elementResult as any;
    console.log(`Extracted ${elements.length} elements from IFC file`);

    const model: IfcModel = {
      id: `model-${Date.now()}`,
      name: file.name,
      file: file,
      schema: modelInfo.schema,
      project: modelInfo.project,
      elementCounts: modelInfo.element_counts,
      totalElements: modelInfo.total_elements,
      elements: elements,
    };

    console.log("Model created successfully:", {
      id: model.id,
      name: model.name,
      schema: model.schema,
      totalElements: model.totalElements,
      hasFileObject: !!model.file,
    });

    // Store as the last loaded model
    _lastLoadedModel = model;
    console.log(
      "Stored as last loaded model with",
      model.elements.length,
      "elements"
    );

    // Store the file object in the cache (redundant if already done, but safe)
    cacheIfcFile(file);

    return model;
  } catch (err) {
    console.error("Error loading IFC file:", err);
    throw new Error(
      `Failed to load IFC file: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

// Extract geometry from IFC elements (Standard method without GEOM worker)
export function extractGeometry(
  model: IfcModel,
  elementType = "all",
  includeOpenings = true
): IfcElement[] {
  console.log(
    `Extracting geometry (Standard): Type=${elementType}, Openings=${includeOpenings}, Input Elements=${
      model?.elements?.length || 0
    }`
  );

  // Ensure we have a model and elements to work with
  if (!model || !model.elements || model.elements.length === 0) {
    console.warn(
      "extractGeometry (Standard): Received model without elements, returning empty array."
    );
    return [];
  }

  // Filter elements by type
  let filteredElements = model.elements;
  if (elementType !== "all") {
    // Map user-friendly types to IFC types
    const typeMap: Record<string, string[]> = {
      walls: ["IFCWALL", "IFCWALLSTANDARDCASE"],
      slabs: ["IFCSLAB", "IFCROOF"],
      columns: ["IFCCOLUMN"],
      beams: ["IFCBEAM"],
      doors: ["IFCDOOR"],
      windows: ["IFCWINDOW"],
      stairs: ["IFCSTAIR", "IFCSTAIRFLIGHT"],
      furniture: ["IFCFURNISHINGELEMENT"],
      spaces: ["IFCSPACE"],
      openings: ["IFCOPENINGELEMENT"],
    };

    const targetTypes = typeMap[elementType]?.map((t) => t.toUpperCase()) || [];
    if (targetTypes.length > 0) {
      filteredElements = filteredElements.filter((element) =>
        targetTypes.includes(element.type.toUpperCase())
      );
    } else {
      console.warn(
        `extractGeometry (Standard): Unknown element type '${elementType}', processing all.`
      );
    }
  }

  // Filter openings if necessary
  if (!includeOpenings) {
    filteredElements = filteredElements.filter(
      (element) => !element.type.toUpperCase().includes("IFCOPENING")
    );
  }

  console.log(
    `Extracting geometry (Standard): Returning ${filteredElements.length} elements.`
  );
  return filteredElements;
}

// Extract geometry using simplified method (previously used IfcOpenShell GEOM module)
export async function extractGeometryWithGeom(
  model: IfcModel,
  elementType = "all",
  includeOpenings = true,
  onProgress?: (progress: number, message?: string) => void
): Promise<IfcElement[]> {
  console.log(
    `Extracting simplified geometry: Type=${elementType}, Openings=${includeOpenings}`
  );

  // Ensure we have a model
  if (!model || !model.file) {
    console.warn("extractGeometryWithGeom: No model or file provided");
    return [];
  }

  // Get the original File object from cache if available
  const file =
    typeof model.file === "string"
      ? getIfcFile(model.file)
      : (model.file as File);

  if (!file) {
    console.error("extractGeometryWithGeom: Could not retrieve file object");
    throw new Error("Could not retrieve IFC file for geometry extraction");
  }

  // Initialize worker if needed
  if (!ifcWorker) {
    await initializeWorker();
  }

  try {
    // Create unique message ID
    const messageId = `geom_${Date.now()}`;

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Setup promise for worker response
    const resultPromise = new Promise<IfcElement[]>((resolve, reject) => {
      workerPromiseResolvers.set(messageId, { resolve, reject });

      // Progress handler
      const progressHandler = (event: MessageEvent) => {
        const data = event.data;
        if (
          data.type === "progress" &&
          data.messageId === messageId &&
          onProgress
        ) {
          onProgress(data.percentage, data.message);
        }
      };

      // Add progress event listener
      ifcWorker!.addEventListener("message", progressHandler);

      // Set a timeout to detect if the worker doesn't respond
      const timeout = setTimeout(() => {
        if (workerPromiseResolvers.has(messageId)) {
          console.error(
            "Worker did not respond to geometry extraction within timeout period"
          );
          reject(
            new Error(
              "Worker did not respond to geometry extraction within the timeout period"
            )
          );
          workerPromiseResolvers.delete(messageId);
          ifcWorker!.removeEventListener("message", progressHandler);
        }
      }, 120000); // 2 minute timeout for geometry extraction

      // Clean up function
      const cleanup = () => {
        clearTimeout(timeout);
        ifcWorker!.removeEventListener("message", progressHandler);
        workerPromiseResolvers.delete(messageId);
      };

      // Set up resolver in a different scope to handle worker response
      workerPromiseResolvers.set(messageId, {
        resolve: (data: any) => {
          cleanup();
          resolve(data);
        },
        reject: (error: any) => {
          cleanup();
          reject(error);
        },
      });

      console.log("Sending geometry extraction request to worker", {
        messageId,
        elementType,
        includeOpenings,
        arrayBufferSize: arrayBuffer.byteLength,
      });

      // Send request to worker
      ifcWorker!.postMessage(
        {
          action: "extractGeometry",
          messageId,
          data: {
            elementType,
            includeOpenings,
            arrayBuffer,
          },
        },
        [arrayBuffer]
      );
    });

    // Wait for response
    const elements = await resultPromise;
    console.log(
      `extractGeometryWithGeom: Received ${elements.length} elements with geometry`
    );

    return elements;
  } catch (error) {
    console.error("Error extracting geometry with GEOM:", error);
    throw new Error(
      `Failed to extract geometry: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Filter elements by property
export function filterElements(
  elements: IfcElement[],
  property: string,
  operator: string,
  value: string
): IfcElement[] {
  console.log("Filtering elements:", property, operator, value);

  // Add a check for undefined or empty elements
  if (!elements || elements.length === 0) {
    console.warn("No elements to filter");
    return [];
  }

  return elements.filter((element) => {
    // Split property path (e.g., "Pset_WallCommon.FireRating")
    const propParts = property.split(".");

    if (propParts.length === 1) {
      // Direct property lookup
      let propValue = element.properties[property];
      if (propValue === undefined) return false;

      // Convert to string for comparison
      propValue = String(propValue);

      switch (operator) {
        case "equals":
          return propValue === value;
        case "contains":
          return propValue.includes(value);
        case "startsWith":
          return propValue.startsWith(value);
        case "endsWith":
          return propValue.endsWith(value);
        default:
          return false;
      }
    } else if (propParts.length === 2) {
      // Property set lookup (e.g., "Pset_WallCommon.FireRating")
      const [psetName, propName] = propParts;

      // Check in property sets
      if (element.psets && element.psets[psetName]) {
        let propValue = element.psets[psetName][propName];
        if (propValue === undefined) return false;

        // Convert to string for comparison
        propValue = String(propValue);

        switch (operator) {
          case "equals":
            return propValue === value;
          case "contains":
            return propValue.includes(value);
          case "startsWith":
            return propValue.startsWith(value);
          case "endsWith":
            return propValue.endsWith(value);
          default:
            return false;
        }
      }
      return false;
    }

    return false;
  });
}

// Transform elements (using geometric transformations)
export function transformElements(
  elements: IfcElement[],
  translation: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
): IfcElement[] {
  console.log("Transforming elements:", translation, rotation, scale);

  // Add a check for undefined or empty elements
  if (!elements || elements.length === 0) {
    console.warn("No elements to transform");
    return [];
  }

  // In a real implementation, we'd use IfcOpenShell to apply transformations
  // This would require creating a new IfcLocalPlacement with a transformation matrix

  // For now, just return a copy of the elements with transformation info
  return elements.map((element) => ({
    ...element,
    transformedGeometry: {
      translation,
      rotation,
      scale,
    },
  }));
}

// Quantity extraction functions
export function extractQuantities(
  elements: IfcElement[],
  quantityType = "area",
  groupBy = "none",
  unit = ""
): Record<string, number> {
  console.log("Extracting quantities:", quantityType, groupBy);

  // Add a check for undefined or empty elements
  if (!elements || elements.length === 0) {
    console.warn("No elements for quantity extraction");
    return { Total: 0 };
  }

  // Default units by quantity type
  const defaultUnits: Record<string, string> = {
    length: "m",
    area: "m²",
    volume: "m³",
    count: "",
    weight: "kg",
  };

  const finalUnit =
    unit || defaultUnits[quantityType as keyof typeof defaultUnits] || "";

  // Create groups for the results
  const groups: Record<string, number> = {};

  // If not grouping, just calculate total
  if (groupBy === "none") {
    let total = 0;

    elements.forEach((element) => {
      // Look for this quantity in the element's quantity sets
      if (element.qtos) {
        for (const qtoSet in element.qtos) {
          const qto = element.qtos[qtoSet];

          // Look for quantity properties based on quantityType
          let quantityValue = 0;

          switch (quantityType) {
            case "length":
              quantityValue =
                qto.Length || qto.Height || qto.Width || qto.Depth || 0;
              break;
            case "area":
              quantityValue =
                qto.Area ||
                qto.NetArea ||
                qto.GrossArea ||
                qto.NetFloorArea ||
                qto.GrossFloorArea ||
                0;
              break;
            case "volume":
              quantityValue =
                qto.Volume || qto.NetVolume || qto.GrossVolume || 0;
              break;
            case "weight":
              quantityValue =
                qto.Weight || qto.NetWeight || qto.GrossWeight || 0;
              break;
            case "count":
              quantityValue = 1; // Just count the elements
              break;
          }

          if (quantityValue) {
            total += Number(quantityValue);
            break; // Found a value, no need to check other qto sets
          }
        }
      } else {
        // If no quantity sets found, use default values
        const defaultValues: Record<string, number> = {
          length: 3.0,
          area: 10.0,
          volume: 8.0,
          weight: 500,
          count: 1,
        };

        total += defaultValues[quantityType as keyof typeof defaultValues] || 0;
      }
    });

    return { Total: parseFloat(total.toFixed(2)) };
  }

  // If grouping, calculate per group
  elements.forEach((element) => {
    let groupKey = "";

    // Determine group key based on groupBy parameter
    switch (groupBy) {
      case "type":
        groupKey = element.type.replace("IFC", "");
        break;
      case "material":
        // Look for material information in properties or psets
        if (element.properties.Material) {
          groupKey = element.properties.Material;
        } else if (element.psets && element.psets["Pset_MaterialCommon"]) {
          groupKey = element.psets["Pset_MaterialCommon"].Name || "Unknown";
        } else {
          groupKey = "Unknown Material";
        }
        break;
      case "level":
        // Look for level information
        if (element.properties.Level) {
          groupKey = element.properties.Level;
        } else if (element.properties.BuildingStorey) {
          groupKey = element.properties.BuildingStorey;
        } else {
          groupKey = "Unknown Level";
        }
        break;
      default:
        groupKey = "Unknown";
    }

    // Initialize group if not exists
    if (!groups[groupKey]) {
      groups[groupKey] = 0;
    }

    // Add to group total
    let quantityValue = 0;

    // Look for this quantity in the element's quantity sets
    if (element.qtos) {
      for (const qtoSet in element.qtos) {
        const qto = element.qtos[qtoSet];

        // Look for quantity properties based on quantityType
        switch (quantityType) {
          case "length":
            quantityValue =
              qto.Length || qto.Height || qto.Width || qto.Depth || 0;
            break;
          case "area":
            quantityValue = qto.Area || qto.NetArea || qto.GrossArea || 0;
            break;
          case "volume":
            quantityValue = qto.Volume || qto.NetVolume || qto.GrossVolume || 0;
            break;
          case "weight":
            quantityValue = qto.Weight || qto.NetWeight || qto.GrossWeight || 0;
            break;
          case "count":
            quantityValue = 1; // Just count the elements
            break;
        }

        if (quantityValue) {
          break; // Found a value, no need to check other qto sets
        }
      }
    }

    // If no quantity found, use defaults
    if (!quantityValue) {
      const defaultValues: Record<string, number> = {
        length: 3.0,
        area: 10.0,
        volume: 8.0,
        weight: 500,
        count: 1,
      };

      quantityValue =
        defaultValues[quantityType as keyof typeof defaultValues] || 0;
    }

    groups[groupKey] += Number(quantityValue);
  });

  // Round all values
  Object.keys(groups).forEach((key) => {
    groups[key] = parseFloat(groups[key].toFixed(2));
  });

  return groups;
}

// Function to manage properties on elements
export interface PropertyActions {
  action: string;
  propertyName: string;
  propertyValue?: any;
  targetPset?: string;
}

// More flexible properties management function that accepts an options object
export function manageProperties(
  elements: IfcElement[],
  options: PropertyActions
): IfcElement[] {
  const { action, propertyName, propertyValue, targetPset = "any" } = options;

  console.log(`Managing properties:`, {
    action,
    propertyName,
    propertyValue,
    targetPset,
  });

  // Debug the first element to understand structure
  if (elements && elements.length > 0) {
    console.log("First element structure:", {
      id: elements[0].id,
      type: elements[0].type,
      hasProperties: !!elements[0].properties,
      hasPsets: !!elements[0].psets,
      hasQtos: !!elements[0].qtos,
    });
  }

  // Check for undefined or empty elements
  if (!elements || elements.length === 0) {
    console.warn("No elements provided to manageProperties");
    return [];
  }

  // Make sure elements is an array
  if (!Array.isArray(elements)) {
    console.warn("Elements is not an array");
    return [];
  }

  // Handle empty property name
  if (!propertyName) {
    console.warn("No property name provided");
    return elements;
  }

  // Parse the property name to extract Pset if provided in format "Pset:Property"
  let actualPropertyName = propertyName;
  let explicitPset = "";

  if (propertyName.includes(":")) {
    const parts = propertyName.split(":");
    explicitPset = parts[0];
    actualPropertyName = parts[1];
  }

  // Determine the effective target Pset (explicit from propertyName overrides options.targetPset)
  const effectiveTargetPset = explicitPset || targetPset;

  // Create a new array to return
  return elements.map((element) => {
    // Clone the element to avoid modifying the original
    const updatedElement = { ...element };

    // Function to check if property exists and get its location and value
    const findProperty = (
      element: IfcElement,
      propName: string,
      psetName: string
    ): {
      exists: boolean;
      value: any;
      location: string;
      psetName: string;
    } => {
      // Initialize result
      const result = {
        exists: false,
        value: null,
        location: "",
        psetName: psetName !== "any" ? psetName : "",
      };

      // Special case for IsExternal property which might have different capitalizations
      const isExternalVariants = [
        "IsExternal",
        "isExternal",
        "ISEXTERNAL",
        "isexternal",
      ];
      const isCheckingIsExternal = isExternalVariants.includes(propName);

      // 1. First check in the specified property set if provided
      if (psetName !== "any" && element.psets && element.psets[psetName]) {
        // Direct check
        if (propName in element.psets[psetName]) {
          result.exists = true;
          result.value = element.psets[psetName][propName];
          result.location = "psets";
          return result;
        }

        // For IsExternal, check all variants
        if (isCheckingIsExternal) {
          for (const variant of isExternalVariants) {
            if (variant in element.psets[psetName]) {
              result.exists = true;
              result.value = element.psets[psetName][variant];
              result.location = "psets";
              result.psetName = psetName;
              return result;
            }
          }
        }
      }

      // 2. Check in direct properties at root level - often duplicate data
      if (element.properties) {
        // Direct check
        if (propName in element.properties) {
          result.exists = true;
          result.value = element.properties[propName];
          result.location = "properties";
          return result;
        }

        // For IsExternal, check all variants
        if (isCheckingIsExternal) {
          for (const variant of isExternalVariants) {
            if (variant in element.properties) {
              result.exists = true;
              result.value = element.properties[variant];
              result.location = "properties";
              return result;
            }
          }
        }
      }

      // 3. If target is "any", check all property sets
      if (psetName === "any" && element.psets) {
        for (const [setName, props] of Object.entries(element.psets)) {
          // Direct check in this pset
          if (propName in props) {
            result.exists = true;
            result.value = props[propName];
            result.location = "psets";
            result.psetName = setName;
            return result;
          }

          // For IsExternal, check all variants
          if (isCheckingIsExternal) {
            for (const variant of isExternalVariants) {
              if (variant in props) {
                result.exists = true;
                result.value = props[variant];
                result.location = "psets";
                result.psetName = setName;
                return result;
              }
            }
          }
        }
      }

      // 4. Check quantity sets too if targetPset is "any"
      if (psetName === "any" && element.qtos) {
        for (const [qtoName, quantities] of Object.entries(element.qtos)) {
          if (propName in quantities) {
            result.exists = true;
            result.value = quantities[propName];
            result.location = "qtos";
            result.psetName = qtoName;
            return result;
          }
        }
      }

      return result;
    };

    // Find the property
    const propertyResult = findProperty(
      element,
      actualPropertyName,
      effectiveTargetPset
    );

    // Handle the property based on the action
    switch (action.toLowerCase()) {
      case "get":
        // Store property information in the element
        updatedElement.propertyInfo = {
          name: actualPropertyName,
          exists: propertyResult.exists,
          value: propertyResult.value,
          psetName: propertyResult.psetName,
        };
        break;

      case "set":
      case "add":
        // Set or add the property
        if (element.properties) {
          // Always update the direct properties for convenient access
          element.properties[actualPropertyName] = propertyValue;
        }

        // Determine where to store the property
        if (effectiveTargetPset !== "any") {
          // Make sure psets exists
          if (!element.psets) {
            element.psets = {};
          }

          // Make sure the target pset exists
          if (!element.psets[effectiveTargetPset]) {
            element.psets[effectiveTargetPset] = {};
          }

          // Add the property to the target pset
          element.psets[effectiveTargetPset][actualPropertyName] =
            propertyValue;
        }

        // Store property info for UI feedback
        updatedElement.propertyInfo = {
          name: actualPropertyName,
          exists: true,
          value: propertyValue,
          psetName:
            effectiveTargetPset !== "any" ? effectiveTargetPset : "properties",
        };
        break;

      case "remove":
        // Remove the property
        let removed = false;

        // Remove from direct properties
        if (element.properties && actualPropertyName in element.properties) {
          delete element.properties[actualPropertyName];
          removed = true;
        }

        // If a specific pset is targeted, only remove from there
        if (effectiveTargetPset !== "any") {
          if (
            element.psets?.[effectiveTargetPset]?.[actualPropertyName] !==
            undefined
          ) {
            delete element.psets[effectiveTargetPset][actualPropertyName];
            removed = true;
          }
        } else {
          // Otherwise remove from all psets
          if (element.psets) {
            for (const psetName in element.psets) {
              if (actualPropertyName in element.psets[psetName]) {
                delete element.psets[psetName][actualPropertyName];
                removed = true;
              }
            }
          }
        }

        // Also clean up qtos
        if (effectiveTargetPset === "any" && element.qtos) {
          for (const qtoName in element.qtos) {
            if (actualPropertyName in element.qtos[qtoName]) {
              delete element.qtos[qtoName][actualPropertyName];
              removed = true;
            }
          }
        }

        // Store property info for UI feedback
        updatedElement.propertyInfo = {
          name: actualPropertyName,
          exists: false,
          value: null,
          psetName: propertyResult.psetName,
        };
        break;

      default:
        console.warn(`Unknown action: ${action}`);
    }

    return updatedElement;
  });
}

// Classification functions
export function manageClassifications(
  elements: IfcElement[] | any,
  system = "uniclass",
  action = "get",
  code = ""
): IfcElement[] {
  console.log("Managing classifications:", system, action, code);

  // Ensure elements is an array
  let elementArray: IfcElement[] = [];

  if (Array.isArray(elements)) {
    elementArray = elements;
  } else if (
    elements &&
    elements.elements &&
    Array.isArray(elements.elements)
  ) {
    // Handle case where elements is an object with an elements array property
    elementArray = elements.elements;
  } else {
    console.warn("No valid elements for classification management");
    return [];
  }

  if (elementArray.length === 0) {
    console.warn("Empty elements array for classification management");
    return [];
  }

  // Define standard classification systems
  const systemNames: Record<string, string> = {
    uniclass: "Uniclass 2015",
    uniformat: "Uniformat II",
    masterformat: "MasterFormat 2016",
    omniclass: "OmniClass",
    cobie: "COBie",
    custom: "Custom Classification",
  };

  const systemName = systemNames[system as keyof typeof systemNames] || system;

  if (action === "get") {
    console.log(
      `Searching for classifications in ${elementArray.length} elements`
    );

    // Debug: Log the structure of the first element to understand its properties
    if (elementArray.length > 0) {
      const sampleElement = elementArray[0];
      console.log("Sample element structure for classification detection:", {
        id: sampleElement.id,
        type: sampleElement.type,
        hasProperties: !!sampleElement.properties,
        propertiesKeys: sampleElement.properties
          ? Object.keys(sampleElement.properties)
          : [],
        hasPsets: !!sampleElement.psets,
        psetKeys: sampleElement.psets ? Object.keys(sampleElement.psets) : [],
        hasAssociations: !!(
          sampleElement.properties && sampleElement.properties.HasAssociations
        ),
      });
    }

    // Return elements with classification information if present
    return elementArray.map((element) => {
      const enhancedElement = { ...element };

      // Look for classifications in properties or psets
      let classifications = [];

      // Check in direct properties
      if (element.properties && element.properties.Classification) {
        // Handle single classification object
        if (
          typeof element.properties.Classification === "object" &&
          !Array.isArray(element.properties.Classification)
        ) {
          classifications.push({
            system: element.properties.Classification.System || "Unknown",
            code:
              element.properties.Classification.Code ||
              element.properties.Classification.ItemReference ||
              "",
            description:
              element.properties.Classification.Description ||
              element.properties.Classification.Name ||
              "",
          });
        }
        // Handle array of classifications
        else if (Array.isArray(element.properties.Classification)) {
          for (const cls of element.properties.Classification) {
            classifications.push({
              system: cls.System || "Unknown",
              code: cls.Code || cls.ItemReference || "",
              description: cls.Description || cls.Name || "",
            });
          }
        }
      }

      // Check for specific classification property in direct properties
      if (element.properties) {
        const classificationPropNames = [
          "ClassificationCode",
          "ClassificationSystem",
          "ClassificationReference",
          "IfcClassificationReference",
        ];

        for (const propName of classificationPropNames) {
          if (element.properties[propName]) {
            classifications.push({
              system: element.properties.ClassificationSystem || "Unknown",
              code: element.properties[propName],
              description: element.properties.ClassificationDescription || "",
            });
            break;
          }
        }
      }

      // Check in property sets
      if (element.psets) {
        // Check for Pset_ClassificationReference or similar
        const classificationPsets = Object.keys(element.psets).filter(
          (pset) =>
            pset.includes("Classification") ||
            pset.includes("IfcClassification")
        );

        for (const pset of classificationPsets) {
          classifications.push({
            system:
              element.psets[pset].System ||
              element.psets[pset].Name ||
              "Unknown",
            code:
              element.psets[pset].Code ||
              element.psets[pset].ItemReference ||
              element.psets[pset].Identification ||
              "",
            description: element.psets[pset].Description || "",
          });
        }
      }

      // IMPROVED: Check for IfcRelAssociatesClassification in HasAssociations similar to Python script
      if (element.properties && element.properties.HasAssociations) {
        console.log(
          `Element ${element.id} (${element.type}) has HasAssociations property`
        );

        const associations = Array.isArray(element.properties.HasAssociations)
          ? element.properties.HasAssociations
          : [element.properties.HasAssociations];

        // Log the first association to understand structure
        if (associations.length > 0) {
          console.log("First association structure:", associations[0]);
        }

        for (const assoc of associations) {
          // Check if association is IfcRelAssociatesClassification
          const isClassAssoc =
            (assoc.type &&
              assoc.type.includes("IfcRelAssociatesClassification")) ||
            (assoc.is_a &&
              typeof assoc.is_a === "function" &&
              assoc.is_a("IfcRelAssociatesClassification")) ||
            (assoc.properties &&
              assoc.properties.type === "IfcRelAssociatesClassification");

          if (isClassAssoc || (assoc && assoc.RelatingClassification)) {
            console.log("Found classification association");

            // Find the RelatingClassification based on structure
            const relatingCls =
              assoc.RelatingClassification ||
              (assoc.properties && assoc.properties.RelatingClassification);

            if (relatingCls) {
              console.log("Classification reference found:", relatingCls);

              // Extract relevant information
              const systemName =
                (relatingCls.ReferencedSource &&
                  relatingCls.ReferencedSource.Name) ||
                relatingCls.Name ||
                "Unknown";

              // Handle both IFC2X3 and IFC4 schemas
              const code =
                relatingCls.ItemReference || // IFC2X3
                relatingCls.Identification || // IFC4
                "";

              const description = relatingCls.Description || "";

              classifications.push({
                system: systemName,
                code: code,
                description: description,
              });

              console.log(
                `Added classification - System: ${systemName}, Code: ${code}`
              );
            }
          }
        }
      }

      // If we found classifications, log them
      if (classifications.length > 0) {
        console.log(
          `Found ${classifications.length} classifications for element ${element.id} (${element.type})`
        );
      }

      enhancedElement.classifications = classifications;
      return enhancedElement;
    });
  }

  // Set classification
  return elementArray.map((element) => {
    const newElement = { ...element };

    // First, check if we have psets
    if (!newElement.psets) {
      newElement.psets = {};
    }

    // Create or update the classification property set
    const psetName = "Pset_ClassificationReference";

    newElement.psets[psetName] = {
      ...newElement.psets[psetName],
      System: systemName,
      Code: code,
      Name: systemName,
      ItemReference: code,
      Description: `${systemName} classification ${code}`,
    };

    // Also update direct properties for easier access
    newElement.properties = {
      ...newElement.properties,
      Classification: {
        System: systemName,
        Code: code,
      },
    };

    return newElement;
  });
}

// Spatial query functions
export function spatialQuery(
  elements: IfcElement[],
  referenceElements: IfcElement[],
  queryType = "contained",
  distance = 1.0
): IfcElement[] {
  console.log("Spatial query:", queryType, distance);

  if (!elements || elements.length === 0) {
    console.warn("No elements for spatial query");
    return [];
  }

  if (!referenceElements || referenceElements.length === 0) {
    console.warn("No reference elements for spatial query");
    return [];
  }

  // NOTE: In a real implementation, we would use IfcOpenShell to perform spatial calculations
  // This would involve extracting geometry and using computational geometry algorithms

  // For demonstration, we'll simulate spatial relationships
  switch (queryType) {
    case "contained":
      // Find elements contained within reference elements
      // This would require bounding box comparisons in a real implementation
      return elements.filter((element) => {
        // Simple simulation: check if the element has a containment relationship
        // This is just a placeholder - real implementation would check geometric containment
        return element.properties.ContainedIn === referenceElements[0].id;
      });

    case "containing":
      // Find elements that contain reference elements
      return elements.filter((element) => {
        // This is just a placeholder - real implementation would check geometric containment
        return referenceElements.some(
          (ref) => ref.properties.ContainedIn === element.id
        );
      });

    case "intersecting":
      // Find elements that intersect with reference elements
      // This would require collision detection in a real implementation
      return elements.filter(() => {
        // This is just a placeholder - real implementation would check geometric intersection
        // Randomly select about 30% of elements for demonstration
        return Math.random() < 0.3;
      });

    case "touching":
      // Find elements that touch reference elements
      // This would require adjacency detection in a real implementation
      return elements.filter(() => {
        // This is just a placeholder - real implementation would check for adjacency
        // Randomly select about 20% of elements for demonstration
        return Math.random() < 0.2;
      });

    case "within-distance":
      // Find elements within a certain distance of reference elements
      // This would require distance calculation in a real implementation
      return elements.filter(() => {
        // This is just a placeholder - real implementation would check distances
        // Simulate that more elements are included as distance increases
        const normalized = Math.min(1, distance / 10);
        return Math.random() < normalized;
      });

    default:
      console.warn(`Unknown spatial query type: ${queryType}`);
      return [];
  }
}

// Relationship query functions
export function queryRelationships(
  elements: IfcElement[],
  relationType = "containment",
  direction = "outgoing"
): IfcElement[] {
  console.log("Relationship query:", relationType, direction);

  if (!elements || elements.length === 0) {
    console.warn("No elements for relationship query");
    return [];
  }

  // Define valid relationship types for type checking
  const validRelationTypes = [
    "containment",
    "aggregation",
    "voiding",
    "material",
    "space-boundary",
    "connectivity",
  ];

  // Use a safe relationType or default to containment
  const safeRelationType = validRelationTypes.includes(relationType)
    ? relationType
    : "containment";

  // NOTE: In a real implementation, we would use IfcOpenShell to traverse relationships

  // This is a placeholder - in reality we would check actual relationships
  // For now, we'll return a subset of elements based on the relationship type

  // In a real implementation, you'd do something like:
  /*
  if (direction === "outgoing") {
    return elements.flatMap(element => {
      // Get related elements from the IFC model based on relationship type
      // Code would use the IfcOpenShell API to get related elements
    });
  } else {
    // Similar for incoming relationships
  }
  */

  // For demo purposes, just return a subset of elements
  // In reality, you would query the actual relationships in the IFC model
  const ratio = 0.5; // Default ratio
  return elements.slice(0, Math.floor(elements.length * ratio));
}

// Analysis functions
export function performAnalysis(
  elements: IfcElement[],
  referenceElements: IfcElement[] = [],
  analysisType = "clash",
  options: Record<string, any> = {}
): any {
  console.log("Performing analysis:", analysisType, options);

  if (!elements || elements.length === 0) {
    console.warn("No elements for analysis");
    return { error: "No elements to analyze" };
  }

  // NOTE: In a real implementation, we would use IfcOpenShell plus additional libraries
  // for specific analysis types (clash detection, spatial analysis, etc.)

  switch (analysisType) {
    case "clash":
      // Clash detection would use geometric intersection tests
      // This is a placeholder implementation
      if (referenceElements.length === 0) {
        return { error: "No reference elements for clash detection" };
      }

      const tolerance = Number(options.tolerance) || 10;
      const clashes = [];

      // In a real implementation, we would check for geometric intersections
      // For now, simulate clash detection with random data
      for (let i = 0; i < Math.min(20, elements.length); i++) {
        const randomRefIndex = Math.floor(
          Math.random() * referenceElements.length
        );

        if (Math.random() < 0.3) {
          // 30% chance of clash
          clashes.push({
            id: `clash-${i}`,
            element1: elements[i],
            element2: referenceElements[randomRefIndex],
            distance: (Math.random() * tolerance) / 2, // Random distance within tolerance
            point: {
              x: Math.random() * 10,
              y: Math.random() * 10,
              z: Math.random() * 3,
            },
          });
        }
      }

      return {
        clashCount: clashes.length,
        clashes: clashes,
        tolerance: tolerance,
      };

    case "adjacency":
      // Adjacency analysis would check for elements that are adjacent to each other
      // In a real implementation, we would use computational geometry

      const adjacencyResults = elements.map((element) => {
        // In reality, you'd check which elements are actually adjacent
        const adjacentCount = Math.floor(1 + Math.random() * 3);

        // Get random adjacent elements
        const adjacentElements = [];
        for (let i = 0; i < adjacentCount; i++) {
          const randomIndex = Math.floor(Math.random() * elements.length);
          if (elements[randomIndex].id !== element.id) {
            adjacentElements.push(elements[randomIndex]);
          }
        }

        return {
          element: element,
          adjacentElements: adjacentElements,
          adjacentCount: adjacentElements.length,
        };
      });

      return {
        totalElements: elements.length,
        adjacencyResults: adjacencyResults,
        averageAdjacency:
          adjacencyResults.reduce((sum, r) => sum + r.adjacentCount, 0) /
          elements.length,
      };

    case "spatial":
      // Spatial analysis checks space utilization, occupancy, etc.
      const metric = options.metric || "area";

      // Calculate areas (in a real app, would extract from IFC)
      let totalArea = 0;
      let totalVolume = 0;

      elements.forEach((element) => {
        // Look for area and volume in quantity sets
        if (element.qtos) {
          for (const qtoSet in element.qtos) {
            const qto = element.qtos[qtoSet];

            if (qto.Area || qto.NetArea || qto.GrossArea) {
              totalArea += Number(qto.Area || qto.NetArea || qto.GrossArea);
            }

            if (qto.Volume || qto.NetVolume || qto.GrossVolume) {
              totalVolume += Number(
                qto.Volume || qto.NetVolume || qto.GrossVolume
              );
            }
          }
        } else {
          // Use defaults if no quantity info
          if (element.type.includes("IFCSPACE")) {
            totalArea += 20; // Default space area
            totalVolume += 60; // Default space volume
          }
        }
      });

      // Format results based on requested metric
      if (metric === "area") {
        return {
          totalArea: parseFloat(totalArea.toFixed(2)),
          areaPerElement: parseFloat((totalArea / elements.length).toFixed(2)),
        };
      } else if (metric === "volume") {
        return {
          totalVolume: parseFloat(totalVolume.toFixed(2)),
          volumePerElement: parseFloat(
            (totalVolume / elements.length).toFixed(2)
          ),
        };
      } else if (metric === "occupancy") {
        // Estimate occupancy (1 person per 10m²)
        const occupancy = Math.floor(totalArea / 10);
        return {
          occupancy,
          density: parseFloat((occupancy / totalArea).toFixed(4)),
        };
      }

      return { error: "Unknown spatial metric" };

    case "path":
      // Path finding analysis (would use a graph algorithm in real implementation)
      return {
        pathLength: 42.5,
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 20, z: 0 },
          { x: 30, y: 20, z: 0 },
        ],
      };

    default:
      return { error: "Unknown analysis type" };
  }
}

// Export functions
export function exportData(
  elementsInput: IfcElement[] | { elements: IfcElement[] },
  format = "csv",
  fileName = "export",
  properties = "Name,Type,Material"
): string | Promise<void> {
  console.log("Exporting data:", format, fileName, properties);

  // If format is IFC, dispatch an event to handle export in main thread
  if (format.toLowerCase() === "ifc") {
    const sourceModel = getLastLoadedModel(); // Get the originally loaded model
    if (!sourceModel || !sourceModel.name) {
      console.error(
        "Cannot export IFC: Source model or its name not found. Please load a file first."
      );
      return Promise.reject("Cannot export IFC: Source model not found.");
    }

    // Extract elements, handling both array and model object inputs
    let elementsToUse: IfcElement[];
    if (Array.isArray(elementsInput)) {
      elementsToUse = elementsInput;
    } else if (elementsInput && elementsInput.elements) {
      elementsToUse = elementsInput.elements;
    } else {
      console.error("Cannot export IFC: Invalid input data structure.");
      return Promise.reject("Cannot export IFC: Invalid input data.");
    }

    // Log the number of elements and their properties for debugging
    console.log("Exporting IFC with elements:", {
      count: elementsToUse.length,
      sampleElement: elementsToUse[0],
      properties: elementsToUse[0]?.properties,
      psets: elementsToUse[0]?.psets,
      classifications: elementsToUse[0]?.classifications,
    });

    // Create the model object containing the potentially modified elements
    // but crucially retain the original model's metadata like ID and NAME for lookup purposes
    const modelDataForWorker: IfcModel = {
      ...sourceModel, // Include original metadata like id, name, schema, project
      elements: elementsToUse, // Use the potentially modified elements
    };

    // Dispatch an event to trigger the export process in the main thread
    // Pass BOTH the desired export filename AND the original filename for buffer lookup
    console.log(
      `Dispatching ifc:export event for ${fileName}.ifc (original: ${sourceModel.name})`
    );
    window.dispatchEvent(
      new CustomEvent("ifc:export", {
        detail: {
          model: modelDataForWorker, // Send the potentially modified element data wrapped with original metadata
          exportFileName: `${fileName}.ifc`, // The name the user wants for the downloaded file
          originalFileName: sourceModel.name, // The name of the file loaded initially (used for buffer cache lookup)
        },
      })
    );
    return Promise.resolve(); // Indicate async operation
  }

  // For other formats (CSV, JSON), process the data here
  // Extract elements if input is a model object
  const elements = Array.isArray(elementsInput)
    ? elementsInput
    : elementsInput.elements;

  if (!elements || elements.length === 0) {
    console.warn(`No elements provided to exportData for format ${format}`);
    return format === "json" ? "[]" : ""; // Return empty array for JSON, empty string for CSV
  }

  // Get headers from properties string or first element
  const headers = properties
    ? properties.split(",").map((h) => h.trim())
    : Object.keys(elements[0]?.properties || {});

  if (format === "json") {
    // Export as JSON
    const data = elements.map((element) => {
      const row: Record<string, any> = {};
      headers.forEach((header) => {
        // Handle nested properties (e.g., Pset_WallCommon.IsExternal)
        const parts = header.split(".");
        if (parts.length === 1) {
          row[header] = element.properties[header];
        } else if (
          parts.length === 2 &&
          element.psets &&
          element.psets[parts[0]]
        ) {
          row[header] = element.psets[parts[0]][parts[1]];
        }
      });
      return row;
    });
    return JSON.stringify(data, null, 2);
  } else {
    // Export as CSV
    // Header row
    let csvContent = headers.join(",") + "\n";

    // Data rows
    elements.forEach((element) => {
      const row = headers
        .map((header) => {
          let value = "";
          // Handle nested properties (e.g., Pset_WallCommon.IsExternal)
          const parts = header.split(".");
          if (parts.length === 1) {
            value = element.properties[header];
          } else if (
            parts.length === 2 &&
            element.psets &&
            element.psets[parts[0]]
          ) {
            value = element.psets[parts[0]][parts[1]];
          }

          // Format value for CSV (handle commas, quotes, newlines)
          const strValue = String(
            value === undefined || value === null ? "" : value
          );
          if (
            strValue.includes(",") ||
            strValue.includes('"') ||
            strValue.includes("\n")
          ) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        })
        .join(",");
      csvContent += row + "\n";
    });

    return csvContent;
  }
}
