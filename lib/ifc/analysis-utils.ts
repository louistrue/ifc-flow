import * as THREE from "three"
import type { IfcElement } from "@/lib/ifc/ifc-loader"
import type { IfcViewer } from "./viewer-utils"

// Three.js scene reference (or Viewer reference)
let viewerInstance: IfcViewer | null = null

// Class for visualizing clashes (keep this as is for now)
export class ClashVisualizer {
  private scene: THREE.Scene
  private clashObjects: THREE.Object3D[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public visualizeClashes(clashResults: any): void {
    this.clearClashes()
    if (!clashResults?.details || clashResults.details.length === 0) {
      console.log("No clashes to visualize")
      return
    }
    console.log(`Visualizing ${clashResults.details.length} clashes`)
    const clashGroup = new THREE.Group()
    clashGroup.name = "clash-visualizations"
    clashResults.details.forEach((clash: any, index: number) => {
      const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16)
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.7
      })
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)

      // ** TODO: Get clash location from geometric check instead of random **
      // For now, we don't have a precise location from bounding box check
      // Place sphere at origin or approximate midpoint later
      sphere.position.set(0, 0, 0) // Placeholder location
      if (clash.location) {
        sphere.position.set(clash.location.x, clash.location.y, clash.location.z)
      }

      sphere.userData = {
        clashId: clash.id,
        // Use IDs returned by the geometric check
        element1Id: clash.element1Id,
        element2Id: clash.element2Id,
        distance: clash.distance // Distance might not be accurate from bbox check
      }
      clashGroup.add(sphere)
    })
    this.scene.add(clashGroup)
    this.clashObjects.push(clashGroup)
  }

  public clearClashes(): void {
    this.clashObjects.forEach(obj => {
      this.scene.remove(obj)
      if (obj.type === 'Group') {
        obj.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose())
            } else {
              child.material.dispose()
            }
          }
        })
      }
    })
    this.clashObjects = []
  }
}

// Reference to the ClashVisualizer instance
let clashVisualizerInstance: ClashVisualizer | null = null

// Main function to perform clash detection - Now calls the viewer
export async function performClashDetection(
  elements: IfcElement[],
  referenceElements: IfcElement[] = [],
  options: { tolerance?: number; showIn3DViewer?: boolean } = {}
): Promise<any> {
  const tolerance = options.tolerance || 10
  const showIn3DViewer = options.showIn3DViewer !== false

  // --- Input Validation --- 
  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return { error: "No primary elements provided", clashes: 0, details: [] }
  }
  if (!referenceElements || !Array.isArray(referenceElements) || referenceElements.length === 0) {
    return { error: "No reference elements provided", clashes: 0, details: [] }
  }

  // --- Check for Viewer Instance --- 
  if (!viewerInstance) {
    return { error: "3D Viewer not available for clash detection", clashes: 0, details: [] }
  }

  console.log(`Requesting geometric clash detection for ${elements.length} primary vs ${referenceElements.length} reference elements`)

  try {
    // Extract expressIDs
    const elementIdsA = elements.map(el => el.expressId).filter(id => id !== undefined)
    const elementIdsB = referenceElements.map(el => el.expressId).filter(id => id !== undefined)

    if (elementIdsA.length === 0 || elementIdsB.length === 0) {
      return { error: "Could not extract valid element IDs for clash detection", clashes: 0, details: [] }
    }

    // Call the viewer's geometric clash detection
    const results = viewerInstance.performGeometricClashDetection(
      elementIdsA,
      elementIdsB,
      tolerance
    )

    // Visualize results if requested and we have a visualizer instance
    if (showIn3DViewer && clashVisualizerInstance && results.details && results.details.length > 0) {
      // Adapt results format if needed, or use the new format directly
      // For now, assume visualizeClashes can handle the new format { element1Id, element2Id }
      clashVisualizerInstance.visualizeClashes(results)
    }

    // Adapt the returned results to the format expected by AnalysisNode/WatchNode if necessary
    // Current format from viewer: { clashes: number, details: [{ id, element1Id, element2Id, boxIntersection }] }
    // Expected format?: { clashes: number, details: [{ id, element1: {id, type, name}, element2: {id, type, name}, distance, location? }] }
    // We need to map IDs back to element info here.
    const detailedResults = results.details.map(clashDetail => {
      const el1 = elements.find(el => el.expressId === clashDetail.element1Id)
      const el2 = referenceElements.find(el => el.expressId === clashDetail.element2Id) || elements.find(el => el.expressId === clashDetail.element2Id) // Check both lists
      return {
        id: clashDetail.id,
        element1: el1 ? { id: el1.expressId, type: el1.type, name: el1.properties?.Name || `ID ${el1.expressId}` } : { id: clashDetail.element1Id },
        element2: el2 ? { id: el2.expressId, type: el2.type, name: el2.properties?.Name || `ID ${el2.expressId}` } : { id: clashDetail.element2Id },
        distance: 0, // Bbox distance is not stored accurately here yet
        location: null // No precise location from bbox check
      }
    })

    return {
      clashes: results.clashes,
      details: detailedResults,
      completed: true // Indicate success
    }
  } catch (error) {
    console.error("Error during geometric clash detection call:", error)
    return { error: "Failed to perform geometric clash detection", clashes: 0, details: [] }
  }
}

// Function to initialize the connection to the Viewer and Visualizer
export function initClashHandler(viewer: IfcViewer): void {
  if (!viewerInstance && viewer) {
    viewerInstance = viewer
    const scene = viewer.getScene()
    if (scene && !clashVisualizerInstance) {
      clashVisualizerInstance = new ClashVisualizer(scene)
      console.log("Clash handler initialized (Viewer & Visualizer)")
    }
  } else if (!viewer) {
    // Clean up if viewer becomes null
    viewerInstance = null
    clashVisualizerInstance = null
  }
}

// Export viewer instance for potential direct use (use with caution)
// export { viewerInstance };
// Export visualizer instance only if needed externally
export { clashVisualizerInstance }

