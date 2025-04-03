import type { IfcModel, IfcElement } from "@/lib/ifc/ifc-loader";

// Define progress callback type
type ProgressCallback = (percentage: number, message?: string) => void;

// Function to extract geometry from IFC elements using IFCOpenShell GEOM
export async function extractGeometryWithGeom(
  model: IfcModel,
  elementType = "all",
  includeOpenings = true,
  arrayBuffer: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<IfcElement[]> {
  console.log("Extracting geometry with GEOM:", elementType, includeOpenings);

  if (!arrayBuffer) {
    return Promise.reject(
      new Error("ArrayBuffer is required for geometry extraction with GEOM.")
    );
  }

  // Create a message to send to the worker
  const messageId = Date.now().toString();

  // Send request to worker
  const worker = new Worker(
    new URL("../../public/ifcWorker.js", import.meta.url)
  );

  // Initial progress update
  onProgress?.(5, "Initializing worker...");

  return new Promise((resolve, reject) => {
    // Set up message handler
    const messageHandler = (event: MessageEvent) => {
      const {
        type,
        data,
        message,
        percentage,
        messageId: responseId,
      } = event.data;

      if (responseId === messageId) {
        if (type === "progress" && onProgress) {
          onProgress(percentage, message);
          return; // Don't remove listener on progress
        }

        // For final messages (geometry, error), remove listener and terminate
        worker.removeEventListener("message", messageHandler);
        worker.terminate();
        console.log(`Worker terminated for messageId: ${messageId}`);

        if (type === "error") {
          reject(
            new Error(message || "Worker error during geometry extraction")
          );
          return;
        }

        if (type === "geometry") {
          onProgress?.(100, "Geometry received"); // Final progress update
          resolve(data);
        }
      } else if (type === "error" && !responseId) {
        // Handle general worker errors without specific messageId
        console.error("Received general worker error:", message);
        worker.removeEventListener("message", messageHandler);
        worker.terminate();
        reject(new Error(message || "General worker error"));
      }
    };

    worker.addEventListener("message", messageHandler);

    // Send request to worker, including the ArrayBuffer
    worker.postMessage(
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
    onProgress?.(10, "Sent request to worker");
  });
}

// Mock function to extract geometry from IFC elements (fallback)
export function extractGeometry(
  model: IfcModel,
  elementType = "all",
  includeOpenings = true
): IfcElement[] {
  console.log("Extracting geometry:", elementType, includeOpenings);

  if (elementType === "all") {
    return model.elements;
  }

  return model.elements.filter((element) => {
    const typeMap: Record<string, string[]> = {
      walls: ["IfcWall"],
      slabs: ["IfcSlab", "IfcRoof"],
      columns: ["IfcColumn"],
      beams: ["IfcBeam"],
    };

    return typeMap[elementType]?.includes(element.type);
  });
}

// Mock function to transform elements
export function transformElements(
  elements: IfcElement[],
  translation: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
): IfcElement[] {
  console.log("Transforming elements:", translation, rotation, scale);

  // In a real implementation, this would apply the transformation to the geometry
  return elements.map((element) => ({
    ...element,
    // Apply transformation to geometry
  }));
}
