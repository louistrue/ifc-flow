// IfcOpenShell integration for IFC data processing via Pyodide web worker
import {
  Scene,
  Mesh,
  MeshStandardMaterial,
  BufferGeometry,
  BufferAttribute,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

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
    System: string;
    Code: string;
    Description: string;
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
  sqliteDb?: string; // Path to SQLite database file
  sqliteSuccess?: boolean; // Whether SQLite creation was successful
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
    }
  }
}

// Function to get the last loaded model
export function getLastLoadedModel(): IfcModel | null {
  return _lastLoadedModel;
}

// Function to set the last loaded model (for debugging/testing)
export function setLastLoadedModel(model: IfcModel | null): void {
  _lastLoadedModel = model;
}

// Function to retrieve a stored File object
export function getIfcFile(fileName: string): File | null {
  return ifcFileCache.get(fileName) || null;
}

// Get a list of unique property names available in the given model
// If no model is provided, uses the last loaded model
export function getModelPropertyNames(model?: IfcModel): string[] {
  const current = model || getLastLoadedModel();
  if (!current) return [];

  const props = new Set<string>();

  current.elements.forEach((el) => {
    if (el.properties) {
      Object.keys(el.properties).forEach((p) => props.add(p));
    }

    if (el.psets) {
      for (const pset in el.psets) {
        const psetProps = el.psets[pset];
        for (const prop in psetProps) {
          props.add(`${pset}.${prop}`);
        }
      }
    }
  });

  return Array.from(props).sort();
}

// Worker management
let ifcWorker: Worker | null = null;
let isWorkerInitialized = false;
const workerPromiseResolvers: Map<
  string,
  { resolve: Function; reject: Function }
> = new Map();
const workerMessageId = 0;

// SQLite warm-up status and events
type WarmStatus = 'idle' | 'warming' | 'ready' | 'error' | 'building' | 'unknown';
const sqliteWarmStatus = new Map<string, WarmStatus>();
export function getSqliteWarmStatus(model: IfcModel): WarmStatus {
  return sqliteWarmStatus.get(model.id) || 'idle';
}
function dispatchWarmStatus(modelId: string, status: WarmStatus, extra?: any) {
  try {
    window.dispatchEvent(new CustomEvent('sqlite:warm-status', { detail: { modelId, status, ...extra } }));
  } catch { }
}

// Initialize the worker
export async function initializeWorker(): Promise<void> {
  if (isWorkerInitialized) {
    return;
  }

  try {

    // Guard: only create Web Worker in browser context
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      throw new Error('Worker is not defined');
    }
    // Create worker
    ifcWorker = new Worker("/ifcWorker.js");

    // Add message handler
    ifcWorker.onmessage = (event) => {
      const { type, messageId, error, ...data } = event.data;



      // Handle different message types
      if (type === "error") {

        // Resolve the corresponding promise
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers
            .get(messageId)!
            .reject(new Error(data.message));
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "initialized") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve();
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "loadComplete") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          // Pass the complete model info object, not just a nested property
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "dataExtracted") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "ifcExported") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "geometry") {
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data.elements || []);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "extractQuantities") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "quantityResults") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data.data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "pythonResult") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data.result);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "sqliteResult") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data.result);
          workerPromiseResolvers.delete(messageId);
        }
        // A successful query implies the DB is open in sql.js → mark as ready
        try {
          const model = getLastLoadedModel();
          if (model) {
            sqliteWarmStatus.set(model.id, 'ready');
            dispatchWarmStatus(model.id, 'ready');
            window.dispatchEvent(new CustomEvent('sqlite:ready', { detail: { modelId: model.id } }));
          }
        } catch { }
      } else if (type === "sqliteExport") {

        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data.bytes);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "sqliteBuilt") {
        // DB bytes persisted; notify UI listeners of warm/build status
        const model = getLastLoadedModel();
        if (model) {
          sqliteWarmStatus.set(model.id, 'warming');
          dispatchWarmStatus(model.id, 'warming');
        }
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve(data);
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "sqliteWarmed") {
        const model = getLastLoadedModel();
        if (model) {
          sqliteWarmStatus.set(model.id, 'ready');
          dispatchWarmStatus(model.id, 'ready', { tableCount: data.tableCount });
        }
        if (messageId && workerPromiseResolvers.has(messageId)) {
          workerPromiseResolvers.get(messageId)!.resolve({ key: data.key, tableCount: data.tableCount });
          workerPromiseResolvers.delete(messageId);
        }
      } else if (type === "sqliteStatus") {
        // Background status from worker: building/ready/error
        const model = getLastLoadedModel();
        if (model) {
          if (data.status === 'ready') {
            sqliteWarmStatus.set(model.id, 'ready');
            dispatchWarmStatus(model.id, 'ready', { tableCount: data.tableCount });
          } else if (data.status === 'building') {
            sqliteWarmStatus.set(model.id, 'building');
            dispatchWarmStatus(model.id, 'warming');
          } else if (data.status === 'error') {
            sqliteWarmStatus.set(model.id, 'error');
            dispatchWarmStatus(model.id, 'error', { message: data.message });
          }
        }
      }
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

          reject(new Error("Worker initialization timed out"));
          workerPromiseResolvers.delete(messageId);
        }
      }, 30000); // 30 second timeout for initialization
    });

    isWorkerInitialized = true;

  } catch (err) {

    throw new Error(
      `Failed to initialize worker: ${err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

// Load an IFC file using IfcOpenShell via the worker
export async function loadIfcFile(
  file: File,
  onProgress?: (progress: number, message?: string) => void
): Promise<IfcModel> {


  try {
    // Initialize the worker if needed
    await initializeWorker();


    if (!ifcWorker) {
      throw new Error("IFC worker initialization failed");
    }

    // Track progress only for the current load/extract message IDs
    const allowedProgressIds = new Set<string>();
    // Set up a progress handler for this operation (filters by messageId)
    const progressHandler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.type !== "progress" || !onProgress) return;
      // Only forward progress for this load/extract flow
      if (msg.messageId && allowedProgressIds.has(msg.messageId)) {
        onProgress(msg.percentage, msg.message);
      }
    };

    // Add the progress event listener
    ifcWorker.addEventListener("message", progressHandler);


    // Store the File object in the cache
    ifcFileCache.set(file.name, file);


    // Read the file as ArrayBuffer - this instance will be transferred
    const arrayBuffer = await file.arrayBuffer();

    // Generate a unique message ID
    const messageId = `load_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    allowedProgressIds.add(messageId);

    // Create a promise for this operation

    const result = await new Promise((resolve, reject) => {
      workerPromiseResolvers.set(messageId, { resolve, reject });

      // Send the message to the worker
      ifcWorker!.postMessage(
        {
          action: "loadIfcFast",
          messageId,
          data: {
            arrayBuffer,
            filename: file.name,
          },
        },
        [arrayBuffer]
      );



      // Set a timeout to detect if the worker doesn't respond at all
      // Use longer timeout for large files
      const timeoutDuration = file.size > 100 * 1024 * 1024 ? 120000 : 60000; // 2 min for >100MB, 1 min otherwise
      setTimeout(() => {
        if (workerPromiseResolvers.has(messageId)) {
          console.warn(`Worker timeout after ${timeoutDuration / 1000}s for file size ${(file.size / 1024 / 1024).toFixed(1)}MB`);
          reject(new Error(`Worker did not respond within ${timeoutDuration / 1000} seconds for large file processing`));
          workerPromiseResolvers.delete(messageId);
        }
      }, timeoutDuration);
    });



    // Set up a timeout to detect stalled processing
    // Use much longer timeout for large files
    const processingTimeoutDuration = file.size > 100 * 1024 * 1024 ? 300000 : 120000; // 5 min for >100MB, 2 min otherwise
    const timeout = setTimeout(() => {
      const resolver = workerPromiseResolvers.get(messageId);
      if (resolver) {
        console.warn(`Processing timeout after ${processingTimeoutDuration / 1000}s for file size ${(file.size / 1024 / 1024).toFixed(1)}MB`);
        // We don't reject, just warn - let it continue processing
      }
    }, processingTimeoutDuration);

    // The model info is directly in the result
    // Using 'as any' to bypass TypeScript type checking
    const modelInfo: any = result;

    // Clear the timeout
    clearTimeout(timeout);


    // Remove the progress event listener
    ifcWorker.removeEventListener("message", progressHandler);


    const elements = modelInfo.elements || [];


    const model: IfcModel = {
      id: `model-${Date.now()}`,
      name: file.name,
      file: file,
      schema: modelInfo.schema,
      project: modelInfo.project,
      elementCounts: modelInfo.element_counts,
      totalElements: modelInfo.total_elements,
      elements: elements,
      sqliteDb: modelInfo.sqlite_db,
      sqliteSuccess: modelInfo.sqlite_success,
    };


    // Store as the last loaded model
    _lastLoadedModel = model;

    cacheIfcFile(file);

    // Warm up SQLite database in background (non-blocking)
    warmupSqliteDatabase(model).catch(error => {
      console.warn(`SQLite warm-up failed for model ${model.id}:`, error);
    });

    return model;
  } catch (err) {

    throw new Error(
      `Failed to load IFC file: ${err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

// Query the SQLite database for the given model
export async function querySqliteDatabase(
  model: IfcModel,
  query: string
): Promise<any[]> {


  try {
    // Initialize the worker if needed (browser only)
    await initializeWorker();

    if (!ifcWorker) {
      throw new Error("IFC worker initialization failed");
    }

    // Generate a unique message ID
    const messageId = `sqlite_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create a promise for this operation
    const result = await new Promise((resolve, reject) => {
      workerPromiseResolvers.set(messageId, { resolve, reject });

      // Send the query to the worker
      ifcWorker!.postMessage({
        action: "querySqlite",
        messageId,
        data: {
          query,
          // Use filename-based keying to match persistence keys in the worker
          modelId: model.name,
        },
      });

      // Set a timeout
      setTimeout(() => {
        if (workerPromiseResolvers.has(messageId)) {
          reject(new Error("SQLite query timed out"));
          workerPromiseResolvers.delete(messageId);
        }
      }, 30000);
    });

    const sqliteResult = result as any;


    return sqliteResult;

  } catch (error) {

    throw new Error(
      `Failed to query SQLite database: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Export the sql.js database bytes for the given model
export async function exportSqliteDatabase(model: IfcModel): Promise<Uint8Array> {

  await initializeWorker();
  if (!ifcWorker) throw new Error("IFC worker initialization failed");

  const messageId = `sqlite_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const bytes: Uint8Array = await new Promise((resolve, reject) => {
    workerPromiseResolvers.set(messageId, { resolve, reject });
    ifcWorker!.postMessage({
      action: "exportSqlite",
      messageId,
      data: { modelId: model.id }
    });
    setTimeout(() => {
      if (workerPromiseResolvers.has(messageId)) {
        reject(new Error("SQLite export timed out"));
        workerPromiseResolvers.delete(messageId);
      }
    }, 30000);
  }) as any;

  return bytes;
}

// Fire-and-forget warm-up of sql.js DB in the worker
export async function warmupSqliteDatabase(model: IfcModel): Promise<{ tableCount: number }> {
  await initializeWorker();
  if (!ifcWorker) throw new Error("IFC worker initialization failed");

  const messageId = `sqlite_warm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sqliteWarmStatus.set(model.id, 'warming');
  dispatchWarmStatus(model.id, 'warming');

  try {
    const res = await new Promise<{ tableCount: number }>((resolve, reject) => {
      workerPromiseResolvers.set(messageId, { resolve, reject });
      ifcWorker!.postMessage({
        action: "warmSqlite",
        messageId,
        // Pass filename-based modelKey to align with build/warm logic in the worker
        data: { modelKey: model.name }
      });
      setTimeout(() => {
        if (workerPromiseResolvers.has(messageId)) {
          reject(new Error("SQLite warm-up timed out"));
          workerPromiseResolvers.delete(messageId);
        }
      }, 120000);
    });

    sqliteWarmStatus.set(model.id, 'ready');
    dispatchWarmStatus(model.id, 'ready');
    return { tableCount: (res && (res as any).tableCount) || 0 };
  } catch (e) {
    sqliteWarmStatus.set(model.id, 'error');
    dispatchWarmStatus(model.id, 'error');
    throw e;
  }
}

// Extract geometry from IFC elements (Standard method without GEOM worker)
export function extractGeometry(
  model: IfcModel,
  elementType = "all",
  includeOpenings = true
): IfcElement[] {

  // Ensure we have a model and elements to work with
  if (!model || !model.elements || model.elements.length === 0) {
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
    }
  }

  // Filter openings if necessary
  if (!includeOpenings) {
    filteredElements = filteredElements.filter(
      (element) => !element.type.toUpperCase().includes("IFCOPENING")
    );
  }

  return filteredElements;
}

// Extract geometry using simplified method (previously used IfcOpenShell GEOM module)
export async function extractGeometryWithGeom(
  model: IfcModel,
  elementType = "all",
  includeOpenings = true,
  onProgress?: (progress: number, message?: string) => void
): Promise<IfcElement[]> {

  // Ensure we have a model
  if (!model || !model.file) {

    return [];
  }

  // Get the original File object from cache if available
  const file =
    typeof model.file === "string"
      ? getIfcFile(model.file)
      : (model.file as File);

  if (!file) {

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

    return elements;
  } catch (error) {

    throw new Error(
      `Failed to extract geometry: ${error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Filter elements by property or IFC class
export function filterElements(
  elements: IfcElement[],
  property: string,
  operator: string,
  value: string,
  filterType: 'property' | 'ifcClass' = 'property'
): IfcElement[] {


  // Add a check for undefined or empty elements
  if (!elements || elements.length === 0) {

    return [];
  }

  return elements.filter((element) => {
    if (filterType === 'ifcClass') {
      // Filter by IFC class
      const ifcClass = property; // In ifcClass mode, property parameter contains the class pattern
      const elementType = element.type || '';
      
      // Case-insensitive matching
      const lowerElementType = elementType.toLowerCase();
      const lowerIfcClass = ifcClass.toLowerCase();

      switch (operator) {
        case "equals":
          return lowerElementType === lowerIfcClass;
        case "contains":
          return lowerElementType.includes(lowerIfcClass);
        case "startsWith":
          return lowerElementType.startsWith(lowerIfcClass);
        case "endsWith":
          return lowerElementType.endsWith(lowerIfcClass);
        default:
          return false;
      }
    } else {
      // Original property-based filtering
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
    }
  });
}

// Transform elements (using geometric transformations)
export function transformElements(
  elements: IfcElement[],
  translation: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
): IfcElement[] {


  // Add a check for undefined or empty elements
  if (!elements || elements.length === 0) {

    return [];
  }

  // TODO: se IfcOpenShell to apply transformations
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

// Define the interface for quantity extraction results
export interface QuantityResults {
  groups: Record<string, number>;
  unit: string;
  total: number;
  groupBy?: string;
  error?: string;
}

// Quantity extraction functions - NOW ASYNC and interacts with worker
export async function extractQuantities(
  model: IfcModel, // Pass the full model to get filename and elements
  quantityType = "area",
  groupBy = "none",
  // unit parameter is removed, worker will determine it
  onProgress?: (progress: number, message?: string) => void,
  // ADDED: Callback to update the node with the messageId
  updateNodeCallback?: (messageId: string) => void,
  // Option to ignore unknown references when grouping
  ignoreUnknownRefs = false
): Promise<QuantityResults> {


  // Ensure we have elements and a filename
  if (!model || !model.elements || model.elements.length === 0 || !model.name) {
    // Return default empty structure
    return { groups: { Total: 0 }, unit: "", total: 0 };
  }

  // Try fast path: client-side SQL using the comprehensive SQLite DB
  try {
    const sqlBased = await computeQuantitiesFromSql(model, quantityType, groupBy, ignoreUnknownRefs);
    if (sqlBased) {

      return sqlBased;
    }
  } catch (e) {

  }

  // Ensure worker is initialized (fallback path)
  await initializeWorker();
  if (!ifcWorker) {
    throw new Error("IFC worker is not available for quantity extraction");
  }

  // Prepare data for the worker
  // Sending expressIds is more efficient than sending potentially large element objects
  const elementIds = model.elements.map((el) => el.expressId);

  // --- Get the ArrayBuffer for the file ---
  // Get the cached File object
  const file = getIfcFile(model.name);
  if (!file) {
    throw new Error(`Could not retrieve cached file object for ${model.name}`);
  }

  // Read the ArrayBuffer from the File
  const arrayBuffer = await file.arrayBuffer();

  // ----------------------------------------

  try {
    // Create unique message ID
    const messageId = `quantity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // --- Call the callback to update the node data BEFORE sending the message ---
    if (updateNodeCallback) {
      try {
        updateNodeCallback(messageId);
      } catch (e) {

      }
    }
    // -----------------------------------------------------------------------

    // Setup promise for worker response
    const resultPromise = new Promise<QuantityResults>((resolve, reject) => {
      workerPromiseResolvers.set(messageId, { resolve, reject });

      // Optional progress handler integration if worker sends progress for quantities
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
      if (onProgress) ifcWorker!.addEventListener("message", progressHandler);

      // Timeout for the worker response
      const timeout = setTimeout(() => {
        if (workerPromiseResolvers.has(messageId)) {
          reject(
            new Error(
              "Worker timeout during quantity extraction"
            )
          );
          workerPromiseResolvers.delete(messageId);
          if (onProgress) ifcWorker!.removeEventListener("message", progressHandler);
        }
      }, 240000); // 4 minute timeout for large models

      // Define cleanup actions
      const cleanup = () => {
        clearTimeout(timeout);
        if (onProgress) ifcWorker!.removeEventListener("message", progressHandler);
        workerPromiseResolvers.delete(messageId);
      };

      // Update resolver to include cleanup
      workerPromiseResolvers.set(messageId, {
        resolve: (data: QuantityResults) => {
          cleanup();
          resolve(data);
        },
        reject: (error: any) => {
          cleanup();
          reject(error);
        },
      });


      // Send the request to the worker
      ifcWorker!.postMessage({
        action: "extractQuantities", // New action type
        messageId,
        data: {
          filename: model.name,
          elementIds,
          quantityType,
          groupBy,
          arrayBuffer, // ADDED: Send the buffer
        },
      }, [arrayBuffer]); // ADDED: Mark buffer as transferable
    });

    // Await the actual results from the worker
    const results = await resultPromise;

    return results;

  } catch (error) {

    throw new Error(
      `Quantity extraction failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Infer a display unit for the given quantity type
function inferQuantityUnit(quantityType: string): string {
  switch (String(quantityType).toLowerCase()) {
    case "length":
      return "m";
    case "area":
      return "m²";
    case "volume":
      return "m³";
    case "count":
    default:
      return "";
  }
}

// Build a prioritized CTE for BaseQuantities selection per element
function buildQuantityCte(quantityType: string, selectedIds?: number[]): { cte: string; filterClause: string } {
  const qt = String(quantityType).toLowerCase();
  let triples: Array<{ name: string; pr: number }> = [];
  if (qt === "area") {
    triples = [
      { name: "NetArea", pr: 1 },
      { name: "GrossArea", pr: 2 },
      { name: "Area", pr: 3 },
    ];
  } else if (qt === "volume") {
    triples = [
      { name: "NetVolume", pr: 1 },
      { name: "GrossVolume", pr: 2 },
      { name: "Volume", pr: 3 },
    ];
  } else if (qt === "length") {
    triples = [
      { name: "Length", pr: 1 },
    ];
  }

  // Optional filter for selected element ids
  const idFilter = (selectedIds && selectedIds.length)
    ? ` AND p.ifc_id IN (${selectedIds.join(",")})`
    : "";

  const unionParts = triples.map(t =>
    `SELECT p.ifc_id, CAST(p.value AS REAL) AS v, ${t.pr} AS pr\n` +
    `FROM psets p\n` +
    `WHERE p.pset_name = 'BaseQuantities' AND p.name = '${t.name}'${idFilter}`
  );

  const cte = `WITH q AS (\n${unionParts.join("\nUNION ALL\n")}\n),\nminpr AS (\n  SELECT ifc_id, MIN(pr) AS min_pr FROM q GROUP BY ifc_id\n),\nbest AS (\n  SELECT q.ifc_id, q.v\n  FROM q JOIN minpr ON q.ifc_id = minpr.ifc_id AND q.pr = minpr.min_pr\n)`;

  return { cte, filterClause: idFilter };
}

// Compute quantities via client-side SQL (sql.js) if available
async function computeQuantitiesFromSql(
  model: IfcModel,
  quantityType: string,
  groupBy: string,
  ignoreUnknownRefs: boolean = false
): Promise<QuantityResults | null> {
  // Ensure DB is available (non-throw warmup)
  try { await warmupSqliteDatabase(model); } catch { /* ignore */ }

  // Derive selected element ids from the model if present
  const selectedIds: number[] | undefined = Array.isArray(model?.elements)
    ? model.elements.map(e => e.expressId).filter((v) => Number.isFinite(v)) as number[]
    : undefined;

  const unit = inferQuantityUnit(quantityType);
  const gb = String(groupBy).toLowerCase();
  const qt = String(quantityType).toLowerCase();

  // Count can be handled directly via id_map
  if (qt === "count") {
    if (gb === "none") {
      let where = "";
      if (selectedIds && selectedIds.length) where = ` WHERE ifc_id IN (${selectedIds.join(',')})`;
      const rows = await querySqliteDatabase(model, `SELECT COUNT(*) AS total FROM id_map${where}`);
      const total = Number(rows?.[0]?.total || rows?.[0]?.['COUNT(*)'] || 0);
      return { groups: { Total: total }, unit: "", total };
    }
    if (gb === "class") {
      let where = "";
      if (selectedIds && selectedIds.length) where = ` WHERE m.ifc_id IN (${selectedIds.join(',')})`;
      const rows = await querySqliteDatabase(model, `SELECT m.ifc_class AS groupKey, COUNT(*) AS total FROM id_map m${where} GROUP BY m.ifc_class ORDER BY total DESC`);
      const groups: Record<string, number> = {};
      let total = 0;
      for (const r of rows || []) {
        const key = r.groupKey || r.ifc_class || "Unknown";
        const val = Number(r.total || r.count || 0);
        if (!Number.isFinite(val)) continue;

        // Skip unknown entries if ignoreUnknownRefs is enabled
        if (ignoreUnknownRefs && (key === "Unknown" || key === "")) {
          continue;
        }

        groups[key] = val;
        total += val;
      }
      return { groups, unit: "", total };
    }
    // For other groupings (level/material) not yet supported via SQL reliably
    return null;
  }

  // Preferred: derive from IfcQuantity tables via inverses to ElementQuantity and RelDefines
  // JSON1 path
  const json1Test = await querySqliteDatabase(model, `SELECT json_extract('{"a":1}', '$.a') AS v`)
    .then(rows => (Array.isArray(rows) && rows.length > 0 && rows[0].v === 1))
    .catch(() => false);

  if (json1Test) {
    const qv = `SELECT inv.value AS ElementQuantityId, CAST(v.VolumeValue AS REAL) AS v, v.Name AS qname, v.Unit AS unit FROM IfcQuantityVolume v JOIN json_each(v.inverses) inv`;
    const qa = `SELECT inv.value AS ElementQuantityId, CAST(a.AreaValue AS REAL) AS v, a.Name AS qname, a.Unit AS unit FROM IfcQuantityArea a JOIN json_each(a.inverses) inv`;
    const ql = `SELECT inv.value AS ElementQuantityId, CAST(l.LengthValue AS REAL) AS v, l.Name AS qname, l.Unit AS unit FROM IfcQuantityLength l JOIN json_each(l.inverses) inv`;
    const allq = `WITH ALLQ AS ( ${qv} UNION ALL ${qa} UNION ALL ${ql} ), E2Q AS ( SELECT ro.value AS element_id, r.RelatingPropertyDefinition AS ElementQuantityId FROM IfcRelDefinesByProperties r, json_each(r.RelatedObjects) ro )`;

    // Optional filter on selected ids
    const idFilter = (selectedIds && selectedIds.length) ? ` WHERE e.element_id IN (${selectedIds.join(',')})` : '';

    if (gb === 'none') {
      const sql = `${allq} SELECT SUM(q.v) AS total FROM E2Q e JOIN ALLQ q ON e.ElementQuantityId = q.ElementQuantityId${idFilter}`;
      const rows = await querySqliteDatabase(model, sql);
      const total = Number(rows?.[0]?.total || 0);
      return { groups: { Total: total }, unit, total };
    }

    if (gb === 'class') {
      const sql = `${allq} SELECT m.ifc_class AS groupKey, SUM(q.v) AS total FROM E2Q e JOIN ALLQ q ON e.ElementQuantityId = q.ElementQuantityId JOIN id_map m ON e.element_id = m.ifc_id${idFilter} GROUP BY m.ifc_class ORDER BY total DESC`;
      const rows = await querySqliteDatabase(model, sql);
      const groups: Record<string, number> = {}; let total = 0;
      for (const r of rows || []) {
        const key = r.groupKey || r.ifc_class || 'Unknown';
        const val = Number(r.total || 0);
        if (!Number.isFinite(val)) continue;

        // Skip unknown entries if ignoreUnknownRefs is enabled
        if (ignoreUnknownRefs && (key === 'Unknown' || key === '')) {
          continue;
        }

        groups[key] = val;
        total += val;
      }
      return { groups, unit, total };
    }

    if (gb === 'type') {
      // Group by IfcTypeObject Name via IfcRelDefinesByType mapping
      // First, get all available tables to avoid querying non-existent ones
      const allTablesRows = await querySqliteDatabase(model, "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Type'");
      const availableTypeTables = allTablesRows?.map(r => r.name).filter(name => name && name.endsWith('Type')) || [];

      if (availableTypeTables.length === 0) {
        // Fallback to class grouping if no type tables exist

        const sql = `${allq} SELECT m.ifc_class AS groupKey, SUM(q.v) AS total FROM E2Q e JOIN ALLQ q ON e.ElementQuantityId = q.ElementQuantityId JOIN id_map m ON e.element_id = m.ifc_id${idFilter} GROUP BY m.ifc_class ORDER BY total DESC`;
        const rows = await querySqliteDatabase(model, sql);
        const groups: Record<string, number> = {}; let total = 0;
        for (const r of rows || []) { const key = r.groupKey || r.ifc_class || 'Unknown'; const val = Number(r.total || 0); if (!Number.isFinite(val)) continue; groups[key] = val; total += val; }
        return { groups, unit, total };
      }

      const unionT = availableTypeTables.map(t => `SELECT ifc_id AS type_id, Name AS type_name FROM ${t}`).join('\nUNION ALL\n');
      const sql = `${allq}\n, R AS (\n  SELECT r.RelatingType AS type_id, ro.value AS element_id FROM IfcRelDefinesByType r, json_each(r.RelatedObjects) ro\n),\nT AS (\n${unionT}\n)\nSELECT COALESCE(T.type_name, 'Unknown Type') AS groupKey, SUM(q.v) AS total\nFROM E2Q e\nJOIN ALLQ q ON e.ElementQuantityId = q.ElementQuantityId\nLEFT JOIN R ON e.element_id = R.element_id\nLEFT JOIN T ON R.type_id = T.type_id${idFilter}\nGROUP BY groupKey\nORDER BY total DESC`;
      const rows = await querySqliteDatabase(model, sql);
      const groups: Record<string, number> = {}; let total = 0;
      for (const r of rows || []) {
        const key = (r.groupKey && String(r.groupKey).trim()) || 'Unknown Type';
        const val = Number(r.total || 0);
        if (!Number.isFinite(val)) continue;

        // Skip "Unknown Type" entries if ignoreUnknownRefs is enabled
        if (ignoreUnknownRefs && key === 'Unknown Type') {
          continue;
        }

        groups[key] = (groups[key] || 0) + val;
        total += val;
      }
      return { groups, unit, total };
    }
  }

  // Fallback to BaseQuantities psets prioritization if JSON1 not available
  const { cte } = buildQuantityCte(qt, selectedIds);
  if (gb === 'none') {
    const rows = await querySqliteDatabase(model, `${cte}\nSELECT SUM(best.v) AS total FROM best`);
    const total = Number(rows?.[0]?.total || 0);
    return { groups: { Total: total }, unit, total };
  }
  if (gb === 'class') {
    const rows = await querySqliteDatabase(model, `${cte}\nSELECT m.ifc_class AS groupKey, SUM(best.v) AS total FROM best JOIN id_map m ON best.ifc_id = m.ifc_id GROUP BY m.ifc_class ORDER BY total DESC`);
    const groups: Record<string, number> = {}; let total = 0;
    for (const r of rows || []) {
      const key = r.groupKey || r.ifc_class || 'Unknown';
      const val = Number(r.total || 0);
      if (!Number.isFinite(val)) continue;

      // Skip unknown entries if ignoreUnknownRefs is enabled
      if (ignoreUnknownRefs && (key === 'Unknown' || key === '')) {
        continue;
      }

      groups[key] = val;
      total += val;
    }
    return { groups, unit, total };
  }
  if (gb === 'type') {
    // Without JSON1 and unified view, deriving ObjectType generically is unreliable; fall back
    return null;
  }
  // Level and material groupings require additional relations; not implemented here
  return null;
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


  // Check if propertyValue is a mapping object (element-specific values)
  const isMapping = propertyValue &&
    typeof propertyValue === 'object' &&
    !Array.isArray(propertyValue) &&
    (propertyValue.mappings || propertyValue.elements);

  let elementValueMap: Record<string, any> = {};
  let elementsModified = 0;

  if (isMapping) {
    // Extract the mappings from the value object
    if (propertyValue.mappings) {
      elementValueMap = propertyValue.mappings;
    } else if (propertyValue.elements) {
      elementValueMap = propertyValue.elements;
    }
    console.log(`Using element-specific values for ${Object.keys(elementValueMap).length} elements`);
  }

  // Check for undefined or empty elements
  if (!elements || elements.length === 0) {
    return [];
  }

  // Make sure elements is an array
  if (!Array.isArray(elements)) {
    return [];
  }

  // Handle empty property name
  if (!propertyName) {
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
  const result = elements.map((element) => {
    // Clone the element to avoid modifying the original
    const updatedElement = { 
      ...element,
      properties: element.properties ? { ...element.properties } : {},
      psets: element.psets ? JSON.parse(JSON.stringify(element.psets)) : {},
      qtos: element.qtos ? JSON.parse(JSON.stringify(element.qtos)) : {}
    };

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
        // Determine the value to use for this specific element
        let valueToSet = propertyValue;

        if (isMapping) {
          // Look up the element-specific value by GlobalId
          const globalId = element.properties?.GlobalId;
          if (globalId && elementValueMap[globalId] !== undefined) {
            valueToSet = elementValueMap[globalId];
            elementsModified++;
          } else {
            // Skip this element if no mapping exists for it
            // Don't log this as it's expected for elements not in the mapping
            break;
          }
        }

        // Set or add the property
        if (!updatedElement.properties) {
          updatedElement.properties = {};
        }
        // Always update the direct properties for convenient access
        updatedElement.properties[actualPropertyName] = valueToSet;

        // Determine where to store the property
        if (effectiveTargetPset !== "any") {
          // Make sure psets exists
          if (!updatedElement.psets) {
            updatedElement.psets = {};
          }

          // Make sure the target pset exists
          if (!updatedElement.psets[effectiveTargetPset]) {
            updatedElement.psets[effectiveTargetPset] = {};
          }

          // Add the property to the target pset
          updatedElement.psets[effectiveTargetPset][actualPropertyName] =
            valueToSet;
        }

        // Store property info for UI feedback
        updatedElement.propertyInfo = {
          name: actualPropertyName,
          exists: true,
          value: valueToSet,
          psetName:
            effectiveTargetPset !== "any" ? effectiveTargetPset : "properties",
        };
        break;

      case "remove":
        // Remove the property
        let removed = false;

        // Remove from direct properties
        if (updatedElement.properties && actualPropertyName in updatedElement.properties) {
          delete updatedElement.properties[actualPropertyName];
          removed = true;
        }

        // If a specific pset is targeted, only remove from there
        if (effectiveTargetPset !== "any") {
          if (
            updatedElement.psets?.[effectiveTargetPset]?.[actualPropertyName] !==
            undefined
          ) {
            delete updatedElement.psets[effectiveTargetPset][actualPropertyName];
            removed = true;
          }
        } else {
          // Otherwise remove from all psets
          if (updatedElement.psets) {
            for (const psetName in updatedElement.psets) {
              if (actualPropertyName in updatedElement.psets[psetName]) {
                delete updatedElement.psets[psetName][actualPropertyName];
                removed = true;
              }
            }
          }
        }

        // Also clean up qtos
        if (effectiveTargetPset === "any" && updatedElement.qtos) {
          for (const qtoName in updatedElement.qtos) {
            if (actualPropertyName in updatedElement.qtos[qtoName]) {
              delete updatedElement.qtos[qtoName][actualPropertyName];
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

    }

    return updatedElement;
  });

  // Log summary if using mapping
  if (isMapping && elementsModified > 0) {
  }

  return result;
}

// Classification functions
export function manageClassifications(
  elements: IfcElement[],
  system = "uniclass",
  action = "get",
  code = ""
): IfcElement[] {


  if (!elements || elements.length === 0) {

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
    // Return elements with classification information if present
    return elements.map((element) => {
      const enhancedElement = { ...element };

      // Look for classifications in properties or psets
      const classifications = [];

      // Check in direct properties
      if (element.properties.Classification) {
        classifications.push(element.properties.Classification);
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
              "",
            description: element.psets[pset].Description || "",
          });
        }
      }

      enhancedElement.classifications = classifications;
      return enhancedElement;
    });
  }

  // Set classification
  return elements.map((element) => {
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


  if (!elements || elements.length === 0) {

    return [];
  }

  if (!referenceElements || referenceElements.length === 0) {

    return [];
  }

  // TODO: Use IfcOpenShell to perform spatial calculations
  // This could involve extracting geometry and using computational geometry algorithms

  // For demonstration, we'll simulate spatial relationships
  switch (queryType) {
    case "contained":
      // Find elements contained within reference elements
      // This would require bounding box comparisons in a real implementation
      return elements.filter((element) => {
        // Simple simulation: check if the element has a containment relationship
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
      return elements.filter(() => {
        // Randomly select about 30% of elements for demonstration
        return Math.random() < 0.3;
      });

    case "touching":
      // Find elements that touch reference elements
      // This would require adjacency detection in a real implementation
      return elements.filter(() => {
        // Randomly select about 20% of elements for demonstration
        return Math.random() < 0.2;
      });

    case "within-distance":
      // Find elements within a certain distance of reference elements
      // This would require distance calculation in a real implementation
      return elements.filter(() => {
        // Simulate that more elements are included as distance increases
        const normalized = Math.min(1, distance / 10);
        return Math.random() < normalized;
      });

    default:

      return [];
  }
}

// Relationship query functions
export function queryRelationships(
  elements: IfcElement[],
  relationType = "containment",
  direction = "outgoing"
): IfcElement[] {


  if (!elements || elements.length === 0) {

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

  // TODO: Use IfcOpenShell to traverse relationships
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


  if (!elements || elements.length === 0) {

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
export async function exportData(
  input: any,
  format = "csv",
  fileName = "export"
): Promise<string | ArrayBuffer | void> {


  // If format is IFC, dispatch an event to handle export in main thread
  if (format.toLowerCase() === "ifc") {
    const sourceModel = getLastLoadedModel();
    if (!sourceModel || !sourceModel.name) {
      return Promise.reject("Cannot export IFC: Source model not found.");
    }

    // Extract elements, handling both array and model object inputs
    let elementsToUse: IfcElement[];
    if (Array.isArray(input)) {
      elementsToUse = input;
    } else if (input && input.elements) {
      elementsToUse = input.elements;
    } else {

      return Promise.reject("Cannot export IFC: Invalid input data.");
    }

    // Create the model object containing the potentially modified elements
    // but crucially retain the original model's metadata like ID and NAME for lookup purposes
    const modelDataForWorker: IfcModel = {
      ...sourceModel, // Include original metadata like id, name, schema, project
      elements: elementsToUse, // Use the potentially modified elements
    };

    // Dispatch an event to trigger the export process in the main thread
    // Pass BOTH the desired export filename AND the original filename for buffer lookup
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

  // For other formats (CSV, JSON, Excel, GLB), process the data here
  let rows: any[];

  // Handle null/undefined input from Python scripts
  if (input === null || input === undefined) {
    return "";
  }

  if (Array.isArray(input)) {
    rows = input;
  } else if (input && typeof input === "object") {
    // Special handling for quantity results
    if ((input.type === "quantityResults" && input.value && input.value.groups) ||
      (input.groups && input.unit !== undefined && input.total !== undefined)) {
      // Handle both wrapped quantity results (from watch node) and raw quantity results (from quantity node)
      const quantityData = input.type === "quantityResults" ? input.value : input;
      const { groups, unit, total, groupBy } = quantityData;
      // Convert groups object into individual rows
      rows = Object.entries(groups).map(([groupName, groupValue]) => ({
        group: groupName,
        value: groupValue,
        unit: unit || '',
        total: total || 0,
        groupBy: groupBy || ''
      }));
    } else if (Array.isArray(input.elements)) {
      rows = input.elements;
    } else if (input.detailed_data && Array.isArray(input.detailed_data)) {
      // Handle Python script output with detailed_data array
      rows = input.detailed_data;
    } else if (input.summary_data && Array.isArray(input.summary_data)) {
      // Handle Python script output with summary_data array
      rows = input.summary_data;
    } else if (input.rows && Array.isArray(input.rows)) {
      // Handle generic data with rows array
      rows = input.rows;
    } else if (input.data && Array.isArray(input.data)) {
      // Handle data transform output
      rows = input.data;
    } else if (typeof input === 'object' && Object.keys(input).length > 0) {
      // Handle single object - wrap in array
      rows = [input];
    } else {
      // Fallback for primitive values
      rows = [{ value: input }];
    }
  } else {
    rows = [{ value: input }];
  }

  if (!rows || rows.length === 0) {

    return format === "json" ? "[]" : "";
  }

  // Determine headers from row data - improved for multiple data structures
  const headerSet = new Set<string>();
  rows.forEach((el) => {
    if (!el || typeof el !== "object") {
      headerSet.add("value");
      return;
    }

    // Handle IFC-style elements with properties and psets
    if (el.properties) {
      Object.keys(el.properties).forEach((key) => headerSet.add(key));
    }

    if (el.psets) {
      Object.entries(el.psets).forEach(([pset, props]) => {
        if (typeof props === "object" && props !== null) {
          Object.keys(props as any).forEach((prop) =>
            headerSet.add(`${pset}.${prop}`)
          );
        }
      });
    }

    // Handle flat objects (like Python script output)
    Object.keys(el).forEach((key) => {
      // Skip IFC-specific fields when we have flat object structure
      if (key !== "properties" && key !== "psets" && key !== "geometry" &&
        key !== "elements" && key !== "model" && key !== "type" &&
        key !== "value" && key !== "error" && key !== "message") {
        headerSet.add(key);
      }
    });

    // Handle nested objects by flattening keys with dot notation
    function extractNestedKeys(obj: any, prefix = '') {
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        Object.keys(obj).forEach(key => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          // Only add if it's not a complex nested object/array
          if (typeof obj[key] !== 'object' || obj[key] === null ||
            Array.isArray(obj[key]) || key === 'geometry') {
            headerSet.add(fullKey);
          } else {
            // Recursively extract nested keys for simple objects
            extractNestedKeys(obj[key], fullKey);
          }
        });
      }
    }

    // Extract nested keys if this is a complex object
    if (el.properties && typeof el.properties === 'object') {
      extractNestedKeys(el.properties);
    }
  });

  const headers = Array.from(headerSet).sort(); // Sort for consistent column order

  switch (format.toLowerCase()) {
    case "json": {
      const data = rows.map((element: any) => {
        const row: Record<string, any> = {};
        headers.forEach((header) => {
          const parts = header.split(".");
          if (parts.length > 1) {
            // Navigate through nested object structure
            let currentObj: any = element;
            for (const part of parts) {
              if (currentObj && typeof currentObj === 'object') {
                if (currentObj[part] !== undefined) {
                  currentObj = currentObj[part];
                } else if (part === 'properties' && currentObj.properties) {
                  currentObj = currentObj.properties;
                } else if (currentObj.psets && currentObj.psets[part]) {
                  currentObj = currentObj.psets[part];
                } else {
                  currentObj = undefined;
                  break;
                }
              } else {
                currentObj = undefined;
                break;
              }
            }
            row[header] = currentObj;
          } else {
            // Handle single-level properties
            if (element[header] !== undefined) {
              row[header] = element[header];
            } else if (element.properties && element.properties[header] !== undefined) {
              row[header] = element.properties[header];
            } else if (element.psets) {
              const psetMatch = Object.entries(element.psets).find(([psetName, psetProps]) =>
                typeof psetProps === 'object' && psetProps !== null && (psetProps as any)[header] !== undefined
              );
              if (psetMatch) {
                row[header] = (psetMatch[1] as any)[header];
              }
            }
          }
        });
        return row;
      });
      return JSON.stringify(data, null, 2);
    }
    case "excel": {
      // Import SheetJS dynamically to generate proper Excel files
      const XLSX = await import('xlsx');

      // Create worksheet data from rows
      const worksheetData = rows.map((element) => {
        const row: Record<string, any> = {};
        headers.forEach((header) => {
          const parts = header.split(".");
          if (parts.length > 1) {
            // Navigate through nested object structure
            let currentObj: any = element;
            for (const part of parts) {
              if (currentObj && typeof currentObj === 'object') {
                if (currentObj[part] !== undefined) {
                  currentObj = currentObj[part];
                } else if (part === 'properties' && currentObj.properties) {
                  currentObj = currentObj.properties;
                } else if (currentObj.psets && currentObj.psets[part]) {
                  currentObj = currentObj.psets[part];
                } else {
                  currentObj = undefined;
                  break;
                }
              } else {
                currentObj = undefined;
                break;
              }
            }
            row[header] = currentObj ?? "";
          } else {
            // Handle single-level properties
            if (element[header] !== undefined) {
              row[header] = element[header];
            } else if (element.properties && element.properties[header] !== undefined) {
              row[header] = element.properties[header];
            } else if (element.psets) {
              const psetMatch = Object.entries(element.psets).find(([psetName, psetProps]) =>
                typeof psetProps === 'object' && psetProps !== null && (psetProps as any)[header] !== undefined
              );
              if (psetMatch) {
                row[header] = (psetMatch[1] as any)[header];
              } else {
                row[header] = "";
              }
            } else {
              row[header] = "";
            }
          }
        });
        return row;
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      // Generate Excel file as ArrayBuffer
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
        compression: true
      });

      return excelBuffer;
    }
    case "glb": {
      // Try to export from active viewer first (real geometry)
      const { withActiveViewer, hasActiveModel } = await import('./ifc/viewer-manager');

      if (hasActiveModel()) {


        const viewerResult = withActiveViewer(viewer => {
          const modelGroup = viewer.getModelGroup();
          if (!modelGroup) {

            return null;
          }

          // Filter elements if we have a specific set to export
          let elementsToExport: number[] = [];
          if (Array.isArray(rows) && rows.length > 0 && rows[0].expressId !== undefined) {
            elementsToExport = rows.map((el: any) => el.expressId).filter(id => id !== undefined);

          }

          // Create a temporary scene for export
          const exportScene = new Scene();

          if (elementsToExport.length > 0) {
            // Export specific elements
            elementsToExport.forEach(expressId => {
              const meshes = viewer.getMeshesForElement(expressId);
              meshes.forEach(mesh => {
                // Clone the mesh for export (to avoid modifying original)
                const clonedMesh = mesh.clone();
                clonedMesh.updateMatrixWorld(true);
                exportScene.add(clonedMesh);
              });
            });
          } else {
            // Export entire model

            modelGroup.traverse(child => {
              if (child instanceof Mesh) {
                const clonedMesh = child.clone();
                clonedMesh.updateMatrixWorld(true);
                exportScene.add(clonedMesh);
              }
            });
          }

          return exportScene;
        });

        if (viewerResult) {
          const exporter = new GLTFExporter();
          const res = await exporter.parseAsync(viewerResult, { binary: true });

          // Clean up temporary scene
          viewerResult.traverse(child => {
            if (child instanceof Mesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else if (child.material) {
                child.material.dispose();
              }
            }
          });

          if (res instanceof ArrayBuffer) {
            return res;
          }
          return new TextEncoder().encode(JSON.stringify(res)).buffer as ArrayBuffer;
        }
      }

      // Fallback to original method if no viewer available

      const scene = new Scene();
      let validMeshCount = 0;

      rows.forEach((element: any) => {
        if (element.geometry && element.geometry.vertices) {
          try {
            // Validate geometry data structure
            const vertices = element.geometry.vertices;
            if (!Array.isArray(vertices) && !(vertices instanceof Float32Array)) {

              return;
            }

            // Ensure vertices array length is divisible by 3
            const vertArray = Array.isArray(vertices) ? new Float32Array(vertices) : vertices;
            if (vertArray.length % 3 !== 0) {

              return;
            }

            if (vertArray.length === 0) {

              return;
            }

            const geo = new BufferGeometry();
            geo.setAttribute("position", new BufferAttribute(vertArray, 3));

            // Add normals if available, otherwise compute them
            if (element.geometry.normals && element.geometry.normals.length === vertArray.length) {
              const normalArray = Array.isArray(element.geometry.normals) ?
                new Float32Array(element.geometry.normals) : element.geometry.normals;
              geo.setAttribute("normal", new BufferAttribute(normalArray, 3));
            } else {
              geo.computeVertexNormals();
            }

            // Add indices if available
            if (element.geometry.indices && element.geometry.indices.length > 0) {
              const indexArray = Array.isArray(element.geometry.indices) ?
                new Uint32Array(element.geometry.indices) : element.geometry.indices;
              geo.setIndex(new BufferAttribute(indexArray, 1));
            }

            const material = new MeshStandardMaterial({
              color: element.geometry.color || 0x888888,
              metalness: 0.1,
              roughness: 0.8
            });

            const mesh = new Mesh(geo, material);

            // Apply transformation if available
            if (element.transformedGeometry) {
              const { translation = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = element.transformedGeometry;
              mesh.position.set(translation[0], translation[1], translation[2]);
              mesh.rotation.set(
                rotation[0] * Math.PI / 180,
                rotation[1] * Math.PI / 180,
                rotation[2] * Math.PI / 180
              );
              mesh.scale.set(scale[0], scale[1], scale[2]);
            }

            scene.add(mesh);
            validMeshCount++;
          } catch (error) {

          }
        }
      });

      if (validMeshCount === 0) {

        // Create a simple placeholder cube
        const geo = new BufferGeometry();
        const vertices = new Float32Array([
          -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, // front face
          -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, // back face
        ]);
        const indices = new Uint32Array([
          0, 1, 2, 0, 2, 3,  // front
          4, 6, 5, 4, 7, 6,  // back
          0, 4, 7, 0, 7, 3,  // left
          1, 5, 6, 1, 6, 2,  // right
          3, 7, 6, 3, 6, 2,  // top
          0, 1, 5, 0, 5, 4   // bottom
        ]);

        geo.setAttribute("position", new BufferAttribute(vertices, 3));
        geo.setIndex(new BufferAttribute(indices, 1));
        geo.computeVertexNormals();

        const mesh = new Mesh(geo, new MeshStandardMaterial({ color: 0x888888 }));
        scene.add(mesh);
      }



      const exporter = new GLTFExporter();
      const res = await exporter.parseAsync(scene, { binary: true });

      // Clean up scene
      scene.traverse(child => {
        if (child instanceof Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });

      if (res instanceof ArrayBuffer) {
        return res;
      }
      return new TextEncoder().encode(JSON.stringify(res)).buffer as ArrayBuffer;
    }
    case "csv":
    default: {
      let csvContent = headers.join(",") + "\n";
      rows.forEach((element: any) => {
        const row = headers
          .map((header) => {
            let value: any = "";

            // Handle dotted notation (nested properties)
            const parts = header.split(".");
            if (parts.length > 1) {
              // Navigate through nested object structure
              let currentObj: any = element;
              for (const part of parts) {
                if (currentObj && typeof currentObj === 'object') {
                  // First try direct property access
                  if (currentObj[part] !== undefined) {
                    currentObj = currentObj[part];
                  }
                  // Then try IFC-style properties
                  else if (part === 'properties' && currentObj.properties) {
                    currentObj = currentObj.properties;
                  }
                  // Then try IFC-style psets
                  else if (currentObj.psets && currentObj.psets[part]) {
                    currentObj = currentObj.psets[part];
                  } else {
                    currentObj = undefined;
                    break;
                  }
                } else {
                  currentObj = undefined;
                  break;
                }
              }
              value = currentObj;
            } else {
              // Handle single-level properties with fallback logic
              if (element[header] !== undefined) {
                // Direct property access (for flat objects like Python output)
                value = element[header];
              } else if (element.properties && element.properties[header] !== undefined) {
                // IFC-style properties
                value = element.properties[header];
              } else if (element.psets) {
                // Check if this header corresponds to a pset property
                const psetMatch = Object.entries(element.psets).find(([psetName, psetProps]) =>
                  typeof psetProps === 'object' && psetProps !== null && (psetProps as any)[header] !== undefined
                );
                if (psetMatch) {
                  value = (psetMatch[1] as any)[header];
                }
              }
            }

            // Convert to string and handle CSV escaping
            const strValue = String(value === undefined || value === null ? "" : value);
            if (strValue.includes(",") || strValue.includes('"') || strValue.includes("\n")) {
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
}

export function downloadExportedFile(
  data: string | ArrayBuffer,
  format: string,
  fileName: string,
): void {
  const mimeMap: Record<string, string> = {
    csv: "text/csv",
    json: "application/json",
    excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    glb: "model/gltf-binary",
  };

  // Map format to proper file extension
  const extensionMap: Record<string, string> = {
    csv: "csv",
    json: "json",
    excel: "xlsx", // Fix: Use .xlsx instead of .excel
    glb: "glb",
  };

  const blob =
    data instanceof ArrayBuffer
      ? new Blob([data], { type: mimeMap[format] || "application/octet-stream" })
      : new Blob([data as BlobPart], { type: mimeMap[format] || "text/plain" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.${extensionMap[format] || format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Run arbitrary Python code against the loaded IFC model using the worker
export async function runPythonScript(
  model: IfcModel | null,
  code: string,
  onProgress?: (progress: number, message?: string) => void,
  inputData?: any,
  properties?: Record<string, any>
): Promise<any> {
  await initializeWorker();
  if (!ifcWorker) throw new Error("IFC worker is not available");

  let arrayBuffer: ArrayBuffer | undefined = undefined;

  // Only try to get file and arrayBuffer if model is provided
  if (model && model.name) {
    const file = getIfcFile(model.name);
    if (file) {
      arrayBuffer = await file.arrayBuffer();
    } else {

    }
  }

  const messageId = `python_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  const resultPromise = new Promise<any>((resolve, reject) => {
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

    if (onProgress) ifcWorker!.addEventListener("message", progressHandler);

    const cleanup = () => {
      if (onProgress) ifcWorker!.removeEventListener("message", progressHandler);
      workerPromiseResolvers.delete(messageId);
    };

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

    // Only pass arrayBuffer as transferable if it exists
    const message = {
      action: "runPython",
      messageId,
      data: {
        script: code,
        arrayBuffer,
        inputData,
        properties
      },
    };

    if (arrayBuffer) {
      ifcWorker!.postMessage(message, [arrayBuffer]);
    } else {
      ifcWorker!.postMessage(message);
    }
  });

  return resultPromise;
}
