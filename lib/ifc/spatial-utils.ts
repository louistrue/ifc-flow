import type { IfcElement } from "@/lib/ifc/ifc-loader";

// Helper function to check if an element is a spatial structure element
function isSpatialElement(element: IfcElement): boolean {
  const spatialTypes = [
    "IFCPROJECT",
    "IFCSITE",
    "IFCBUILDING",
    "IFCBUILDINGSTOREY",
    "IFCSPACE",
  ];
  return spatialTypes.includes(element.type.toUpperCase());
}

// Helper function to get the containing storey of an element
function getContainingStorey(element: IfcElement): string | undefined {
  // First check direct BuildingStorey property
  if (element.properties?.BuildingStorey) {
    return element.properties.BuildingStorey;
  }

  // Then check in common property sets
  if (element.psets) {
    // Check Pset_SpaceLevelInfo
    if (element.psets["Pset_SpaceLevelInfo"]?.Reference) {
      return element.psets["Pset_SpaceLevelInfo"].Reference;
    }

    // Check other common locations
    for (const psetName in element.psets) {
      const pset = element.psets[psetName];
      if (pset.Level || pset.StoreyName || pset.BuildingStorey) {
        return pset.Level || pset.StoreyName || pset.BuildingStorey;
      }
    }
  }

  return undefined;
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

  // Check if reference elements are spatial structure elements
  const hasSpatialRefs = referenceElements.some(isSpatialElement);

  switch (queryType) {
    case "contained":
      if (hasSpatialRefs) {
        // Handle containment by spatial structure
        return elements.filter((element) => {
          // Get the element's storey
          const elementStorey = getContainingStorey(element);
          if (!elementStorey) return false;

          // Check if any reference element matches
          return referenceElements.some((ref) => {
            if (ref.type.toUpperCase() === "IFCBUILDINGSTOREY") {
              return ref.properties?.Name === elementStorey;
            }
            if (ref.type.toUpperCase() === "IFCBUILDING") {
              // All storeys are contained in the building
              return true;
            }
            return false;
          });
        });
      } else {
        // Mock containment for non-spatial elements
        return elements.slice(0, Math.floor(elements.length * 0.7));
      }

    case "containing":
      if (hasSpatialRefs) {
        // For spatial elements, return all elements they contain
        return elements.filter((element) => {
          const elementStorey = getContainingStorey(element);
          if (!elementStorey) return false;

          return referenceElements.some((ref) => {
            if (ref.type.toUpperCase() === "IFCBUILDINGSTOREY") {
              return ref.properties?.Name === elementStorey;
            }
            return false;
          });
        });
      } else {
        // Mock for non-spatial elements
        return elements.slice(0, Math.floor(elements.length * 0.3));
      }

    case "intersecting":
      // Mock: return 50% of elements
      return elements.slice(0, Math.floor(elements.length * 0.5));

    case "touching":
      // Mock: return 20% of elements
      return elements.slice(0, Math.floor(elements.length * 0.2));

    case "within-distance":
      // Mock: return elements based on distance parameter
      const ratio = Math.min(1, distance / 5); // 0-5m maps to 0-100%
      return elements.slice(0, Math.floor(elements.length * ratio));

    default:
      return elements;
  }
}

// Relationship query functions
export function queryRelationships(
  elements: IfcElement[],
  relationType = "containment",
  direction = "outgoing"
): IfcElement[] {
  console.log("Relationship query:", relationType, direction);

  // Mock implementation - would use actual IFC relationship data
  // Just return a subset of elements as a simulation
  const ratioMap = {
    containment: 0.6,
    aggregation: 0.4,
    voiding: 0.2,
    material: 0.8,
    "space-boundary": 0.3,
  };

  const ratio = ratioMap[relationType] || 0.5;
  return elements.slice(0, Math.floor(elements.length * ratio));
}
