/**
 * Geometry Handler
 * Handles geometry extraction from IFC files
 */

import type { BaseWorkerMessage } from '../worker-types'
import { postError, postProgress, postMessage } from '../worker-utils'
import { PyodideManager } from '../shared/pyodide-manager'
import { WorkerState } from '../core/state'

interface ExtractGeometryMessage extends BaseWorkerMessage {
  action: 'extractGeometry'
  data: {
    elementType?: string
    includeOpenings?: boolean
    arrayBuffer: ArrayBuffer | ArrayBufferLike
  }
}

/**
 * Handle geometry extraction
 */
export async function handleExtractGeometry(message: ExtractGeometryMessage): Promise<void> {
  const { messageId, data } = message
  const { elementType = 'all', includeOpenings = true, arrayBuffer } = data

  let mountSuccessful = false
  let progressUpdater: ReturnType<typeof setInterval> | undefined
  const VFS_PATH = '/data'
  const VFS_FILENAME = 'model.ifc'
  const VFS_FULL_PATH = `${VFS_PATH}/${VFS_FILENAME}`

  try {
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error('Valid ArrayBuffer not received in handleExtractGeometry.')
    }

    // Initialize Pyodide
    const pyodideManager = PyodideManager.getInstance()
    const progressCallback = (percentage: number, msg: string) => {
      postProgress(messageId, percentage, msg)
    }

    const ensureIfc2sqlPyCode = async (): Promise<string | null> => {
      try {
        const res = await fetch('/ifc2sql.py')
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
        return await res.text()
      } catch (e) {
        console.warn('Failed to load ifc2sql.py:', e)
        return null
      }
    }

    const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode)
    const state = WorkerState.getInstance()
    state.setPyodide(pyodide)

    // Mount buffer directly using FS.createDataFile
    try {
      // Ensure directory exists
      pyodide.FS.mkdirTree(VFS_PATH)
      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(arrayBuffer as ArrayBuffer)
      // Mount the data file
      pyodide.FS.createDataFile(VFS_PATH, VFS_FILENAME, uint8Array, true, true, true)
      mountSuccessful = true
    } catch (mountError) {
      throw new Error(
        `Failed to mount IFC data in worker: ${mountError instanceof Error ? mountError.message : String(mountError)}`
      )
    }

    postProgress(messageId, 10, 'Preparing geometry extraction...')

    // Create namespace for Python execution
    const namespace = pyodide.globals.get('dict')()

    // Set parameters in the namespace
    namespace.set('element_type', elementType)
    namespace.set('include_openings', includeOpenings ? true : false)
    namespace.set('vfs_path', VFS_FULL_PATH)

    // Python code for geometry extraction
    const pythonCode = `
import sys
import json
import traceback
import os
import ifcopenshell
import numpy as np
from collections import defaultdict

try:
    # Check if file exists in VFS
    if not os.path.exists(vfs_path):
        raise FileNotFoundError(f"File not found at {vfs_path}")
    
    # Load the IFC file
    ifc_file = ifcopenshell.open(vfs_path)
    print(f"Loaded IFC file with schema: {ifc_file.schema}")
    
    # Use element_type directly - users can handle IFC classes
    if element_type == "all":
        # Extract all elements with geometry (dynamic discovery within this function)
        print("Python: Discovering element types with geometric representation...")
        
        # Get all IfcProduct elements (physical elements that can have geometry)
        all_products = ifc_file.by_type('IfcProduct')
        print(f"Python: Found {len(all_products)} total IfcProduct elements")
        
        # Always include essential spatial/project elements
        essential_spatial_types = {
            'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 
            'IFCSPACE', 'IFCZONE', 'IFCFACILITY', 'IFCFACILITYPART'
        }
        
        discovered_types = set()
        
        # Add essential spatial elements first
        for element in ifc_file:
            try:
                element_type_name = element.is_a()
                if element_type_name.upper() in essential_spatial_types:
                    discovered_types.add(element_type_name)
            except:
                continue
        
        # Filter IfcProduct elements based on geometric representation
        for element in all_products:
            try:
                element_type_name = element.is_a()
                
                # Skip if already added as spatial element
                if element_type_name.upper() in essential_spatial_types:
                    continue
                
                # Check if element has geometric representation
                has_geometry = False
                try:
                    if hasattr(element, 'Representation') and element.Representation is not None:
                        has_geometry = True
                except Exception:
                    has_geometry = False
                
                # Only add elements that have geometric representation
                if has_geometry:
                    discovered_types.add(element_type_name)
                    
            except Exception:
                continue
        
        element_types_to_extract = sorted(list(discovered_types))
        print(f"Python: Discovered {len(element_types_to_extract)} element types for geometry extraction")
    else:
        # Use the provided element_type directly as IFC class name
        element_types_to_extract = [element_type]
    
    # Get all elements of specified types
    all_elements = []
    for element_type in element_types_to_extract:
        try:
            type_elements = ifc_file.by_type(element_type)
            all_elements.extend(type_elements)
            print(f"Found {len(type_elements)} elements of type {element_type}")
        except Exception as e:
            print(f"Error getting elements of type {element_type}: {e}")
    
    # Filter out openings if necessary
    if not include_openings:
        all_elements = [e for e in all_elements if not e.is_a("IfcOpeningElement")]
    
    # Create results array
    result_elements = []
    total_elements = len(all_elements)
    processed_count = 0
    
    # Helper function to extract placement data from an element
    def get_placement_data(element):
        placement_data = {"type": "placement", "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}
        
        try:
            if hasattr(element, "ObjectPlacement") and element.ObjectPlacement:
                placement = element.ObjectPlacement
                
                # Get local placement coordinates
                if hasattr(placement, "RelativePlacement") and placement.RelativePlacement:
                    rel_placement = placement.RelativePlacement
                    
                    # Get position from location
                    if hasattr(rel_placement, "Location") and rel_placement.Location:
                        location = rel_placement.Location
                        if hasattr(location, "Coordinates"):
                            coords = location.Coordinates
                            placement_data["position"] = [
                                coords[0] if len(coords) > 0 else 0, 
                                coords[1] if len(coords) > 1 else 0, 
                                coords[2] if len(coords) > 2 else 0
                            ]
                            
                    # Try to get rotation information
                    if hasattr(rel_placement, "RefDirection") and rel_placement.RefDirection:
                        ref_dir = rel_placement.RefDirection
                        if hasattr(ref_dir, "DirectionRatios"):
                            # This is a simplification - proper rotation calculation would require more complex math
                            dir_ratios = ref_dir.DirectionRatios
                            if len(dir_ratios) >= 2:
                                # Calculate rotation angle in Z axis from X direction
                                x, y = dir_ratios[0], dir_ratios[1]
                                angle_z = np.arctan2(y, x)
                                placement_data["rotation"] = [0, 0, angle_z]
        except Exception as e:
            print(f"Error extracting placement: {e}")
            
        return placement_data
    
    # Helper function to extract basic dimensions from an element
    def get_dimensions(element):
        # Default dimensions
        dims = {"x": 1.0, "y": 1.0, "z": 1.0}
        
        try:
            # Try to get dimensions from representation
            if hasattr(element, "Representation") and element.Representation:
                rep = element.Representation
                
                # Look through representations for useful info
                if hasattr(rep, "Representations"):
                    for representation in rep.Representations:
                        rep_id = representation.RepresentationIdentifier if hasattr(representation, "RepresentationIdentifier") else None
                        
                        # Check for quantitative information in property sets
                        if hasattr(element, "IsDefinedBy"):
                            for definition in element.IsDefinedBy:
                                if definition.is_a("IfcRelDefinesByProperties"):
                                    prop_set = definition.RelatingPropertyDefinition
                                    
                                    # Look for quantity sets
                                    if prop_set.is_a("IfcElementQuantity"):
                                        for quantity in prop_set.Quantities:
                                            if quantity.is_a("IfcQuantityLength"):
                                                if quantity.Name == "Length" or quantity.Name == "Width" or quantity.Name == "Height":
                                                    if quantity.Name == "Length":
                                                        dims["x"] = float(quantity.LengthValue)
                                                    elif quantity.Name == "Width":
                                                        dims["y"] = float(quantity.LengthValue)
                                                    elif quantity.Name == "Height":
                                                        dims["z"] = float(quantity.LengthValue)
        except Exception as e:
            print(f"Error getting dimensions: {e}")
            
        # Apply default dimensions based on element type if not found
        if element.is_a("IfcWall") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 5.0, "y": 0.3, "z": 3.0}  # Typical wall
        elif element.is_a("IfcSlab") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 10.0, "y": 10.0, "z": 0.3}  # Typical slab
        elif element.is_a("IfcDoor") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 1.0, "y": 0.2, "z": 2.1}  # Typical door
        elif element.is_a("IfcWindow") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 1.5, "y": 0.1, "z": 1.5}  # Typical window
        elif element.is_a("IfcBeam") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 5.0, "y": 0.3, "z": 0.5}  # Typical beam
        elif element.is_a("IfcColumn") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 0.5, "y": 0.5, "z": 3.0}  # Typical column
            
        return dims
    
    # Process each element to extract simplified geometry
    for element in all_elements:
        try:
            processed_count += 1
            
            # Extract placement data
            placement_data = get_placement_data(element)
            
            # Extract dimensions
            dimensions = get_dimensions(element)
            
            # Create simplified cuboid vertices based on dimensions
            x, y, z = dimensions["x"], dimensions["y"], dimensions["z"]
            
            # Create a simple box - 8 vertices
            verts = [
                # Bottom face
                [-x/2, -y/2, 0],    # 0
                [x/2, -y/2, 0],     # 1
                [x/2, y/2, 0],      # 2
                [-x/2, y/2, 0],     # 3
                # Top face
                [-x/2, -y/2, z],    # 4
                [x/2, -y/2, z],     # 5
                [x/2, y/2, z],      # 6
                [-x/2, y/2, z]      # 7
            ]
            
            # Create simple box faces - 6 faces, each is a quad (4 vertices)
            faces = [
                [0, 1, 2, 3],  # Bottom face
                [4, 5, 6, 7],  # Top face
                [0, 1, 5, 4],  # Front face
                [2, 3, 7, 6],  # Back face
                [0, 3, 7, 4],  # Left face
                [1, 2, 6, 5]   # Right face
            ]
            
            # Basic element data structure
            element_data = {
                "id": f"{element.is_a()}-{element.id()}",
                "expressId": element.id(),
                "type": element.is_a(),
                "properties": {
                    "GlobalId": element.GlobalId if hasattr(element, "GlobalId") else None,
                    "Name": element.Name if hasattr(element, "Name") else None
                },
                "geometry": {
                    "type": "simplified",
                    "vertices": verts,
                    "faces": faces,
                    "dimensions": dimensions,
                    "placement": placement_data
                }
            }
            
            # Add additional IFC properties if available
            try:
                # Try to extract property sets if available
                if hasattr(element, "IsDefinedBy"):
                    property_values = {}
                    for definition in element.IsDefinedBy:
                        if definition.is_a("IfcRelDefinesByProperties"):
                            property_set = definition.RelatingPropertyDefinition
                            if property_set.is_a("IfcPropertySet"):
                                for prop in property_set.HasProperties:
                                    if prop.is_a("IfcPropertySingleValue") and prop.NominalValue:
                                        property_values[prop.Name] = prop.NominalValue.wrappedValue
                    
                    # Add extracted properties
                    element_data["properties"].update(property_values)
            except Exception as props_error:
                print(f"Error extracting properties: {props_error}")
            
            # Add to results
            result_elements.append(element_data)
            
            # Store progress info for JS to retrieve
            progress_info = {
                "processed": processed_count,
                "total": total_elements,
                "percentage": int((processed_count / total_elements) * 100)
            }
            
        except Exception as element_error:
            print(f"Error processing element {element.id()}: {element_error}")
            continue
    
    # Convert results to JSON
    result_json = json.dumps(result_elements)
    
    # Final progress info
    progress_info = {
        "processed": processed_count,
        "total": total_elements,
        "percentage": 100
    }
    
    # Success flag
    success = True
    
except Exception as e:
    print(f"Error in geometry extraction: {e}")
    print(traceback.format_exc())
    result_json = json.dumps([{"error": str(e)}])
    success = False
    progress_info = {"processed": 0, "total": 0, "percentage": 0}
`

    postProgress(messageId, 20, 'Loading IFC file...')

    // Execute Python code with progress updates
    try {
      // Send progress updates at regular intervals during processing
      progressUpdater = setInterval(() => {
        try {
          // Try to get progress info from namespace if available
          if (namespace.has('progress_info')) {
            const progressInfo = namespace.get('progress_info')
            if (progressInfo) {
              const percentage = Math.min(40 + Math.floor(progressInfo.percentage * 0.6), 99)
              postProgress(
                messageId,
                percentage,
                `Processing element ${progressInfo.processed}/${progressInfo.total}...`
              )
            }
          }
        } catch (e) {
          // Ignore errors in progress updates
        }
      }, 500) // Check progress every 500ms

      // Run the Python code
      await pyodide.runPythonAsync(pythonCode, { globals: namespace })

      // Clear the progress updater
      if (progressUpdater) {
        clearInterval(progressUpdater)
        progressUpdater = undefined
      }

      // Get the result from the namespace
      const success = namespace.get('success')

      if (!success) {
        throw new Error('Geometry extraction failed in Python')
      }

      const resultJson = namespace.get('result_json')
      const elements = JSON.parse(resultJson)

      // Clean up VFS file
      if (mountSuccessful) {
        try {
          pyodide.FS.unlink(VFS_FULL_PATH)
        } catch (unlinkError) {
          // Ignore unlink errors
        }
      }

      // Clean up namespace
      namespace.destroy()

      postProgress(messageId, 100, 'Geometry extraction complete!')

      // Send the results back to the main thread
      postMessage({
        type: 'geometry',
        elements: elements,
        messageId,
      })
    } catch (error) {
      // Clean up
      if (mountSuccessful) {
        try {
          pyodide.FS.unlink(VFS_FULL_PATH)
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Clear any progress interval that might be running
      if (progressUpdater) {
        clearInterval(progressUpdater)
        progressUpdater = undefined
      }

      namespace.destroy()

      throw new Error(`Python geometry extraction failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Clean up VFS file on outer error too
    if (mountSuccessful) {
      try {
        const state = WorkerState.getInstance()
        const pyodide = state.getPyodide()
        if (pyodide) pyodide.FS.unlink(VFS_FULL_PATH)
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Clear any progress interval that might be running
    if (progressUpdater) {
      clearInterval(progressUpdater)
    }

    postError(messageId, new Error(`Geometry extraction failed: ${errorMessage}`))
  }
}

