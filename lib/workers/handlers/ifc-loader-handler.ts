/**
 * IFC Loader Handler
 * Handles IFC file loading - both full load and fast load
 */

import type { BaseWorkerMessage } from '../worker-types'
import { postError, postProgress, postMessage } from '../worker-utils'
import { PyodideManager } from '../shared/pyodide-manager'
import { IndexedDBManager } from '../shared/indexeddb-manager'
import { SQLiteManager } from '../shared/sqlite-manager'
import { WorkerState } from '../core/state'

interface LoadIfcMessage extends BaseWorkerMessage {
  action: 'loadIfc'
  data: {
    arrayBuffer: ArrayBuffer | ArrayBufferLike
    filename: string
  }
}

interface LoadIfcFastMessage extends BaseWorkerMessage {
  action: 'loadIfcFast'
  data: {
    arrayBuffer: ArrayBuffer | ArrayBufferLike
    filename: string
  }
}

/**
 * Normalize IFC schema - convert IFC4X3 variants to IFC4X3_ADD2
 */
function normalizeIfcSchema(uint8Array: Uint8Array): Uint8Array {
  try {
    const fileContents = new TextDecoder('utf-8').decode(uint8Array)
    console.log('handleLoadIfc: Applying schema normalization')

    // Regex to match FILE_SCHEMA with IFC4X3 variants and replace with IFC4X3_ADD2
    const regex = /FILE_SCHEMA\s*\(\s*\(\s*'IFC4X3(?:_[A-Z0-9]+)?'\s*\)\s*\)/
    const replacement = "FILE_SCHEMA(('IFC4X3_ADD2'))"

    const normalizedContents = fileContents.replace(regex, replacement)
    if (normalizedContents !== fileContents) {
      console.log(
        'handleLoadIfc: Schema normalization applied - converted IFC4X3 variant to IFC4X3_ADD2'
      )
    }

    // Ensure we return a new Uint8Array with ArrayBuffer
    const encoded = new TextEncoder().encode(normalizedContents)
    const newBuffer = new ArrayBuffer(encoded.length)
    const newArray = new Uint8Array(newBuffer)
    newArray.set(encoded)
    return newArray
  } catch (normalizationError) {
    console.warn('handleLoadIfc: Schema normalization failed, proceeding with original file:', normalizationError)
    // Return a copy to ensure ArrayBuffer type
    const newBuffer = new ArrayBuffer(uint8Array.length)
    const newArray = new Uint8Array(newBuffer)
    newArray.set(uint8Array)
    return newArray
  }
}

/**
 * Handle full IFC file loading with SQLite generation
 */
export async function handleLoadIfc(message: LoadIfcMessage): Promise<void> {
  const { messageId, data } = message
  const { arrayBuffer, filename } = data

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

    postProgress(messageId, 60, 'Preparing IFC file...')

    // Normalize schema - ensure we have a proper ArrayBuffer
    const uint8ArrayBuffer = new ArrayBuffer(arrayBuffer.byteLength)
    const uint8ArrayView = new Uint8Array(uint8ArrayBuffer)
    uint8ArrayView.set(new Uint8Array(arrayBuffer))
    
    postProgress(messageId, 65, 'Normalizing IFC schema...')
    const uint8Array = normalizeIfcSchema(uint8ArrayView)

    // Write to Pyodide filesystem
    postProgress(messageId, 70, 'Writing file to memory...')
    pyodide.FS.writeFile('model.ifc', uint8Array)
    console.log('handleLoadIfc: File written to filesystem')

    postProgress(messageId, 75, 'Opening IFC file with IfcOpenShell...')
    postProgress(messageId, 80, 'Discovering element types dynamically...')
    postProgress(messageId, 85, 'Analyzing IFC structure...')

    // Create namespace for Python execution
    const namespace = pyodide.globals.get('dict')()

    // Run Python code to load and analyze IFC file
    await pyodide.runPythonAsync(
      `
      import ifcopenshell
      import json
      import sys
      import traceback
      import sqlite3
    `,
      { globals: namespace }
    )

    await pyodide.runPythonAsync(
      `
      try:
          print("Python: Loading IFC file...")
          # Load the IFC file from the virtual filesystem
          ifc_file = ifcopenshell.open('model.ifc')
          print("Python: IFC file loaded successfully")
          
          # Extract schema and basic info
          schema = ifc_file.schema
          print(f"Python: Schema identified as {schema}")
          
          # Get project info
          projects = ifc_file.by_type("IfcProject")
          project_info = None
          if projects:
              project = projects[0]
              project_info = {
                  "GlobalId": project.GlobalId,
                  "Name": project.Name or "Unnamed Project",
                  "Description": project.Description or ""
              }
              print(f"Python: Project info extracted: {project_info}")
          
          # Count elements by type
          element_counts = {}
          for ifc_class in [
              "IfcWall", "IfcSlab", "IfcBeam", "IfcColumn", "IfcDoor", 
              "IfcWindow", "IfcRoof", "IfcStair", "IfcFurnishingElement"
          ]:
              elements = ifc_file.by_type(ifc_class)
              element_counts[ifc_class] = len(elements)
              print(f"Python: Count for {ifc_class}: {len(elements)}")
          
          # Create result object
          result_obj = {
              "filename": "${filename}",
              "schema": schema,
              "project": project_info,
              "element_counts": element_counts,
              "total_elements": sum(element_counts.values()),
              "model_id": "${filename}"
          }
          print("Python: Result object created")
          
          # Enhanced Pyodide Ifc2Sql integration using official Patcher if available
          print("Python: Enhanced Ifc2Sql integration starting...")
          sqlite_db_path = '/model.db'
          sqlite_success = False
          try:
              # Prefer official ifc2sql.py Patcher loaded during init
              use_official = False
              Patcher = None

              try:
                  # Try to import from ifc2sql module first
                  import ifc2sql
                  Patcher = ifc2sql.Patcher
                  use_official = True
                  print("Python: Using official ifc2sql.py Patcher from module")
              except (ImportError, AttributeError) as e:
                  print(f"Python: Could not import Patcher from ifc2sql module: {e}")

              # Fallback: try global namespace
              if not Patcher:
                  try:
                      Patcher = globals().get('Patcher', None)
                      if Patcher:
                          use_official = True
                          print("Python: Using official ifc2sql.py Patcher from globals")
                  except:
                      pass

              if not Patcher:
                  print("Python: Official Patcher not present; trying ifcopenshell.ifcpatch")

              if use_official and Patcher:
                  # Use Patcher class to create SQLite DB
                  try:
                      import os
                      if os.path.exists(sqlite_db_path):
                          os.remove(sqlite_db_path)
                      patcher = Patcher(
                          file=ifc_file,
                          sql_type="SQLite",
                          database=sqlite_db_path,
                          full_schema=True,
                          is_strict=False,
                          should_expand=False,
                          should_get_inverses=True,
                          should_get_psets=True,
                          should_get_geometry=False,
                          should_skip_geometry_data=False
                      )
                      patcher.patch()
                      sqlite_success = os.path.exists(sqlite_db_path)

                      # Check and log database statistics
                      if sqlite_success:
                          try:
                              import sqlite3
                              conn = sqlite3.connect(sqlite_db_path)
                              cursor = conn.cursor()

                              # Get table count
                              cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                              tables = cursor.fetchall()
                              table_count = len(tables)
                              print(f"Python: Created {table_count} tables")

                              # Get total row count across all tables
                              total_rows = 0
                              for table in tables:
                                  table_name = table[0]
                                  cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                                  count = cursor.fetchone()[0]
                                  total_rows += count
                                  if count > 0:  # Only log non-empty tables
                                      print(f"Python: Table {table_name}: {count} rows")

                              print(f"Python: Total rows across all tables: {total_rows}")
                              conn.close()
                          except Exception as db_error:
                              print(f"Python: Error checking database statistics: {db_error}")

                          print(f"Python: Patcher-based SQLite creation completed: {sqlite_success}")
                      except Exception as e:
                          print(f"Python: Patcher-based Ifc2Sql failed: {e}")
                          import traceback
                          print(traceback.format_exc())
                          sqlite_success = False

                  if not sqlite_success:
                      try:
                          import ifcopenshell.ifcpatch
                          print("Python: ifcpatch module loaded successfully")
                          config = {
                              'input': 'model.ifc',
                              'file': None,
                              'recipe': 'Ifc2Sql',
                              'arguments': {
                                  'sqlite_path': sqlite_db_path,
                                  'full_schema': True,
                                  'should_get_psets': True,
                                  'should_get_inverses': True,
                                  'should_get_geometry': False,
                                  'should_skip_geometry_data': False
                              }
                          }
                          result = ifcopenshell.ifcpatch.execute(config)
                          print(f"Python: Ifc2Sql execution completed: {result}")
                          import os
                          sqlite_success = os.path.exists(sqlite_db_path)
                      except Exception as e:
                          print(f"Python: IfcPatch Ifc2Sql failed: {e}")
                          import traceback
                          print(traceback.format_exc())
                          sqlite_success = False
          except Exception as e:
              print(f"Python: Unexpected error in Ifc2Sql integration: {e}")
              import traceback
              print(traceback.format_exc())
              sqlite_success = False

          # Store as JSON in a variable
          result_obj["sqlite_db"] = sqlite_db_path if sqlite_success else None
          result_obj["sqlite_success"] = sqlite_success
          result_json = json.dumps(result_obj)
          print("Python: JSON serialization complete")

          # Store a success flag
          success = True
          error_msg = None
          error_trace = None
      except Exception as e:
          print(f"Python ERROR: {str(e)}")
          error_msg = str(e)
          error_trace = traceback.format_exc()
          print(f"Python TRACEBACK: {error_trace}")
          success = False
          result_json = None
    `,
      { globals: namespace }
    )

    // Check if there was an error
    const success = namespace.get('success')
    if (!success) {
      const errorMsg = namespace.get('error_msg')
      const errorTrace = namespace.get('error_trace')
      throw new Error(`Python error: ${errorMsg}\n${errorTrace}`)
    }

    // Get the actual result
    const result = namespace.get('result_json')
    if (!result) {
      throw new Error('Python execution did not produce a result')
    }

    // Parse the result JSON
    const modelInfo = JSON.parse(result)

    // Store model info in cache
    state.setIfcModelCache({
      filename: modelInfo.filename,
      schema: modelInfo.schema,
      model_id: modelInfo.model_id,
      dbKey: '',
    })

    // If SQLite DB was created, persist it to IndexedDB
    try {
      if (modelInfo.sqlite_success && modelInfo.sqlite_db) {
        const dbBytes = pyodide.FS.readFile(modelInfo.sqlite_db)

        const idbManager = IndexedDBManager.getInstance()
        const key = `model-sqlite-db:${modelInfo.model_id || modelInfo.filename || 'default'}`
        state.setCurrentSqlKey(key)

        // Clear any existing cached database first
        try {
          await idbManager.delete(key)
        } catch (deleteError) {
          // Ignore delete errors
        }

        await idbManager.put(key, dbBytes)

        // Verify the storage worked
        try {
          const verifyBytes = await idbManager.get(key)
          if (!verifyBytes || verifyBytes.length !== dbBytes.length) {
            console.warn('SQLite database verification failed')
          }
        } catch (verifyError) {
          // Ignore verification errors
        }
      }
    } catch (e) {
      console.warn('Failed to persist SQLite database:', e)
    }

    // Clean up
    namespace.destroy()

    // Final progress update
    postProgress(messageId, 100, 'File processed successfully!')

    // Send the result back
    postMessage({
      type: 'loadComplete',
      messageId,
      ...modelInfo,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Handle fast IFC file loading (no SQLite generation)
 */
export async function handleLoadIfcFast(message: LoadIfcFastMessage): Promise<void> {
  const { messageId, data } = message
  const { arrayBuffer, filename } = data

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

    const uint8Array = new Uint8Array(arrayBuffer as ArrayBuffer)
    pyodide.FS.writeFile('model.ifc', uint8Array)

    const ns = pyodide.globals.get('dict')()

    // Fast extraction Python code
    await pyodide.runPythonAsync(
      `
import ifcopenshell, json
try:
  f = ifcopenshell.open('model.ifc')
  schema = f.schema
  projects = f.by_type('IfcProject')
  project_info = None
  if projects:
    p = projects[0]
    project_info = {
      'GlobalId': getattr(p,'GlobalId', None),
      'Name': getattr(p,'Name', None) or 'Unnamed Project',
      'Description': getattr(p,'Description', None) or ''
    }
  # FAST extraction of ALL elements from the IFC file
  print("Python: Fast extraction of all IFC elements...")

  # Get all elements in the model using by_type for better performance
  all_elements = []
  element_counts = {}

  # FULLY DYNAMIC: Only extract elements with geometric representation (no hardcoded classes!)
  
  # Get all IfcProduct elements (physical elements that can have geometry)
  all_products = f.by_type('IfcProduct')
  
  # Always include essential spatial/project elements (they organize the model)
  essential_spatial_types = {
    'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 
    'IFCSPACE', 'IFCZONE', 'IFCFACILITY', 'IFCFACILITYPART'
  }
  
  discovered_types = set()
  
  # Add essential spatial elements first
  for element in f:
    try:
      element_type = element.is_a()
      if element_type.upper() in essential_spatial_types:
        discovered_types.add(element_type)
    except:
      continue
  
  # Filter IfcProduct elements based on geometric representation (optimized for large models)
  processed_count = 0
  chunk_size = 100  # Process in chunks to avoid blocking
  
  for i, element in enumerate(all_products):
    try:
      element_type = element.is_a()
      
      # Skip if already added as spatial element
      if element_type.upper() in essential_spatial_types:
        continue
      
      # Check if element has geometric representation
      has_geometry = False
      try:
        if hasattr(element, 'Representation') and element.Representation is not None:
          has_geometry = True
      except Exception as geom_error:
        # If we can't check geometry, assume no geometry
        continue
      
      # Only add elements that have geometric representation
      if has_geometry:
        discovered_types.add(element_type)
      
      processed_count += 1
      
      # For large models, limit the discovery phase to avoid timeouts
      if len(all_products) > 1000 and processed_count > 1000:
        break
        
    except Exception as e:
      continue
  
  # Convert set to sorted list for consistent ordering
  element_types_to_extract = sorted(list(discovered_types))

  # Second pass: extract all elements by their discovered types
  for element_type in element_types_to_extract:
    try:
      elements_of_type = f.by_type(element_type)
      if elements_of_type:
        element_counts[element_type] = len(elements_of_type)

        # Process elements efficiently
        for element in elements_of_type:
          try:
            # Create minimal element dictionary
            element_dict = {
              'expressId': element.id(),
              'type': element_type,
              'properties': {},
              'psets': {}
            }

            # Extract only essential properties (fast)
            if hasattr(element, 'GlobalId') and element.GlobalId:
              element_dict['properties']['GlobalId'] = element.GlobalId
            if hasattr(element, 'Name') and element.Name:
              element_dict['properties']['Name'] = element.Name

            # Add type-specific essential properties for common types
            if element_type == 'IFCBUILDINGSTOREY' and hasattr(element, 'Elevation'):
              element_dict['properties']['Elevation'] = element.Elevation
            elif element_type == 'IFCPROJECT' and hasattr(element, 'LongName') and element.LongName:
              element_dict['properties']['LongName'] = element.LongName
            elif element_type == 'IFCSITE' and hasattr(element, 'RefLatitude'):
              # Could add site-specific properties if needed
              pass

            all_elements.append(element_dict)

          except Exception as e:
            # Skip problematic elements but continue
            continue

    except Exception as e:
      # Skip element types that don't exist
      continue

  # Dynamic discovery complete

  result_obj = {
    'filename': '${filename}',
    'schema': schema,
    'project': project_info,
    'element_counts': element_counts,
    'total_elements': len(all_elements),
    'elements': all_elements,
    'model_id': '${filename}'
  }
  result_json = json.dumps(result_obj)
  success = True
except Exception as e:
  result_json = None
  error_msg = str(e)
  success = False
    `,
      { globals: ns }
    )

    postProgress(messageId, 90, 'Processing Python results...')

    const ok = ns.get('success')
    if (!ok) {
      const em = ns.get('error_msg') || 'Unknown error'
      throw new Error(String(em))
    }
    const result = JSON.parse(ns.get('result_json'))
    ns.destroy()

    postProgress(messageId, 95, `Found ${result.total_elements || 0} elements`)

    // Compute database key and cache model info
    const idbManager = IndexedDBManager.getInstance()
    const dbKey = idbManager.computeDbKeyFromBuffer(
      result.model_id || result.filename,
      arrayBuffer as ArrayBuffer
    )
    state.setIfcModelCache({
      filename: result.filename,
      schema: result.schema,
      model_id: result.model_id,
      dbKey,
    })

    postProgress(messageId, 100, 'IFC file loaded successfully!')
    postMessage({
      type: 'loadComplete',
      messageId,
      ...result,
      sqlite_db: null,
      sqlite_success: false,
    })

    // Background build of comprehensive SQLite (non-blocking)
    // This will be handled by the buildSqlite handler
    // For now, just send status
    postMessage({
      type: 'sqliteStatus',
      status: 'building',
      modelKey: result.model_id || result.filename,
      messageId,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

