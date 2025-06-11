import * as THREE from "three"
import type { IfcElement } from "@/lib/ifc/ifc-loader"
import type { IfcViewer } from "./viewer-utils"
import { getActiveViewer } from "./viewer-registry"

// Main function to perform clash detection
export async function performClashDetection(
  elements: IfcElement[],
  referenceElements: IfcElement[] = [],
  options: { tolerance?: number; showIn3DViewer?: boolean } = {}
): Promise<any> {
  const tolerance = options.tolerance || 10
  const showIn3DViewer = options.showIn3DViewer !== false

  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return { error: "No primary elements provided", clashes: 0, details: [] }
  }
  if (!referenceElements || !Array.isArray(referenceElements) || referenceElements.length === 0) {
    return { error: "No reference elements provided", clashes: 0, details: [] }
  }

  const activeViewer = getActiveViewer()

  if (!activeViewer) {
    console.error("performClashDetection Error: Could not get active viewer instance from registry!")
    return { error: "Active 3D Viewer not found for clash detection", clashes: 0, details: [] }
  }
  const currentViewerId = activeViewer.getId()

  if (!activeViewer.isReady()) {
    console.warn(`   Clash Check Skipped: Viewer ${currentViewerId} is not ready.`)
    return {
      status: 'viewer_not_ready',
      message: `Viewer ${currentViewerId} is initializing or loading geometry.`,
      clashes: 0,
      details: []
    }
  }

  console.log(`Requesting geometric clash detection on viewer ${currentViewerId} for ${elements.length} vs ${referenceElements.length} elements`)

  try {
    const elementIdsA = elements.map(el => el.expressId).filter(id => id !== undefined)
    const elementIdsB = referenceElements.map(el => el.expressId).filter(id => id !== undefined)
    if (elementIdsA.length === 0 || elementIdsB.length === 0) {
      return { error: "Could not extract valid element IDs for clash detection", clashes: 0, details: [] }
    }

    const results = activeViewer.performGeometricClashDetection(
      elementIdsA,
      elementIdsB,
      tolerance
    )

    if (showIn3DViewer && results.details && results.details.length > 0) {
      console.log(`   Requesting visualization on viewer ${currentViewerId}`)
      activeViewer.visualizeClashes(results)
    } else if (showIn3DViewer) {
      activeViewer.clearClashVisualizations()
    }

    const detailedResults = results.details.map(clashDetail => {
      const el1 = elements.find(el => el.expressId === clashDetail.element1Id)
      const el2 = referenceElements.find(el => el.expressId === clashDetail.element2Id) || elements.find(el => el.expressId === clashDetail.element2Id)
      return {
        id: clashDetail.id,
        element1: el1 ? { id: el1.expressId, type: el1.type, name: el1.properties?.Name || `ID ${el1.expressId}` } : { id: clashDetail.element1Id },
        element2: el2 ? { id: el2.expressId, type: el2.type, name: el2.properties?.Name || `ID ${el2.expressId}` } : { id: clashDetail.element2Id },
        distance: 0,
        location: null
      }
    })

    return {
      clashes: results.clashes,
      details: detailedResults,
      completed: true
    }
  } catch (error) {
    console.error(`Error during geometric clash detection call (Viewer: ${currentViewerId}):`, error)
    return { error: "Failed to perform geometric clash detection", clashes: 0, details: [] }
  }
}

// No need to export instances anymore

