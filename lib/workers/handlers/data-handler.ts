/**
 * Data Handler
 * Handles data extraction operations (extractData, extractQuantities)
 */

import type { BaseWorkerMessage } from '../worker-types'
import { postError, postProgress, postMessage } from '../worker-utils'
import { PyodideManager } from '../shared/pyodide-manager'
import { WorkerState } from '../core/state'

interface ExtractDataMessage extends BaseWorkerMessage {
  action: 'extractData'
  data: {
    types?: string[]
    arrayBuffer?: ArrayBuffer | ArrayBufferLike
  }
}

interface ExtractQuantitiesMessage extends BaseWorkerMessage {
  action: 'extractQuantities'
  data: {
    elementIds?: number[]
    quantityType?: string
    groupBy?: string
    arrayBuffer: ArrayBuffer | ArrayBufferLike
  }
}

/**
 * Handle data extraction
 */
export async function handleExtractData(message: ExtractDataMessage): Promise<void> {
  const { messageId, data } = message
  const { types = ['IfcWall'], arrayBuffer } = data

  try {
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

    postProgress(messageId, 60, 'Converting IFC to structured data...')

    // Write IFC file if provided
    if (arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
      pyodide.FS.writeFile('model.ifc', new Uint8Array(arrayBuffer))
    }

    const namespace = pyodide.globals.get('dict')()

    // Set the types in the namespace
    namespace.set('types_str', JSON.stringify(types))

    // Python code for data extraction
    const pythonCode = `
import sys
import json
import traceback
import os
import ifcopenshell

try:
    print("Python: Loading IFC file for structured extraction")
    # Load the IFC file (always from filesystem)
    if not os.path.exists('model.ifc'):
        raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem.")
    ifc_file = ifcopenshell.open('model.ifc')
    print("Python: IFC file loaded successfully")
    
    # Parse requested types
    requested_types = json.loads(types_str)
    print(f"Python: Requested types: {requested_types}")
    
    # Helper function to extract common properties from an element
    def extract_common_properties(element):
        """Extract properties without relying on ifcopenshell.util.element"""
        properties = {}
        
        # Basic properties available on all IFC elements
        if hasattr(element, "GlobalId"):
            properties["GlobalId"] = element.GlobalId
        if hasattr(element, "Name"):
            properties["Name"] = element.Name or f"Unnamed {element.is_a()}"
        if hasattr(element, "Description"):
            properties["Description"] = element.Description
        
        # Extract property sets
        properties["psets"] = {}
        if hasattr(element, "IsDefinedBy"):
            for rel in element.IsDefinedBy:
                if rel.is_a("IfcRelDefinesByProperties"):
                    prop_def = rel.RelatingPropertyDefinition
                    if prop_def.is_a("IfcPropertySet"):
                        pset_name = prop_def.Name if hasattr(prop_def, "Name") else "Unknown"
                        pset_props = {}
                        if hasattr(prop_def, "HasProperties"):
                            for prop in prop_def.HasProperties:
                                if prop.is_a("IfcPropertySingleValue") and hasattr(prop, "NominalValue"):
                                    prop_name = prop.Name if hasattr(prop, "Name") else "Unknown"
                                    try:
                                        prop_value = prop.NominalValue.wrappedValue if hasattr(prop.NominalValue, "wrappedValue") else str(prop.NominalValue)
                                        pset_props[prop_name] = prop_value
                                    except:
                                        pset_props[prop_name] = str(prop.NominalValue)
                        properties["psets"][pset_name] = pset_props
        
        return properties
    
    # Extract elements of requested types
    all_elements = []
    for element_type in requested_types:
        try:
            elements = ifc_file.by_type(element_type)
            print(f"Python: Found {len(elements)} elements of type {element_type}")
            for element in elements:
                try:
                    element_data = {
                        "expressId": element.id(),
                        "type": element.is_a(),
                        "properties": extract_common_properties(element)
                    }
                    all_elements.append(element_data)
                except Exception as elem_error:
                    print(f"Python: Error processing element: {elem_error}")
                    continue
        except Exception as type_error:
            print(f"Python: Error processing type {element_type}: {type_error}")
            continue
    
    result_json = json.dumps(all_elements)
    success = True
    error_msg = None
    
except Exception as e:
    print(f"Python ERROR: {str(e)}")
    error_msg = str(e)
    error_trace = traceback.format_exc()
    print(f"Python TRACEBACK: {error_trace}")
    success = False
    result_json = json.dumps([])
`

    await pyodide.runPythonAsync(pythonCode, { globals: namespace })

    const success = namespace.get('success')
    if (!success) {
      const errorMsg = namespace.get('error_msg')
      throw new Error(`Python data extraction failed: ${errorMsg}`)
    }

    const resultJson = namespace.get('result_json')
    const elements = JSON.parse(resultJson)

    namespace.destroy()

    postProgress(messageId, 100, 'Data extraction complete!')

    postMessage({
      type: 'dataExtracted',
      messageId,
      elements: elements,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Handle quantity extraction
 */
export async function handleExtractQuantities(message: ExtractQuantitiesMessage): Promise<void> {
  const { messageId, data } = message
  const { elementIds = [], quantityType = 'area', groupBy = 'none', arrayBuffer } = data

  try {
    postProgress(messageId, 10, 'Starting quantity extraction...')

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

    // Write IFC file to filesystem
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error('ArrayBuffer for IFC file was not provided or is invalid.')
    }

    try {
      pyodide.FS.writeFile('model.ifc', new Uint8Array(arrayBuffer))
    } catch (fsError) {
      throw new Error(
        `Failed to prepare IFC file in VFS: ${fsError instanceof Error ? fsError.message : String(fsError)}`
      )
    }

    const namespace = pyodide.globals.get('dict')()

    // Set parameters
    namespace.set('element_ids_json', JSON.stringify(elementIds))
    namespace.set('quantity_type', quantityType.toLowerCase())
    namespace.set('group_by', groupBy)

    // Python code for quantity extraction (simplified version)
    const pythonCode = `
import ifcopenshell
import ifcopenshell.util.unit
import json
import traceback
import os

try:
    # Load the IFC file
    if not os.path.exists('model.ifc'):
        raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem.")
    
    ifc_file = ifcopenshell.open('model.ifc')
    print(f"Loaded IFC file for quantity extraction")
    
    element_ids = json.loads(element_ids_json)
    quantity_type = quantity_type.lower()
    group_by_option = group_by.lower()
    
    unit_symbol = ""
    
    # Helper: get unit symbol for quantity type
    def get_unit_symbol_for_quantity(ifc_file, quantity_type):
        unit_type_map = {
            "area": "AREAUNIT",
            "volume": "VOLUMEUNIT",
            "length": "LENGTHUNIT",
        }
        unit_type = unit_type_map.get(quantity_type)
        if not unit_type:
            return ""
            
        unit_entity = ifcopenshell.util.unit.get_project_unit(ifc_file, unit_type)
        if unit_entity:
            return ifcopenshell.util.unit.get_unit_symbol(unit_entity)
        else:
            print(f"Warning: No default project unit found for {unit_type}")
            return unit_type
    
    unit_symbol = get_unit_symbol_for_quantity(ifc_file, quantity_type)
    print(f"Determined unit symbol: {unit_symbol}")
    
    # Helper: extract quantity from element
    def extract_quantity(element, quantity_type):
        for rel in getattr(element, "IsDefinedBy", []):
            if rel.is_a("IfcRelDefinesByProperties"):
                prop_def = rel.RelatingPropertyDefinition
                if prop_def.is_a("IfcElementQuantity"):
                    for q in getattr(prop_def, "Quantities", []):
                        if quantity_type == "area" and q.is_a("IfcQuantityArea"):
                            return getattr(q, "AreaValue", None)
                        elif quantity_type == "volume" and q.is_a("IfcQuantityVolume"):
                            return getattr(q, "VolumeValue", None)
                        elif quantity_type == "length" and q.is_a("IfcQuantityLength"):
                            return getattr(q, "LengthValue", None)
        if quantity_type == "count":
            return 1
        return None

    # Process elements and collect quantities
    processed = 0
    element_quantities = []
    
    for eid in element_ids:
        try:
            element = ifc_file.by_id(eid)
            if not element:
                continue
                
            value = extract_quantity(element, quantity_type)
            if value is None:
                continue

            group_value = "All"
            if group_by_option == "type":
                element_type = element.is_a()
                if element_type:
                    if element_type.startswith("Ifc"):
                        element_type = element_type[3:]
                    group_value = element_type
            elif group_by_option == "level":
                for rel in ifc_file.by_type("IfcRelContainedInSpatialStructure"):
                    if not hasattr(rel, "RelatedElements") or not rel.RelatedElements:
                        continue
                    if not hasattr(rel, "RelatingStructure") or not rel.RelatingStructure:
                        continue
                    is_in_relation = False
                    for related_element in rel.RelatedElements:
                        if related_element.id() == eid:
                            is_in_relation = True
                            break
                    if is_in_relation and rel.RelatingStructure.is_a("IfcBuildingStorey"):
                        storey_name = getattr(rel.RelatingStructure, "Name", None) or f"Level {rel.RelatingStructure.id()}"
                        group_value = storey_name
                        break
            
            element_quantities.append({
                "expressId": eid,
                "quantity": value,
                "group": group_value
            })
            
            processed += 1
            if processed % 20 == 0:
                progress = int(10 + 80 * processed / max(1, len(element_ids)))
                globals()["progress_info"] = {"processed": processed, "total": len(element_ids), "percentage": progress}
        except Exception as elem_err:
            print(f"Error processing element {eid}: {elem_err}")
            continue
    
    # Group the results
    grouped_quantities = {}
    for item in element_quantities:
        group = item["group"]
        quantity = item["quantity"]
        if group not in grouped_quantities:
            grouped_quantities[group] = 0
        grouped_quantities[group] += quantity
    if not grouped_quantities:
        grouped_quantities["All"] = 0
    
    total_quantity = sum(grouped_quantities.values())
    globals()["progress_info"] = {"processed": processed, "total": len(element_ids), "percentage": 90}
    
    result = {
        "groups": grouped_quantities,
        "unit": unit_symbol,
        "total": total_quantity,
        "groupBy": group_by_option
    }
    
    result_json = json.dumps(result)
    success = True
    error_msg = None
    error_trace = None
except Exception as e:
    result = {
        "groups": {"Error": 0},
        "unit": "",
        "total": 0,
        "error": str(e)
    }
    result_json = json.dumps(result)
    success = False
    error_msg = str(e)
    error_trace = traceback.format_exc()
`

    // Progress updater
    const progressUpdater = setInterval(() => {
      try {
        if (namespace.has('progress_info')) {
          const progressInfo = namespace.get('progress_info')
          if (progressInfo) {
            postProgress(
              messageId,
              progressInfo.percentage,
              `Extracted ${progressInfo.processed}/${progressInfo.total} elements...`
            )
          }
        }
      } catch (e) {
        // Ignore progress update errors
      }
    }, 500)

    // Run the Python code
    await pyodide.runPythonAsync(pythonCode, { globals: namespace })
    clearInterval(progressUpdater)

    const success = namespace.get('success')
    if (!success) {
      const errorMsg = namespace.get('error_msg')
      const errorTrace = namespace.get('error_trace')
      throw new Error(`Python error: ${errorMsg}\n${errorTrace}`)
    }

    const resultJson = namespace.get('result_json')
    const results = JSON.parse(resultJson)

    namespace.destroy()

    postProgress(messageId, 100, 'Quantity extraction complete!')

    postMessage({
      type: 'quantityResults',
      messageId,
      data: results,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

