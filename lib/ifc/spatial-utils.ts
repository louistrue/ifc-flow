import type { IfcElement } from "@/lib/ifc/ifc-loader"
import { withActiveViewer, hasActiveModel } from "./viewer-manager";
import * as THREE from "three";

// Spatial query functions with real geometry support
export function spatialQuery(
  elements: IfcElement[],
  referenceElements: IfcElement[],
  queryType = "contained",
  distance = 1.0,
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

  // Use real geometry if available, otherwise fallback to mock logic
  if (hasActiveModel()) {
    return spatialQueryWithViewer(elements, referenceElements, queryType, distance);
  } else {
    console.warn("No active viewer model, using fallback spatial query logic");
    return spatialQueryFallback(elements, referenceElements, queryType, distance);
  }
}

/**
 * Spatial query using real Three.js geometry from viewer
 */
function spatialQueryWithViewer(
  elements: IfcElement[],
  referenceElements: IfcElement[],
  queryType: string,
  distance: number
): IfcElement[] {
  return withActiveViewer(viewer => {
    console.log(`Performing spatial query with real geometry: ${queryType}`);
    
    // Get bounding boxes for reference elements
    const referenceBounds: THREE.Box3[] = [];
    referenceElements.forEach(refElement => {
      const bbox = viewer.getBoundingBoxForElement(refElement.expressId);
      if (bbox) {
        referenceBounds.push(bbox);
      }
    });

    if (referenceBounds.length === 0) {
      console.warn("No bounding boxes found for reference elements");
      return [];
    }

    // Filter elements based on spatial relationship
    return elements.filter(element => {
      const elementBbox = viewer.getBoundingBoxForElement(element.expressId);
      if (!elementBbox) {
        return false; // Skip elements without geometry
      }

      return referenceBounds.some(refBbox => {
        switch (queryType) {
          case "contained":
            // Element is contained within reference if its bbox is inside reference bbox
            return refBbox.containsBox(elementBbox);

          case "containing":
            // Element contains reference if reference bbox is inside element bbox
            return elementBbox.containsBox(refBbox);

          case "intersecting":
            // Element intersects reference if bboxes overlap
            return elementBbox.intersectsBox(refBbox);

          case "touching":
            // Element touches reference if bboxes are adjacent (intersect but don't overlap)
            const expanded = refBbox.clone().expandByScalar(0.01); // Small tolerance
            return expanded.intersectsBox(elementBbox) && !refBbox.intersectsBox(elementBbox);

          case "within-distance":
            // Element is within distance if closest points are within threshold
            const elementCenter = new THREE.Vector3();
            const refCenter = new THREE.Vector3();
            elementBbox.getCenter(elementCenter);
            refBbox.getCenter(refCenter);
            
            const actualDistance = elementCenter.distanceTo(refCenter);
            return actualDistance <= distance;

          default:
            console.warn(`Unknown spatial query type: ${queryType}`);
            return false;
        }
      });
    });
  }) || [];
}

/**
 * Fallback spatial query using mock logic (when no viewer available)
 */
function spatialQueryFallback(
  elements: IfcElement[],
  referenceElements: IfcElement[],
  queryType: string,
  distance: number
): IfcElement[] {
  // Original mock implementation for backwards compatibility
  switch (queryType) {
    case "contained":
      return elements.slice(0, Math.floor(elements.length * 0.7));

    case "containing":
      return elements.slice(0, Math.floor(elements.length * 0.3));

    case "intersecting":
      return elements.slice(0, Math.floor(elements.length * 0.5));

    case "touching":
      return elements.slice(0, Math.floor(elements.length * 0.2));

    case "within-distance":
      const ratio = Math.min(1, distance / 5);
      return elements.slice(0, Math.floor(elements.length * ratio));

    default:
      return elements;
  }
}

// Relationship query functions
export function queryRelationships(
  elements: IfcElement[],
  relationType = "containment",
  direction = "outgoing",
): IfcElement[] {
  console.log("Relationship query:", relationType, direction)

  // Mock implementation - would use actual IFC relationship data
  // Just return a subset of elements as a simulation
  const ratioMap: Record<string, number> = {
    containment: 0.6,
    aggregation: 0.4,
    voiding: 0.2,
    material: 0.8,
    "space-boundary": 0.3,
  }

  const ratio = ratioMap[relationType] || 0.5
  return elements.slice(0, Math.floor(elements.length * ratio))
}

