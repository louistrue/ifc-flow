/**
 * Python Handler
 * Handles Python script execution in Pyodide
 */

import type { BaseWorkerMessage } from '../worker-types'
import { postError, postProgress, postMessage } from '../worker-utils'
import { PyodideManager } from '../shared/pyodide-manager'
import { WorkerState } from '../core/state'

interface RunPythonMessage extends BaseWorkerMessage {
  action: 'runPython'
  data: {
    script: string
    arrayBuffer?: ArrayBuffer | ArrayBufferLike
    inputData?: any
    properties?: Record<string, any>
  }
}

/**
 * Handle Python script execution
 */
export async function handleRunPython(message: RunPythonMessage): Promise<void> {
  const { messageId, data } = message
  const { script, arrayBuffer, inputData, properties } = data

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

    // Write IFC file only if arrayBuffer is provided
    let hasIfcFile = false
    if (arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
      try {
        pyodide.FS.writeFile('model.ifc', new Uint8Array(arrayBuffer))
        hasIfcFile = true
      } catch (fsError) {
        // Ignore FS errors
      }
    }

    const namespace = pyodide.globals.get('dict')()

    // Set up all the variables that should be available to the Python code
    namespace.set('user_script', script)
    namespace.set('input_data_json', JSON.stringify(inputData || null))
    namespace.set('properties_json', JSON.stringify(properties || {}))

    const pythonCode = `
import json, ifcopenshell, traceback
import os

# Initialize all variables that should be available to user code
ifc_file = None
model = None  # Legacy alias for ifc_file
input_data = None
properties = {}
result = None
has_ifc_file = ${hasIfcFile ? 'True' : 'False'}

try:
    # Load IFC file if available
    if has_ifc_file and os.path.exists('model.ifc'):
        try:
            ifc_file = ifcopenshell.open('model.ifc')
            model = ifc_file  # Legacy alias
            print("Python: IFC file loaded successfully")
        except Exception as ifc_error:
            print(f"Python: Warning - Could not load IFC file: {ifc_error}")
            ifc_file = None
            model = None
    elif not has_ifc_file:
        print("Python: No IFC file provided - ifc_file will be None")
    
    # Parse input data and properties
    try:
        input_data = json.loads(input_data_json) if input_data_json != "null" else None
        if input_data is not None:
            print(f"Python: Input data loaded - type: {type(input_data)}")
    except Exception as parse_error:
        print(f"Python: Warning - Could not parse input data: {parse_error}")
        input_data = None
        
    try:
        properties = json.loads(properties_json)
        print(f"Python: Properties loaded - keys: {list(properties.keys())}")
    except Exception as props_error:
        print(f"Python: Warning - Could not parse properties: {props_error}")
        properties = {}
    
    # Execute user script with all variables available
    print("Python: Executing user script...")

    # Execute user script safely and capture a result if available
    import ast

    # First, execute the entire script (variables, functions, prints, etc.)
    exec(user_script)

    # Try to capture the last expression's value from the script
    last_value = None
    try:
        parsed = ast.parse(user_script, mode='exec')
        last_stmt = parsed.body[-1] if parsed.body else None
        if isinstance(last_stmt, ast.Expr):
            last_expr = ast.Expression(last_stmt.value)
            compiled = compile(last_expr, filename='<user_script_last_expr>', mode='eval')
            last_value = eval(compiled)
            print(f"Python: Last expression evaluated - type: {type(last_value)}")
        else:
            print("Python: No evaluable last expression detected")
    except Exception as eval_err:
        print(f"Python: Could not evaluate last expression: {eval_err}")

    # Use explicit 'result' if user set it to a non-None value; otherwise fallback to last_value
    try:
        _r = result  # noqa: F821
        if _r is None and last_value is not None:
            result = last_value
            print("Python: Using last expression value as result")
        else:
            print(f"Python: Using user-defined result - type: {type(result)}")
    except NameError:
        result = last_value
        print("Python: No 'result' defined; using last expression value")

    # Serialize result to JSON
    def serialize_result(obj):
        """Helper to serialize Python objects to JSON-compatible format"""
        if obj is None:
            return None
        elif isinstance(obj, (str, int, float, bool)):
            return obj
        elif isinstance(obj, (list, tuple)):
            return [serialize_result(item) for item in obj]
        elif isinstance(obj, dict):
            return {str(k): serialize_result(v) for k, v in obj.items()}
        elif hasattr(obj, '__dict__'):
            # Custom objects - convert to dict
            return serialize_result(obj.__dict__)
        else:
            # Fallback: convert to string
            return str(obj)

    # Serialize the result
    try:
        serialized_result = serialize_result(result)
        result_json = json.dumps(serialized_result)
        success = True
        error_msg = None
    except Exception as serialize_error:
        print(f"Python: Error serializing result: {serialize_error}")
        result_json = json.dumps({"error": f"Could not serialize result: {str(serialize_error)}"})
        success = False
        error_msg = str(serialize_error)

except Exception as e:
    print(f"Python ERROR: {str(e)}")
    error_msg = str(e)
    error_trace = traceback.format_exc()
    print(f"Python TRACEBACK: {error_trace}")
    success = False
    result_json = json.dumps({"error": error_msg, "traceback": error_trace})
`

    // Execute the Python code
    await pyodide.runPythonAsync(pythonCode, { globals: namespace })

    // Get the result from the namespace
    const success = namespace.get('success')
    if (!success) {
      const errorMsg = namespace.get('error_msg')
      throw new Error(`Python execution failed: ${errorMsg}`)
    }

    const resultJson = namespace.get('result_json')
    const result = JSON.parse(resultJson)

    // Clean up namespace
    namespace.destroy()

    // Send the result back to the main thread
    postMessage({
      type: 'pythonResult',
      result: result,
      messageId,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

