/**
 * Export Handler
 * Handles IFC file export operations
 */

import type { BaseWorkerMessage } from '../worker-types'
import { postError, postProgress, postMessage } from '../worker-utils'
import { PyodideManager } from '../shared/pyodide-manager'
import { WorkerState } from '../core/state'

interface ExportIfcMessage extends BaseWorkerMessage {
  action: 'exportIfc'
  data: {
    arrayBuffer: ArrayBuffer | ArrayBufferLike
    filename?: string
    modifications?: any[]
  }
}

/**
 * Handle IFC file export
 */
export async function handleExportIfc(message: ExportIfcMessage): Promise<void> {
  const { messageId, data } = message
  const { arrayBuffer, filename = 'export.ifc', modifications = [] } = data

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

    postProgress(messageId, 20, 'Loading IFC file...')

    // Write the input IFC file to Pyodide filesystem
    const uint8Array = new Uint8Array(arrayBuffer as ArrayBuffer)
    pyodide.FS.writeFile('model.ifc', uint8Array)

    postProgress(messageId, 40, 'Applying modifications...')

    const namespace = pyodide.globals.get('dict')()

    // Set up variables for Python code
    namespace.set('modifications_json', JSON.stringify(modifications))
    namespace.set('output_filename', filename)

    // Python code to export IFC with optional modifications
    const pythonCode = `
import ifcopenshell
import json
import traceback
import os

try:
    # Load the IFC file
    ifc_file = ifcopenshell.open('model.ifc')
    print(f"Python: Loaded IFC file for export")
    
    # Apply modifications if provided
    modifications = json.loads(modifications_json)
    if modifications and len(modifications) > 0:
        print(f"Python: Applying {len(modifications)} modifications...")
        for mod in modifications:
            try:
                # Each modification should have: type, elementId, property, value
                mod_type = mod.get('type', 'property')
                element_id = mod.get('elementId')
                property_name = mod.get('property')
                value = mod.get('value')
                
                if element_id is None:
                    continue
                    
                element = ifc_file.by_id(element_id)
                if not element:
                    print(f"Python: Warning - Element {element_id} not found")
                    continue
                
                if mod_type == 'property':
                    # Modify property set property
                    for rel in getattr(element, 'IsDefinedBy', []):
                        if rel.is_a('IfcRelDefinesByProperties'):
                            prop_def = rel.RelatingPropertyDefinition
                            if prop_def.is_a('IfcPropertySet'):
                                for prop in getattr(prop_def, 'HasProperties', []):
                                    if prop.is_a('IfcPropertySingleValue') and prop.Name == property_name:
                                        prop.NominalValue = ifc_file.create_entity('IfcText', value)
                                        print(f"Python: Modified property {property_name} for element {element_id}")
                                        break
                                        
                elif mod_type == 'name':
                    # Modify element name
                    if hasattr(element, 'Name'):
                        element.Name = value
                        print(f"Python: Modified name for element {element_id}")
                        
            except Exception as mod_error:
                print(f"Python: Error applying modification: {mod_error}")
                continue
    
    # Write the modified file
    output_path = f'/tmp/{output_filename}'
    ifc_file.write(output_path)
    
    # Read the file bytes
    with open(output_path, 'rb') as f:
        file_bytes = f.read()
    
    # Convert to base64 for transfer (or use shared memory if available)
    import base64
    file_base64 = base64.b64encode(file_bytes).decode('utf-8')
    
    result_json = json.dumps({
        'success': True,
        'filename': output_filename,
        'file_base64': file_base64,
        'size': len(file_bytes)
    })
    
    success = True
    error_msg = None
    
except Exception as e:
    print(f"Python ERROR: {str(e)}")
    error_msg = str(e)
    error_trace = traceback.format_exc()
    print(f"Python TRACEBACK: {error_trace}")
    success = False
    result_json = json.dumps({
        'success': False,
        'error': error_msg,
        'traceback': error_trace
    })
`

    await pyodide.runPythonAsync(pythonCode, { globals: namespace })

    const success = namespace.get('success')
    if (!success) {
      const errorMsg = namespace.get('error_msg')
      throw new Error(`Python export failed: ${errorMsg}`)
    }

    const resultJson = namespace.get('result_json')
    const result = JSON.parse(resultJson)

    // Decode base64 back to ArrayBuffer
    const decodedBytes = Uint8Array.from(atob(result.file_base64), (c) => c.charCodeAt(0))

    namespace.destroy()

    postProgress(messageId, 100, 'Export complete!')

    // Send the result back
    postMessage(
      {
        type: 'exportComplete',
        messageId,
        filename: result.filename,
        size: result.size,
        bytes: decodedBytes.buffer,
      },
      [decodedBytes.buffer]
    )
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

