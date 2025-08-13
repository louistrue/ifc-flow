// Re-export functions from the main ifc-utils module to maintain backwards compatibility
// This file is kept for legacy imports but delegates to the consolidated implementations

export { 
  extractGeometry, 
  extractGeometryWithGeom, 
  transformElements 
} from "../ifc-utils";

// Re-export types
export type { IfcModel, IfcElement } from "../ifc-utils";
