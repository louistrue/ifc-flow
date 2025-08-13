// Re-export functions from the main ifc-utils module to maintain backwards compatibility
// This file is kept for legacy imports but delegates to the consolidated implementations

export { 
  extractGeometry, 
  extractGeometryWithGeom, 
  transformElements 
} from "../ifc-utils";

// Re-export types (excluding IfcElement and IfcModel to avoid conflicts with ifc-loader.ts)
// Types are available from ifc-loader.ts instead
