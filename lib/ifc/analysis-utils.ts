import type { IfcElement, IfcModel } from "@/lib/ifc-utils"

// Analysis functions
export async function performAnalysis(
  elements: IfcElement[],
  referenceElements: IfcElement[] = [],
  analysisType = "clash",
  options: Record<string, any> = {},
  onProgress?: (message: string) => void
): Promise<any> {
  console.log("Performing analysis:", analysisType, options)

  switch (analysisType) {
    case "space":
      // Space analysis using IfcOpenShell
      const metric = options.metric || "room_assignment"
      const model = options.model as IfcModel

      if (!model || !model.file) {
        return {
          error: "No IFC model provided",
          message: "Space analysis requires an IFC model. Please connect an IFC node.",
          elementSpaceMap: {},
          summary: {
            totalSpaces: 0,
            totalZones: 0,
            assignedElements: 0,
            unassignedElements: elements.length
          }
        }
      }

      try {
        // Perform space analysis via worker
        return await performRealSpaceAnalysis(model, elements, metric, onProgress)
      } catch (error) {
        console.error("Error in space analysis:", error)
        return {
          error: error instanceof Error ? error.message : String(error),
          message: "Space analysis failed. Ensure the IFC file contains space definitions.",
          elementSpaceMap: {},
          summary: {
            totalSpaces: 0,
            totalZones: 0,
            assignedElements: 0,
            unassignedElements: elements.length
          }
        }
      }

    case "clash":
    case "adjacency":
    case "path":
    case "visibility":
      // These analysis types are not yet implemented
      return {
        error: "Not implemented",
        message: `${analysisType} analysis is not yet implemented. Use the Python node for custom analysis.`,
        analysisType
      }

    default:
      return {
        error: "Unknown analysis type",
        message: `Analysis type '${analysisType}' is not recognized.`,
        supportedTypes: ["space"]
      }
  }
}

// Space analysis implementation using IfcOpenShell
async function performRealSpaceAnalysis(
  model: IfcModel,
  elements: IfcElement[],
  metric: string,
  onProgress?: (message: string) => void
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const worker = new Worker('/spaceAnalysisWorker.js')

      // Ensure we send an ArrayBuffer to the worker
      let arrayBuffer: ArrayBuffer | null = null
      if (model?.file instanceof File) {
        arrayBuffer = await model.file.arrayBuffer()
      } else if (model?.file instanceof ArrayBuffer) {
        arrayBuffer = model.file
      }

      if (!arrayBuffer) {
        reject(new Error('No IFC ArrayBuffer available on the model. Make sure the IFC file is loaded.'))
        return
      }

      // Set timeout for worker response (increased for large models)
      const timeout = setTimeout(() => {
        worker.terminate()
        reject(new Error('Space analysis timed out'))
      }, 120000) // 2 minute timeout for large models

      worker.onmessage = (event) => {
        if (event.data.type === 'progress' && event.data.progress) {
          // Handle progress updates - pass to callback if provided
          const progressMessage = event.data.progress.message
          console.log(`[Space Analysis] ${progressMessage}`)

          // Call the progress callback if provided
          if (onProgress) {
            onProgress(progressMessage)
          }
          return // Don't resolve yet, just handle progress
        }

        // Handle final result
        clearTimeout(timeout)
        worker.terminate()

        if (event.data.error) {
          reject(new Error(event.data.error))
        } else {
          resolve(event.data.result)
        }
      }

      worker.onerror = (error) => {
        clearTimeout(timeout)
        worker.terminate()
        reject(error)
      }

      // Send analysis request to worker with ArrayBuffer
      worker.postMessage(
        {
          type: 'analyzeSpaces',
          model: {
            fileBuffer: arrayBuffer, // ArrayBuffer instead of File
            name: model.name,
            id: model.id
          },
          elements: elements.map(e => ({
            id: e.id,
            expressId: e.expressId,
            type: e.type,
            GlobalId: e.properties?.GlobalId
          })),
          metric
        },
        [arrayBuffer] // Transfer ArrayBuffer to avoid copying
      )
    } catch (err) {
      reject(err)
    }
  })
}

