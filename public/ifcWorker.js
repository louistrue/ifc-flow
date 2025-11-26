/* global importScripts */

// Import Pyodide v0.28.0 (optimal compatibility with ifcopenshell-0.8.4 wheel)
importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js");
// Load sql.js (SQLite WASM)
importScripts("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js");

let pyodide = null;
// Create a cache to store the loaded IFC model data
let ifcModelCache = null;
let pySqliteReady = false;

// sql.js module and in-memory database
let SQLModule = null;
let sqliteDb = null;
let currentSqlKey = null; // key for IndexedDB persistence per model

// Cache for loading official ifc2sql.py source once
let ifc2sqlPyCodeCache = null;
async function ensureIfc2sqlPyCode() {
  if (ifc2sqlPyCodeCache) return ifc2sqlPyCodeCache;
  try {
    const res = await fetch('/ifc2sql.py');
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    ifc2sqlPyCodeCache = await res.text();
    return ifc2sqlPyCodeCache;
  } catch (e) {

    ifc2sqlPyCodeCache = null;
    return null;
  }
}

async function initSqlJsModule() {
  if (SQLModule) return SQLModule;
  // initSqlJs is exposed by sql-wasm.js
  // Locate WASM via CDN
  SQLModule = await initSqlJs({
    locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
  });
  return SQLModule;
}

// IndexedDB helpers to persist database bytes
const IDB_NAME = 'ifc-sql-db';
const IDB_STORE = 'sqlite';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, bytes) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.objectStore(IDB_STORE).put(bytes, key);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { const v = req.result || null; db.close(); resolve(v); };
    req.onerror = () => { const e = req.error; db.close(); reject(e); };
  });
}

async function idbDelete(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { const e = req.error; db.close(); reject(e); };
  });
}

// Fast CRC32 implementation for Uint8Array
function crc32(uint8) {
  let crc = -1 >>> 0;
  for (let i = 0; i < uint8.length; i++) {
    crc = (crc ^ uint8[i]) >>> 0;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xEDB88320 & mask);
    }
  }
  return (crc ^ (-1 >>> 0)) >>> 0;
}

function computeDbKeyFromBuffer(filename, arrayBuffer) {
  try {
    const u8 = new Uint8Array(arrayBuffer);
    const size = u8.length >>> 0;
    const slice = 16 * 1024 * 1024;
    const first = u8.subarray(0, Math.min(slice, size));
    const last = size > slice ? u8.subarray(size - slice, size) : first;
    const c1 = crc32(first).toString(16);
    const c2 = crc32(last).toString(16);
    return `db:${size}-${c1}-${c2}`;
  } catch {
    // Fallback to filename-based key
    return `db:${filename || 'default'}`;
  }
}

// buildSqlJsDb function removed - we only use comprehensive database from ifc2sql

// Clean up old fallback databases from IndexedDB
async function cleanupFallbackDatabases() {
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('ifcWorkerDB', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tx = db.transaction(['kvStore'], 'readonly');
    const store = tx.objectStore('kvStore');
    const getAllKeysReq = store.getAllKeys();

    await new Promise((resolve, reject) => {
      getAllKeysReq.onsuccess = async () => {
        const keys = getAllKeysReq.result;
        const fallbackKeys = keys.filter(k => k.includes(':v2'));

        if (fallbackKeys.length > 0) {

          const deleteTx = db.transaction(['kvStore'], 'readwrite');
          const deleteStore = deleteTx.objectStore('kvStore');

          for (const key of fallbackKeys) {
            deleteStore.delete(key);

          }

          deleteTx.oncomplete = () => {

            resolve();
          };
          deleteTx.onerror = () => reject(deleteTx.error);
        } else {

          resolve();
        }
      };
      getAllKeysReq.onerror = () => reject(getAllKeysReq.error);
    });

    db.close();
  } catch (error) {

  }
}

async function ensureDbLoaded(key) {
  if (sqliteDb) return sqliteDb;
  await initSqlJsModule();
  const bytes = await idbGet(key);
  if (bytes) {
    sqliteDb = new SQLModule.Database(new Uint8Array(bytes));
    currentSqlKey = key;
    return sqliteDb;
  }
  return null;
}

// Initialize Pyodide with IfcOpenShell
async function initPyodide() {
  if (pyodide !== null) {
    return pyodide;
  }

  self.postMessage({
    type: "progress",
    message: "Loading Pyodide...",
    percentage: 5,
  });

  try {
    console.log("initPyodide: Starting Pyodide initialization");
    // Load Pyodide v0.28.0 (optimal compatibility with ifcopenshell-0.8.4 wheel)
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.0/full/",
    });
    console.log("initPyodide: Pyodide loaded successfully");

    self.postMessage({
      type: "progress",
      message: "Installing required packages...",
      percentage: 30,
    });

    console.log("initPyodide: Loading micropip, numpy, typing-extensions");
    // Load micropip for package installation and numpy for computations
    await pyodide.loadPackage(["micropip", "numpy", "typing-extensions"]);
    console.log("initPyodide: Basic packages loaded");

    // Simple bypass - just patch the core compatibility function
    await pyodide.runPythonAsync(`
      import sys

      # SIMPLE BYPASS: Just replace the core check function
      def simple_bypass(filename):
        print(f"🚫 BYPASSED: Allowing wheel {filename}")
        return None

      # Import micropip first
      import micropip
      print("Micropip imported successfully")

      # Only patch the essential compatibility check
      import micropip._utils
      micropip._utils.check_compatible = simple_bypass
      print("✅ Disabled micropip._utils.check_compatible")

      # Verify the patch worked
      try:
        result = micropip._utils.check_compatible("test.whl")
        print(f"🧪 Compatibility check result: {result}")
      except Exception as e:
        print(f"❌ Error testing compatibility check: {e}")

      print("🎯 SIMPLE BYPASS COMPLETE")
    `);

    // Install IfcOpenShell (try newest first, fallback to known-good)
    self.postMessage({
      type: "progress",
      message: "Installing IfcOpenShell...",
      percentage: 50,
    });

    await pyodide.runPythonAsync(`
      import micropip, importlib

      # SIMPLE BYPASS RE-APPLICATION FOR INSTALLATIONS
      def simple_bypass(filename):
          print(f"🚫 BYPASSED: Allowing wheel {filename}")
          return None

      # Ensure bypass is active before installations
      import micropip._utils
      micropip._utils.check_compatible = simple_bypass
      print("✅ Bypass ready for installations")

      # Install lark for stream support
      print("📦 Installing lark...")
      await micropip.install('lark')
      print("✅ Lark installed successfully")

      # Use local 0.8.4 wheel - supports IFC4X3_ADD2 schema
      wheel_urls = [
          '/wasm/ifcopenshell-0.8.4+b1b95ec-cp313-cp313-emscripten_4_0_9_wasm32.whl'
      ]
      last_exc = None
      installed = False
      for url in wheel_urls:
          try:
              print(f"🎯 Installing ifcopenshell 0.8.4: {url}")

              # Ensure bypass is active before each install
              micropip._utils.check_compatible = simple_bypass

              await micropip.install(url, keep_going=True, deps=False)

              # Verify import works
              import ifcopenshell
              print('✅ IfcOpenShell 0.8.4 import OK:', getattr(ifcopenshell, 'version', 'unknown'))

              # Skip schema checking to avoid API issues - focus on core functionality
              print("✅ SUCCESS: IfcOpenShell 0.8.4 loaded and ready for IFC processing!")

              installed = True
              break
          except Exception as e:
              last_exc = e
              print(f"❌ Install/import failed for ifcopenshell 0.8.4: {e}")
              # Clean up failed installation
              try:
                import sys
                if 'ifcopenshell' in sys.modules:
                  del sys.modules['ifcopenshell']
                import importlib
                importlib.invalidate_caches()
                print("🧹 Cleaned up failed ifcopenshell 0.8.4 installation")
              except Exception as cleanup_e:
                print(f"❌ Cleanup failed: {cleanup_e}")

      if not installed:
          if last_exc:
              raise last_exc
          else:
              raise RuntimeError('Failed to install IfcOpenShell 0.8.4')
    `);

    // Try to enable Python sqlite3 for ifcopenshell.sql usage (if available)
    try {
      await pyodide.loadPackage(["sqlite3"]);
      await pyodide.runPythonAsync(`import sqlite3\nprint('sqlite3 available')`);
      pySqliteReady = true;
    } catch (e) {
      pySqliteReady = false;

    }

    // Ensure shapely is available before importing ifcopenshell.util.shape from ifc2sql.py
    self.postMessage({
      type: "progress",
      message: "Loading shapely...",
      percentage: 62,
    });
    try {
      await pyodide.loadPackage(["shapely"]);
      await pyodide.runPythonAsync(`import shapely\nprint('shapely available')`);
    } catch (e) {

      // Proceed; if ifc2sql.py needs shapely it will error with clear message
    }

    // Initialize the module for caching IFC models and SQLite support
    self.postMessage({
      type: "progress",
      message: "Installing SQLite and Ifc2Sql support...",
      percentage: 60,
    });

    // Initialize ifcopenshell with built-in SQLite support
    await pyodide.runPythonAsync(`
      import sys
      import ifcopenshell
      import ifcopenshell.sql
      import json

      # Global variables for storing SQLite databases
      sqlite_databases = {}
    `);

    // NOTE: We intentionally skip installing ifcpatch here.
    // ifcpatch corrupts the ifcopenshell WASM module when imported, causing
    // "'function' object has no attribute 'file_schema'" errors.
    // The SQLite conversion will use ifcopenshell.sql directly instead.
    
    // Patcher will be None - SQLite conversion will use fallback methods
    await pyodide.runPythonAsync(`
Patcher = None
print('Skipping ifc2sql.py Patcher (ifcpatch not compatible with WASM)')
    `);

    self.postMessage({
      type: "progress",
      message: "IfcOpenShell loaded successfully",
      percentage: 100,
    });

    return pyodide;
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Failed to load Pyodide: ${error.message}`,
      stack: error.stack,
    });
    throw error;
  }
}

// Main message handler
self.onmessage = async (event) => {
  try {
    const { action, data, messageId } = event.data;


    switch (action) {
      case "init":
        await initPyodide();
        await cleanupFallbackDatabases(); // Clean up old fallback databases
        self.postMessage({ type: "initialized", messageId });
        break;

      case "loadIfc":
        await handleLoadIfc({ ...data, messageId });
        break;

      case "extractData":

        await handleExtractData({ ...data, messageId });
        break;

      case "assignMaterial":
        await handleAssignMaterial({ ...data, messageId });
        break;

      case "createMaterial":
        await handleCreateMaterial({ ...data, messageId });
        break;

      case "exportIfc":
        // Handle the export data properly
        const exportData = {
          model: event.data.model,
          fileName: event.data.fileName,
          arrayBuffer: event.data.arrayBuffer
        };
        await handleExportIfc({ ...exportData, messageId });
        break;

      case "extractGeometry":
        await handleExtractGeometry({ ...data, messageId });
        break;

      case "extractQuantities":

        await handleExtractQuantities(data, messageId);
        break;

      case "runPython":

        await handleRunPython({ ...data, messageId });
        break;

      case "querySqlite":

        await handleSqliteQuery({ ...data, messageId });
        break;

      case "exportSqlite":

        await handleSqliteExport({ ...data, messageId });
        break;

      case "warmSqlite":

        await handleWarmSqlite({ ...data, messageId });
        break;

      case "buildSqlite":

        await handleBuildSqlite({ ...data, messageId });
        break;

      case "getMaterialDetails":
        await handleGetMaterialDetails({ ...data, messageId });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {

    self.postMessage({
      type: "error",
      message: error.message,
      stack: error.stack,
      messageId: event.data?.messageId,
    });
  }
};

// Helper to post SQLite background build status to main thread
function postSqliteStatus(status, modelKey, extra) {
  try {
    self.postMessage({ type: "sqliteStatus", status, modelKey, ...extra });
  } catch (e) {
    // ignore
  }
}

// Extract more detailed information from the IFC file
async function handleExtractData({ types = ["IfcWall"], messageId }) {
  try {


    // Make sure Pyodide is initialized
    await initPyodide();


    self.postMessage({
      type: "progress",
      message: "Converting IFC to structured data...",
      percentage: 60,
      messageId,
    });

    // Create a Python array of the requested types
    const typesStr = JSON.stringify(types);


    // Add error handling for Python execution
    try {

      // Create a dedicated namespace for this operation
      const namespace = pyodide.globals.get("dict")();

      // First run the imports and setup
      await pyodide.runPythonAsync(
        `
        import sys
        print("Python version:", sys.version)
        
        # Explicitly load numpy - need to handle multiple approaches
        try:
            import numpy as np
            print("Numpy already imported, version:", np.__version__)
        except ImportError:
            print("Numpy not found, attempting to load...")
            try:
                print("Loading numpy via micropip...")
                import micropip
                await micropip.install('numpy')
                import numpy as np
                print("Successfully loaded numpy via micropip, version:", np.__version__)
            except Exception as e:
                print(f"Failed to load numpy via micropip: {e}")
                try:
                    print("Loading numpy via pyodide.loadPackage...")
                    import pyodide
                    await pyodide.loadPackage('numpy')
                    import numpy as np
                    print("Successfully loaded numpy via loadPackage, version:", np.__version__)
                except Exception as e:
                    print(f"Failed to load numpy via loadPackage: {e}")
                    print("Will try to proceed without numpy, but this may cause issues")
        
        import ifcopenshell
        try:
            import ifcopenshell.util.element
            print("ifcopenshell.util.element successfully imported")
        except Exception as e:
            print(f"Error importing ifcopenshell.util.element: {e}")
            print("Will use basic element properties only")
        
        import json
        import traceback
        import os
      `,
        { globals: namespace }
      );

      // Set the types in the namespace
      namespace.set("types_str", typesStr);

      // Then process the IFC elements with fallback for numpy dependency issues
      await pyodide.runPythonAsync(
        `
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
                
                # Try to get property sets directly (slower but no external dependencies)
                try:
                    psets = {}
                    for definition in element.IsDefinedBy:
                        if definition.is_a('IfcRelDefinesByProperties'):
                            property_set = definition.RelatingPropertyDefinition
                            if property_set.is_a('IfcPropertySet'):
                                # Store the property values in a dictionary
                                pset_name = property_set.Name
                                psets[pset_name] = {}
                                for prop in property_set.HasProperties:
                                    if prop.is_a('IfcPropertySingleValue'):
                                        # Get the property name and value
                                        prop_name = prop.Name
                                        if prop.NominalValue:
                                            prop_value = prop.NominalValue.wrappedValue
                                            psets[pset_name][prop_name] = prop_value
                                            
                                            # Copy important properties to the top level
                                            if pset_name == "Pset_WallCommon" or prop_name in ["IsExternal", "FireRating", "LoadBearing"]:
                                                properties[prop_name] = prop_value
                except Exception as e:
                    print(f"Error getting property sets: {e}")
                
                return properties, psets
            
            # Helper function to convert IFC element to structured dictionary
            def element_to_dict(element):
                # Create element dictionary with basic properties
                element_dict = {
                    "id": f"{element.is_a()}-{element.id()}",
                    "expressId": element.id(),
                    "type": element.is_a()
                }
                
                # First try using the util module if available
                has_util = 'ifcopenshell.util.element' in sys.modules
                
                if has_util:
                    try:
                        # Get properties using the utility function
                        element_dict["properties"] = {
                            "GlobalId": element.GlobalId,
                            "Name": element.Name or f"Unnamed {element.is_a()}"
                        }
                        
                        # Get normal property sets (non-quantity sets)
                        element_dict["psets"] = ifcopenshell.util.element.get_psets(element, psets_only=True)
                        
                        # Get quantity sets 
                        element_dict["qtos"] = ifcopenshell.util.element.get_psets(element, qtos_only=True)
                        
                        # Copy important properties to the top level for easy access
                        for pset_name, pset in element_dict["psets"].items():
                            for prop_name, prop_value in pset.items():
                                # Add common properties to the root level for easy access
                                if pset_name == "Pset_WallCommon" or prop_name in ["IsExternal", "FireRating", "LoadBearing"]:
                                    element_dict["properties"][prop_name] = prop_value
                        
                        # Copy important quantities to properties
                        if "qtos" in element_dict:
                            for qto_name, qto in element_dict["qtos"].items():
                                for q_name, q_value in qto.items():
                                    if q_name in ["Length", "Width", "Height", "Area", "Volume"]:
                                        element_dict["properties"][q_name] = q_value
                        
                        return element_dict
                    except Exception as e:
                        print(f"Error using util methods: {e}")
                        print("Falling back to basic extraction...")
                
                # Fallback: Get properties directly without util module
                properties, psets = extract_common_properties(element)
                element_dict["properties"] = properties
                element_dict["psets"] = psets
                
                return element_dict
            
            # Extract elements of requested types
            elements = []
            all_elements = []
            
            # If requested_types contains '*' or 'all', get all element types
            if '*' in requested_types or 'all' in requested_types:
                print("Extracting all element types")
                requested_types = ['IfcWall', 'IfcSlab', 'IfcBeam', 'IfcColumn', 'IfcDoor', 
                                  'IfcWindow', 'IfcRoof', 'IfcStair', 'IfcFurnishingElement',
                                  'IfcSpace', 'IfcBuildingElementProxy']
            
            # Collect all requested elements
            for ifc_type in requested_types:
                print(f"Processing elements of type {ifc_type}")
                try:
                    type_elements = ifc_file.by_type(ifc_type)
                    all_elements.extend(type_elements)
                    print(f"Found {len(type_elements)} elements of type {ifc_type}")
                except Exception as e:
                    print(f"Error getting elements of type {ifc_type}: {e}")
            
            # Convert all elements to dictionaries
            processed_count = 0
            for element in all_elements:
                try:
                    element_dict = element_to_dict(element)
                    elements.append(element_dict)
                    processed_count += 1
                except Exception as e:
                    print(f"Error converting element {element.id()} to dictionary: {e}")
            
            print(f"Successfully extracted {processed_count} elements")
            
            # Store as JSON in a variable
            elements_json = json.dumps(elements)
            print(f"JSON serialization complete: {len(elements_json)} characters")
            
            # Store success flag
            success = True
            error_msg = None
            error_trace = None
        except Exception as e:
            print(f"Python ERROR: {str(e)}")
            error_msg = str(e)
            error_trace = traceback.format_exc()
            print(f"Python TRACEBACK: {error_trace}")
            success = False
            elements_json = None
      `,
        { globals: namespace }
      );

      // Check if there was an error
      const success = namespace.get("success");


      if (!success) {
        const errorMsg = namespace.get("error_msg");
        const errorTrace = namespace.get("error_trace");
        throw new Error(`Python error: ${errorMsg}\n${errorTrace}`);
      }

      // Get the actual result from the namespace
      const elementsJson = namespace.get("elements_json");


      if (!elementsJson) {
        throw new Error(
          "Python execution did not produce a result for elements"
        );
      }

      // Parse the result JSON
      const elements = JSON.parse(elementsJson);

      // Clean up
      namespace.destroy();

      // Final progress update
      self.postMessage({
        type: "progress",
        message: "Elements processed successfully!",
        percentage: 100,
        messageId,
      });

      // Send the result back
      self.postMessage({
        type: "dataExtracted",
        elements: elements,
        messageId,
      });


      // No fallback database - only use comprehensive database from ifc2sql
      const modelKey = (ifcModelCache && (ifcModelCache.model_id || ifcModelCache.filename)) || 'default';
      currentSqlKey = `model-sqlite-db:${modelKey}`;

    } catch (pythonError) {

      throw new Error(`Python error: ${pythonError.message}`);
    }
  } catch (error) {

    self.postMessage({
      type: "error",
      message: `Error extracting data: ${error.message}`,
      stack: error.stack,
      messageId,
    });
  }
}

// Add this new handler function after the handleExtractData function
async function handleExportIfc(data) {
  const { model, fileName, messageId, arrayBuffer } = data;

  try {
    // Validate inputs
    if (!model) {
      throw new Error("No model data provided for export");
    }
    // if (!arrayBuffer) {
    //   throw new Error("No IFC file buffer provided for export");
    // }
    self.postMessage({
      type: "progress",
      message: "Preparing to export modified IFC file...",
      percentage: 10,
      messageId,
    });

    // Get the proper model ID to look up in the cache
    // Try to use model ID from the model data, or from ifcModelCache, or fileName as fallback
    const modelId = (ifcModelCache && ifcModelCache.filename) || fileName;

    // Also try the original filename if available
    const originalFilename =
      (ifcModelCache && ifcModelCache.filename) || fileName;


    // Get or initialize pyodide
    const pyodide = await initPyodide();

    // Create a namespace to avoid polluting the global space
    const namespace = pyodide.globals.get("dict")();

    // Add model data to Python scope
    namespace.set("model_json", JSON.stringify(model));
    namespace.set("export_filename", fileName || "exported.ifc");
    namespace.set("model_id", modelId);

    self.postMessage({
      type: "progress",
      message: "Applying changes to IFC model...",
      percentage: 30,
      messageId,
    });

    // Check if model.ifc already exists in the Pyodide virtual filesystem
    // This is more reliable than checking Python globals since handlers use isolated namespaces
    let fileExistsInFS = false;
    try {
      const pathInfo = pyodide.FS.analyzePath('model.ifc');
      fileExistsInFS = pathInfo.exists;
    } catch (e) {
      // If analyzePath fails, file doesn't exist
      fileExistsInFS = false;
    }

    // Ensure we have a source file
    if (!fileExistsInFS && (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer))) {
      throw new Error(
        "Original IFC file buffer was not provided and no model.ifc exists in virtual filesystem. Cannot export."
      );
    }

    // Only write the original file if model.ifc doesn't exist
    // If it exists, it may have been modified (e.g., material assignments) so we should preserve it
    if (!fileExistsInFS && arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
      try {
        // Write the provided buffer to the filesystem
        console.log("Writing original IFC file to virtual filesystem for first-time export");
        pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));
      } catch (fsError) {
        throw new Error(
          `Failed to prepare IFC file in virtual filesystem: ${fsError.message}`
        );
      }
    } else if (fileExistsInFS) {
      console.log("Using existing model.ifc from virtual filesystem (may contain modifications like material assignments)");
    }

    try {
      await pyodide.runPythonAsync(
        `
        import json
        import traceback
        import ifcopenshell
        import ifcopenshell.guid
        import tempfile
        import sys
        import os
        import re
        
        try:
            print("Starting IFC export...")
            
            # Parse the model JSON into Python objects
            model_data = json.loads(model_json)
            print(f"Loaded model data with {len(model_data['elements'])} elements")
            
            # Load the IFC file from the filesystem
            ifc_file = None
            
            if os.path.exists('model.ifc'):
                print("Found 'model.ifc' file in filesystem, opening...")
                try:
                    # Open the original file that was previously loaded
                    ifc_file = ifcopenshell.open('model.ifc')
                    print(f"Opened original IFC file with schema {ifc_file.schema}")
                except Exception as e:
                    print(f"Error opening original IFC file: {e}")
                    raise RuntimeError(f"Failed to open 'model.ifc': {e}")
            else:
                # This should ideally not happen if load was successful
                raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem. Cannot export.")

            # We should not create a new file, we must modify the existing one.
            # If ifc_file is None here, something went wrong earlier.
            if not ifc_file:
                raise RuntimeError("IFC file object is None after attempting to load from filesystem.")
            
            # Get the OwnerHistory from the file to use for new property sets
            owner_history = None
            try:
                owner_histories = ifc_file.by_type("IfcOwnerHistory")
                if owner_histories:
                    owner_history = owner_histories[0]
            except Exception as e:
                print(f"Warning: Could not get OwnerHistory: {e}")
            
            # Create a temporary file to store the modified IFC
            ifc_temp = tempfile.NamedTemporaryFile(suffix=".ifc", delete=False)
            temp_path = ifc_temp.name
            ifc_temp.close()
            
            print("Applying property modifications...")
            
            # Process elements with property changes
            modified_count = 0 # Initialize the counter

            # Collect information about all elements for easier lookup by express ID or GlobalId
            element_lookup = {}
            all_entities_by_id = {}
            all_products_by_guid = {}
            try:
                # Iterate directly over the file object to get entities
                all_products = ifc_file.by_type('IfcProduct')

                # Create lookup tables
                for entity in ifc_file: # Iterate directly over the file object
                    if hasattr(entity, 'id') and entity.id():
                        all_entities_by_id[entity.id()] = entity

                for product in all_products:
                    if hasattr(product, 'GlobalId') and product.GlobalId:
                        all_products_by_guid[product.GlobalId] = product
            except Exception as e:
                print(f"Error creating element lookup: {e}")
            
            # Map of element identifiers to their modified properties
            property_changes = {}
            
            # Extract the property changes from the model data
            for element_data in model_data['elements']:
                # Skip elements without property changes
                if 'propertyInfo' not in element_data:
                    continue
                    
                # Get the property information
                prop_info = element_data.get('propertyInfo', {})
                
                # Skip if no property exists or isn't meaningful
                if not prop_info.get('exists', False) and 'value' not in prop_info:
                    continue
                
                # Look for identifiers in this order:
                # 1. Express ID (numeric index)
                # 2. GlobalId from properties
                # 3. ID string from element data ('IfcType-ExpressId')
                element_id = None
                element_global_id = None
                element_type = element_data.get('type')
                
                express_id = element_data.get('expressId')
                
                if express_id:
                    element_id = express_id
                elif 'properties' in element_data and 'GlobalId' in element_data['properties']:
                    element_global_id = element_data['properties']['GlobalId']
                    element_id = element_global_id # Use GlobalId as primary lookup if expressId is missing
                elif 'id' in element_data and isinstance(element_data['id'], str) and '-' in element_data['id']:
                    try:
                        parts = element_data['id'].split('-')
                        element_id = int(parts[-1]) # Extract express ID from string like 'IfcWall-139'
                        if not element_type:
                            element_type = parts[0]
                    except ValueError:
                        print(f"Could not parse express ID from element 'id': {element_data['id']}")
                
                # Skip if we can't identify the element
                if not element_id and not element_global_id:
                    print(f"WARNING: Element not found in IFC file using ID: {element_id}, Express ID: {express_id}, Global ID: {element_global_id}. Skipping modification.")
                    continue # Skip to the next element
                
                # Store the property change
                property_changes[element_id] = {
                    'propName': prop_info.get('name', ''),
                    'psetName': prop_info.get('psetName', ''),
                    'value': prop_info.get('value'),
                    'type': element_data.get('type', 'IfcProduct'),
                    'expressId': express_id,
                    'globalId': element_data.get('properties', {}).get('GlobalId'),
                    'elementName': element_data.get('properties', {}).get('Name', f"Element {element_id or element_global_id}")
                }
            
            print(f"Found {len(property_changes)} elements with property changes")
            
            # Apply the property changes to the IFC file
            for element_id, change in property_changes.items():
                try:
                    # Find the element first by direct lookup
                    element = None
                    express_id_to_find = change.get('expressId')
                    global_id_to_find = change.get('globalId')
                    
                    # Prioritize lookup by express ID if available and valid
                    if express_id_to_find and isinstance(express_id_to_find, int):
                        element = all_entities_by_id.get(express_id_to_find)
                    
                    # If not found by express ID, try GlobalId
                    if not element and global_id_to_find:
                        element = all_products_by_guid.get(global_id_to_find)

                    # Last resort: if element_id was a string like 'IfcWall-139'
                    if not element and isinstance(element_id, int) and element_id != express_id_to_find:
                        element = all_entities_by_id.get(element_id)

                    # Check if the element exists
                    if not element:
                        print(f"WARNING: Element not found in IFC file using ID: {element_id}, Express ID: {express_id_to_find}, Global ID: {global_id_to_find}. Skipping modification.")
                        continue # Skip to the next element
                    
                    try:
                        # Get the property name and value using the correct keys
                        prop_name = change['propName']
                        prop_value = change['value']
                        pset_name = change['psetName']
                        
                        # Skip if no property name or pset name
                        if not prop_name or not pset_name:
                            print(f"Skipping property change - missing property name or pset name")
                            continue
                        
                        # Only log first few modifications to reduce noise
                        if modified_count < 3:
                            print(f"🔧 Setting {pset_name}.{prop_name} = {repr(prop_value)} (type: {type(prop_value).__name__})")
                            # print(f"Modifying {element.is_a()} (GlobalId: {change.get('globalId', 'unknown')[:8]}...) - Setting {pset_name}.{prop_name} = {prop_value}")
                        
                        # Wrap the entire property modification in a try-except block
                        try:
                            # Check if the property set exists
                            existing_pset = None
                            
                            # Find existing property set
                            try:
                                if hasattr(element, 'IsDefinedBy'):
                                    for definition in element.IsDefinedBy:
                                        try:
                                            if definition.is_a('IfcRelDefinesByProperties'):
                                                property_set = definition.RelatingPropertyDefinition
                                                if property_set.is_a('IfcPropertySet') and property_set.Name == pset_name:
                                                    existing_pset = property_set
                                                    break
                                        except Exception as e:
                                            print(f"Error checking property set: {e}")
                            except Exception as e:
                                print(f"Error finding property sets: {e}")
                            
                            # If property set exists, update or add the property
                            if existing_pset:
                                # Check if property exists
                                existing_prop = None
                                try:
                                    for prop in existing_pset.HasProperties:
                                        try:
                                            if prop.is_a('IfcPropertySingleValue') and prop.Name == prop_name:
                                                existing_prop = prop
                                                break
                                        except Exception as e:
                                            print(f"Error checking property: {e}")
                                except Exception as e:
                                    print(f"Error iterating properties: {e}")
                                
                                # Update existing property
                                if existing_prop:
                                    try:
                                        # Create appropriate value type based on Python type
                                        if isinstance(prop_value, bool):
                                            existing_prop.NominalValue = ifc_file.create_entity("IfcBoolean", prop_value)
                                        elif isinstance(prop_value, (int, float)):
                                            existing_prop.NominalValue = ifc_file.create_entity("IfcReal", float(prop_value))
                                        elif isinstance(prop_value, str):
                                            # --- Check if string represents a boolean ---
                                            lower_val = prop_value.lower()
                                            if lower_val == 'true':
                                                existing_prop.NominalValue = ifc_file.create_entity("IfcBoolean", True)
                                            elif lower_val == 'false':
                                                existing_prop.NominalValue = ifc_file.create_entity("IfcBoolean", False)
                                            else:
                                                # Otherwise, treat as regular text
                                                existing_prop.NominalValue = ifc_file.create_entity("IfcText", prop_value)
                                        else:
                                            # For complex types, convert to string
                                            existing_prop.NominalValue = ifc_file.create_entity("IfcText", str(prop_value))
                                        print(f"Updated existing property {prop_name}")
                                    except Exception as e:
                                        print(f"Error updating property value: {e}")
                                else:
                                    # Create new property
                                    try:
                                        new_prop = None
                                        
                                        # Create the appropriate property based on value type
                                        if isinstance(prop_value, bool):
                                            new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                            new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", prop_value)
                                        elif isinstance(prop_value, (int, float)):
                                            new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                            new_prop.NominalValue = ifc_file.create_entity("IfcReal", float(prop_value))
                                        elif isinstance(prop_value, str):
                                            # --- Check if string represents a boolean ---
                                            lower_val = prop_value.lower()
                                            if lower_val == 'true':
                                                new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                                new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", True)
                                            elif lower_val == 'false':
                                                new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                                new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", False)
                                            else:
                                                # Otherwise, treat as regular text
                                                new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                                new_prop.NominalValue = ifc_file.create_entity("IfcText", prop_value)
                                        elif prop_value is None:
                                            # Skip null values
                                            continue
                                        else:
                                            # For complex types, convert to string
                                            new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                            new_prop.NominalValue = ifc_file.create_entity("IfcText", str(prop_value))
                                        
                                        # Add property to property set
                                        existing_pset.HasProperties = list(existing_pset.HasProperties) + [new_prop]
                                        print(f"Added new property {prop_name} to existing property set")
                                    except Exception as e:
                                        print(f"Error creating new property: {e}")
                            else:
                                # Create new property set
                                try:
                                    if modified_count < 3:
                                        pass  # Reduced logging
                                        # print(f"Creating new property set {pset_name} for {element.is_a()}")
                                    
                                    # Create property
                                    new_prop = None
                                    
                                    # Create the appropriate property based on value type
                                    if isinstance(prop_value, bool):
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", prop_value)
                                    elif isinstance(prop_value, (int, float)):
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcReal", float(prop_value))
                                    elif isinstance(prop_value, str):
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcText", prop_value)
                                    elif prop_value is None:
                                        # Skip null values
                                        continue
                                    else:
                                        # For complex types, convert to string
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcText", str(prop_value))
                                    
                                    # Create property set
                                    pset = ifc_file.create_entity(
                                        "IfcPropertySet",
                                        GlobalId=ifcopenshell.guid.new(),
                                        OwnerHistory=owner_history,
                                        Name=pset_name,
                                        Description=None,
                                        HasProperties=[new_prop]
                                    )
                                    
                                    # Relate property set to element
                                    rel_props = ifc_file.create_entity(
                                        "IfcRelDefinesByProperties",
                                        GlobalId=ifcopenshell.guid.new(),
                                        OwnerHistory=owner_history,
                                        Name=None,
                                        Description=None
                                    )
                                    rel_props.RelatingPropertyDefinition = pset
                                    rel_props.RelatedObjects = [element]
                                    print(f"Created new property set {pset_name} with property {prop_name}")
                                except Exception as e:
                                    print(f"Error creating property set: {e}")
                            
                            # Increment counter only if modification was attempted
                            modified_count += 1
                        except Exception as e:
                            print(f"Error during property modification: {e}")
                    except Exception as e:
                        print(f"Error handling property change for element: {e}")
                except Exception as e:
                    print(f"Error handling element {change['globalId']}: {e}")
            
            # Print summary
            if modified_count > 0:
                print(f"✓ Successfully modified {modified_count} elements with property changes")
            else:
                print(f"⚠ Warning: No elements were modified (0 property changes applied)")
                print(f"  Check that the element GlobalIds match and values are not None")
            
            # Save the IFC file
            print(f"Writing modified IFC file to {temp_path}")
            try:
                ifc_file.write(temp_path)
                print(f"✓ IFC file written successfully")
            except Exception as write_error:
                print(f"❌ Error writing IFC file: {write_error}")
                import traceback
                print(traceback.format_exc())
                raise
            
            # Read the file back as bytes
            print(f"Reading IFC file back as bytes...")
            with open(temp_path, 'rb') as f:
                ifc_bytes = f.read()
            print(f"✓ Read {len(ifc_bytes)} bytes from IFC file")
            
            # Convert bytes to JS-friendly format
            import base64
            print(f"Converting to base64...")
            ifc_base64 = base64.b64encode(ifc_bytes).decode('utf-8')
            print(f"✓ Base64 encoding complete ({len(ifc_base64)} characters)")
            
            # Clean temporary file (though it may not actually delete in WASM environment)
            try:
                os.unlink(temp_path)
            except:
                pass
                
            success = True
            error_msg = None
            error_trace = None
            
        except Exception as e:
            print(f"Python ERROR during export: {str(e)}")
            error_msg = str(e)
            error_trace = traceback.format_exc()
            print(f"Python TRACEBACK: {error_trace}")
            success = False
            ifc_base64 = None
      `,
        { globals: namespace }
      );

      // Check if there was an error
      const success = namespace.get("success");


      if (!success) {
        const errorMsg = namespace.get("error_msg");
        const errorTrace = namespace.get("error_trace");
        throw new Error(
          `Python error during export: ${errorMsg}\n${errorTrace}`
        );
      }

      // Get the base64 encoded IFC data
      const ifcBase64 = namespace.get("ifc_base64");

      self.postMessage({
        type: "progress",
        message: "IFC export complete, preparing download...",
        percentage: 90,
        messageId,
      });

      if (!ifcBase64) {
        throw new Error("No IFC data received from Python export");
      }

      // Create a download URL from the base64 data
      const binaryString = atob(ifcBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Final progress update
      self.postMessage({
        type: "progress",
        message: "IFC file ready for download!",
        percentage: 100,
        messageId,
      });

      // Send the result back for download as ArrayBuffer
      const bufferCopy = bytes.buffer.slice(0);
      self.postMessage({
        type: "ifcExported",
        fileName: fileName || "exported.ifc",
        data: bufferCopy,
        messageId,
      });

      // Clean up after sending
      namespace.destroy();
    } catch (pythonError) {

      throw new Error(`Python export error: ${pythonError.message}`);
    }
  } catch (error) {

    self.postMessage({
      type: "error",
      message: `Error exporting IFC: ${error.message}`,
      messageId,
    });
  }
}

// *** Update the handler function for geometry extraction ***
async function handleExtractGeometry({
  elementType,
  includeOpenings,
  arrayBuffer,
  messageId,
}) {
  try {

    await initPyodide();

    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error(
        "Valid ArrayBuffer not received in handleExtractGeometry."
      );
    }

    // *** Mount buffer directly using FS.createDataFile ***
    const VFS_PATH = "/data"; // A directory in VFS
    const VFS_FILENAME = "model.ifc";
    const VFS_FULL_PATH = `${VFS_PATH}/${VFS_FILENAME}`;
    let mountSuccessful = false;
    try {
      // Ensure directory exists
      pyodide.FS.mkdirTree(VFS_PATH);
      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(arrayBuffer);
      // Mount the data file (read, write, overwrite allowed)
      pyodide.FS.createDataFile(
        VFS_PATH,
        VFS_FILENAME,
        uint8Array,
        true,
        true,
        true
      );
      mountSuccessful = true;
    } catch (mountError) {
      throw new Error(
        `Failed to mount IFC data in worker: ${mountError.message}`
      );
    }

    self.postMessage({
      type: "progress",
      message: "Preparing geometry extraction...",
      percentage: 10,
      messageId,
    });

    // Create a namespace for Python execution
    const namespace = pyodide.globals.get("dict")();

    // Set parameters in the namespace
    namespace.set("element_type", elementType);
    namespace.set("include_openings", includeOpenings ? true : false);
    namespace.set("vfs_path", VFS_FULL_PATH);

    // Prepare Python code for geometry extraction
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
`;

    // Send initial progress update from JavaScript
    self.postMessage({
      type: "progress",
      message: "Loading IFC file...",
      percentage: 20,
      messageId,
    });

    // Execute the Python code with our namespace
    try {
      // Send progress updates at regular intervals during processing
      const progressUpdater = setInterval(() => {
        try {
          // Try to get progress info from namespace if available
          if (namespace.has("progress_info")) {
            const progressInfo = namespace.get("progress_info");
            if (progressInfo) {
              const percentage = Math.min(
                40 + Math.floor(progressInfo.percentage * 0.6),
                99
              );
              self.postMessage({
                type: "progress",
                message: `Processing element ${progressInfo.processed}/${progressInfo.total}...`,
                percentage: percentage,
                messageId,
              });
            }
          }
        } catch (e) {
          // Ignore errors in progress updates

        }
      }, 500); // Check progress every 500ms

      // Run the Python code
      await pyodide.runPythonAsync(pythonCode, { globals: namespace });

      // Clear the progress updater
      clearInterval(progressUpdater);

      // Get the result from the namespace
      const success = namespace.get("success");

      if (!success) {
        throw new Error("Geometry extraction failed in Python");
      }

      const resultJson = namespace.get("result_json");
      const elements = JSON.parse(resultJson);


      // Clean up VFS file
      if (mountSuccessful) {
        try {
          pyodide.FS.unlink(VFS_FULL_PATH);
        } catch (unlinkError) {
        }
      }

      // Clean up namespace
      namespace.destroy();

      self.postMessage({
        type: "progress",
        message: "Geometry extraction complete!",
        percentage: 100,
        messageId,
      });

      // Send the results back to the main thread
      self.postMessage({
        type: "geometry",
        elements: elements,
        messageId,
      });
    } catch (error) {


      // Clean up
      if (mountSuccessful) {
        try {
          pyodide.FS.unlink(VFS_FULL_PATH);
        } catch (e) { }
      }

      // Clear any progress interval that might be running
      if (typeof progressUpdater !== "undefined") {
        clearInterval(progressUpdater);
      }

      namespace.destroy();

      throw new Error(`Python geometry extraction failed: ${error.message}`);
    }
  } catch (error) {

    const errorMessage =
      error instanceof Error ? error.message : error.toString();

    // Clean up VFS file on outer error too
    if (typeof mountSuccessful !== "undefined" && mountSuccessful) {
      try {
        if (pyodide) pyodide.FS.unlink(VFS_FULL_PATH);
      } catch (e) { }
    }

    // Clear any progress interval that might be running
    if (typeof progressUpdater !== "undefined") {
      clearInterval(progressUpdater);
    }

    self.postMessage({
      type: "error",
      message: `Geometry extraction failed: ${errorMessage}`,
      messageId,
    });
  }
}

// Add the new function
async function handleExtractQuantities(data, messageId) {
  try {
    self.postMessage({
      type: "progress",
      message: "Starting quantity extraction...",
      percentage: 10,
      messageId,
    });

    await initPyodide();

    // Prepare parameters
    const { elementIds = [], quantityType = "area", groupBy = "none", arrayBuffer } = data;
    const quantityTypeLower = quantityType.toLowerCase();
    const idsJson = JSON.stringify(elementIds);

    // --- Write the file buffer to VFS --- 
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("ArrayBuffer for IFC file was not provided or is invalid.");
    }
    try {

      pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));

    } catch (fsError) {

      throw new Error(`Failed to prepare IFC file in VFS: ${fsError.message}`);
    }
    // -------------------------------------

    // Create a namespace for Python execution
    const namespace = pyodide.globals.get("dict")();
    namespace.set("element_ids_json", idsJson);
    namespace.set("quantity_type", quantityTypeLower);
    namespace.set("group_by", groupBy);

    // Python code for quantity extraction
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
            # No standard unit type for count
        }
        unit_type = unit_type_map.get(quantity_type)
        if not unit_type:
            return "" # Return empty string for count or unknown types
            
        # Get the project unit entity
        unit_entity = ifcopenshell.util.unit.get_project_unit(ifc_file, unit_type)
        
        if unit_entity:
            # Get the symbol from the unit entity
            return ifcopenshell.util.unit.get_unit_symbol(unit_entity)
        else:
            # Fallback if no project unit is defined
            print(f"Warning: No default project unit found for {unit_type}")
            return unit_type # Return the type name as fallback
            
    # Determine the unit symbol
    unit_symbol = get_unit_symbol_for_quantity(ifc_file, quantity_type)
    print(f"Determined unit symbol: {unit_symbol}")
    
    # Helper: extract quantity from element
    def extract_quantity(element, quantity_type):
        # Try QTO first
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
        # Fallback: count as 1 if type is count
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

            # Get grouping value based on chosen groupBy option
            group_value = "All" 
            if group_by_option == "type":
                # Use element type without Ifc prefix for readability
                element_type = element.is_a()
                if element_type:
                    # Remove "Ifc" prefix if present
                    if element_type.startswith("Ifc"):
                        element_type = element_type[3:]
                    group_value = element_type
                    
            elif group_by_option == "level":
                # Try to find the building storey
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
                        
            elif group_by_option == "material":
                # Try to find material information
                material_name = "Unknown"
                
                for rel in ifc_file.by_type("IfcRelAssociatesMaterial"):
                    if not hasattr(rel, "RelatedObjects") or not rel.RelatedObjects:
                        continue
                    is_related = False
                    for related_obj in rel.RelatedObjects:
                        if related_obj.id() == eid:
                            is_related = True
                            break
                    if is_related and hasattr(rel, "RelatingMaterial"):
                        material = rel.RelatingMaterial
                        if material.is_a("IfcMaterial"):
                            material_name = getattr(material, "Name", "Unknown Material")
                        elif material.is_a("IfcMaterialList"):
                            if material.Materials and len(material.Materials) > 0:
                                material_name = getattr(material.Materials[0], "Name", "Unknown Material")
                        elif material.is_a("IfcMaterialLayerSetUsage") and hasattr(material, "ForLayerSet"):
                            layer_set = material.ForLayerSet
                            if hasattr(layer_set, "MaterialLayers") and layer_set.MaterialLayers:
                                first_layer = layer_set.MaterialLayers[0]
                                if hasattr(first_layer, "Material") and first_layer.Material:
                                    material_name = getattr(first_layer.Material, "Name", "Unknown Material")
                        group_value = material_name
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
    
    # Group the results by the selected groupBy option
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
    
    # Create the result object using the unit_symbol
    result = {
        "groups": grouped_quantities,
        "unit": unit_symbol,  # Use the determined symbol here
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
`;

    // Progress updater
    const progressUpdater = setInterval(() => {
      try {
        if (namespace.has("progress_info")) {
          const progressInfo = namespace.get("progress_info");
          if (progressInfo) {
            self.postMessage({
              type: "progress",
              message: `Extracted ${progressInfo.processed}/${progressInfo.total} elements...`,
              percentage: progressInfo.percentage,
              messageId,
            });
          }
        }
      } catch (e) { }
    }, 500);

    // Run the Python code
    await pyodide.runPythonAsync(pythonCode, { globals: namespace });
    clearInterval(progressUpdater);

    const success = namespace.get("success");
    if (!success) {
      const errorMsg = namespace.get("error_msg");
      const errorTrace = namespace.get("error_trace");
      throw new Error(`Python error: ${errorMsg}\n${errorTrace}`);
    }

    const resultJson = namespace.get("result_json");
    const results = JSON.parse(resultJson);

    namespace.destroy();

    self.postMessage({
      type: "progress",
      message: "Quantity extraction complete!",
      percentage: 100,
      messageId,
    });

    self.postMessage({
      type: "quantityResults",
      messageId,
      data: results,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Error extracting quantities: ${error.message}`,
      messageId,
    });
  }
}

// Assign material to elements
async function handleAssignMaterial({ elements, materialName, category, description, messageId }) {
  try {
    await initPyodide();

    self.postMessage({
      type: "progress",
      message: "Assigning materials...",
      percentage: 10,
      messageId,
    });

    const namespace = pyodide.globals.get("dict")();

    // Pass data via namespace to avoid string literal limits
    namespace.set("elements_json", JSON.stringify(elements));
    namespace.set("material_name_input_json", JSON.stringify(materialName));
    namespace.set("category_input", category || "");
    namespace.set("description_input", description || "");

    await pyodide.runPythonAsync(`
import json
import ifcopenshell
import ifcopenshell.api

elements_data = json.loads(elements_json)
material_name_input = json.loads(material_name_input_json)
category = category_input
description = description_input

# Helper to get or create material
def get_or_create_material(file, name):
    # Check if material exists
    materials = file.by_type("IfcMaterial")
    for mat in materials:
        if mat.Name == name:
            return mat
    
    # Create new material
    material = ifcopenshell.api.run("material.add_material", file, name=name)
    if description:
        material.Description = description
    if category:
        material.Category = category
    return material

# Process elements
assigned_count = 0
import os

try:
    if not os.path.exists('model.ifc'):
        raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem.")

    file = ifcopenshell.open('model.ifc')
    
    for elem_data in elements_data:
        # Get element by GlobalId or expressId
        element = None
        if 'GlobalId' in elem_data:
            element = file.by_guid(elem_data['GlobalId'])
        elif 'expressId' in elem_data:
            element = file.by_id(elem_data['expressId'])
        elif 'id' in elem_data: # Handle 'id' from some nodes
             element = file.by_guid(elem_data['id']) if isinstance(elem_data['id'], str) and len(elem_data['id']) == 22 else file.by_id(int(elem_data['id'])) if str(elem_data['id']).isdigit() else None
            
        if element:
            # Determine material name for this element
            mat_name = None
            if isinstance(material_name_input, dict) and 'mappings' in material_name_input:
                # Use mapping
                elem_id = str(element.id())
                if elem_id in material_name_input['mappings']:
                    mat_name = material_name_input['mappings'][elem_id]
            elif isinstance(material_name_input, dict) and 'name' in material_name_input:
                mat_name = material_name_input['name']
            elif isinstance(material_name_input, str):
                mat_name = material_name_input
                
            if mat_name:
                material = get_or_create_material(file, mat_name)
                # Assign material (replaces existing if any)
                ifcopenshell.api.run("material.assign_material", file, products=[element], material=material)
                assigned_count += 1

    # Write the modified file back to the filesystem so export can use it
    file.write('model.ifc')
    print(f"Wrote modified IFC file with {assigned_count} material assignments")
    
    success = True
    error_msg = None
except Exception as e:
    success = False
    error_msg = str(e)
    `, { globals: namespace });

    const success = namespace.get("success");
    if (!success) {
      throw new Error(namespace.get("error_msg") || "Failed to assign material");
    }

    const assignedCount = namespace.get("assigned_count");

    self.postMessage({
      type: "materialAssigned",
      messageId,
      result: { assignedCount }
    });

  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Error assigning material: ${error.message}`,
      messageId,
    });
  }
}



// Create materials
async function handleCreateMaterial({ materialName, category, description, messageId }) {
  try {
    await initPyodide();

    self.postMessage({
      type: "progress",
      message: "Creating materials...",
      percentage: 10,
      messageId,
    });

    const namespace = pyodide.globals.get("dict")();

    // Pass data via namespace
    namespace.set("material_name_input_json", JSON.stringify(materialName));
    namespace.set("category_input", category || "");
    namespace.set("description_input", description || "");

    await pyodide.runPythonAsync(`
import json
import ifcopenshell
import ifcopenshell.api

material_name_input = json.loads(material_name_input_json)
category = category_input
description = description_input

# Helper to get or create material
def get_or_create_material(file, name):
    # Check if material exists
    materials = file.by_type("IfcMaterial")
    for mat in materials:
        if mat.Name == name:
            return mat
    
    # Create new material
    material = ifcopenshell.api.run("material.add_material", file, name=name)
    if description:
        material.Description = description
    if category:
        material.Category = category
    return material

created_materials = []
import os

try:
    if not os.path.exists('model.ifc'):
        raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem.")

    file = ifcopenshell.open('model.ifc')
    
    # Determine names to create
    names_to_create = []
    if isinstance(material_name_input, dict) and 'mappings' in material_name_input:
        # Extract unique names from mappings
        names_to_create = list(set(material_name_input['mappings'].values()))
    elif isinstance(material_name_input, dict) and 'name' in material_name_input:
        names_to_create = [material_name_input['name']]
    elif isinstance(material_name_input, list):
        names_to_create = material_name_input
    elif isinstance(material_name_input, str):
        names_to_create = [material_name_input]
        
    for name in names_to_create:
        if name:
            mat = get_or_create_material(file, name)
            created_materials.append({
                "name": mat.Name,
                "category": mat.Category if hasattr(mat, "Category") else "",
                "description": mat.Description if hasattr(mat, "Description") else "",
                "id": mat.id()
            })

    # Write the modified file back to the filesystem so export and other handlers can use it
    file.write('model.ifc')
    print(f"Wrote modified IFC file with {len(created_materials)} materials created")

    success = True
    error_msg = None
except Exception as e:
    success = False
    error_msg = str(e)
    `, { globals: namespace });

    const success = namespace.get("success");
    if (!success) {
      throw new Error(namespace.get("error_msg") || "Failed to create materials");
    }

    const createdMaterials = namespace.get("created_materials").toJs();

    self.postMessage({
      type: "materialCreated",
      messageId,
      result: {
        createdCount: createdMaterials.length,
        materials: createdMaterials
      }
    });

  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Error creating materials: ${error.message}`,
      messageId,
    });
  }
}

// Execute custom Python code against the currently loaded IFC model
async function handleRunPython({ script, arrayBuffer, inputData, properties, messageId }) {
  try {
    await initPyodide();

    // Write IFC file only if arrayBuffer is provided
    let hasIfcFile = false;
    if (arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
      try {
        pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));
        hasIfcFile = true;
      } catch (fsError) {

      }
    }

    const namespace = pyodide.globals.get("dict")();

    // Set up all the variables that should be available to the Python code
    namespace.set("user_script", script);
    namespace.set("input_data_json", JSON.stringify(inputData || null));
    namespace.set("properties_json", JSON.stringify(properties || {}));

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

    success = True
    print("Python: User script executed successfully")

    # Serialize result - handle None and complex objects
    if result is None:
        result_json = "null"
        print("Python: Result is None")
    else:
        try:
            result_json = json.dumps(result)
            print(f"Python: Result serialized successfully - type: {type(result)}")
        except TypeError as json_error:
            # Handle objects that aren't JSON serializable
            result_str = str(result)
            result_json = json.dumps(result_str)
            print(f"Python: Result not JSON serializable, converted to string: {result_str[:100]}...")
            
except Exception as e:
    success = False
    error_msg = str(e)
    error_trace = traceback.format_exc()
    print(f"Python execution error: {error_msg}")
    print(f"Traceback: {error_trace}")
`;

    await pyodide.runPythonAsync(pythonCode, { globals: namespace });

    const success = namespace.get("success");
    if (!success) {
      const errorMsg = namespace.get("error_msg");
      const errorTrace = namespace.get("error_trace");
      throw new Error(`${errorMsg}\n${errorTrace}`);
    }

    const resultJson = namespace.get("result_json");
    const result = resultJson === "null" ? null : JSON.parse(resultJson);
    namespace.destroy();

    self.postMessage({
      type: "pythonResult",
      messageId,
      result,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Error running Python code: ${error.message}`,
      messageId,
    });
  }
}

// Handle SQLite database queries
async function handleSqliteQuery({ query, modelId, messageId }) {
  try {

    await initSqlJsModule();

    // Always use the comprehensive database
    let key = currentSqlKey || (modelId ? `model-sqlite-db:${modelId}` : 'model-sqlite-db');


    await ensureDbLoaded(key);
    if (!sqliteDb) {
      throw new Error('SQLite database is not available in sql.js');
    }

    // Debug: Check what tables are available in the loaded database
    try {
      const tables = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      const tableNames = tables.length > 0 ? tables[0].values.map(row => row[0]) : [];

    } catch (debugError) {

    }
    // Normalize or synthesize SQL if a natural language prompt was provided
    // Permit standard SELECT queries and CTEs that start with WITH
    let rewritten = String(query || '').trim();
    if (!/^(with|select)\b/i.test(rewritten)) {
      const nl = rewritten.toLowerCase();
      // Heuristics
      const wantCount = /\bcount\b|how many|number of/.test(nl);
      const wantNames = /\bname\b|\bnames\b|list\b/.test(nl);
      const wantGuids = /\bguid\b|\bifcguid\b|globalid/.test(nl);
      const limitMatch = nl.match(/\b(\d+)\b/) || nl.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
      const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
      let limit = 10;
      if (limitMatch) {
        const val = limitMatch[1];
        limit = Number(val) || wordToNum[val] || limit;
      }
      const typeMap = [
        ['wall', 'Wall'],
        ['slab', 'Slab'],
        ['beam', 'Beam'],
        ['column', 'Column'],
        ['door', 'Door'],
        ['window', 'Window'],
        ['roof', 'Roof'],
        ['stair', 'Stair'],
        ['space', 'Space'],
        ['furnish', 'FurnishingElement']
      ];
      let cat = '';
      for (const [k, v] of typeMap) { if (nl.includes(k)) { cat = v; break; } }
      if (wantCount) {
        if (cat) {
          rewritten = `SELECT COUNT(*) AS count FROM IfcElement WHERE category='${cat}'`;
        } else {
          rewritten = `SELECT COUNT(*) AS count FROM IfcElement`;
        }
      } else if (wantGuids) {
        if (cat) {
          rewritten = `SELECT GlobalId, Name FROM IfcElement WHERE category='${cat}' LIMIT ${limit}`;
        } else {
          rewritten = `SELECT GlobalId, Name FROM IfcElement LIMIT ${limit}`;
        }
      } else if (wantNames || cat) {
        if (cat) {
          rewritten = `SELECT DISTINCT Name FROM IfcElement WHERE category='${cat}' AND Name IS NOT NULL LIMIT ${limit}`;
        } else {
          rewritten = `SELECT DISTINCT Name FROM IfcElement WHERE Name IS NOT NULL LIMIT ${limit}`;
        }
      } else {
        // Generic fallback
        rewritten = `SELECT * FROM IfcElement LIMIT ${limit}`;
      }
    }
    // Rewrite common aliases so prompts using IfcElement.* work

    // Column normalizations
    // Only perform heavy normalization if we generated a heuristic query above.
    // Detect this based on whether the query begins with WITH/SELECT.
    const isExplicitSql = /^(with|select)\b/i.test(rewritten);
    if (isExplicitSql) {
      // For explicit SQL (like CTEs used by our quantities), only trivial normalization.
      rewritten = rewritten.replace(/\bIfcGuid\b/gi, 'GlobalId');
    } else {
      rewritten = rewritten.replace(/\bIfcGuid\b/gi, 'GlobalId');
    }

    // Legacy table/alias prefixes from previous schemas → map to IfcElement view
    if (!isExplicitSql) {
      rewritten = rewritten
        .replace(/\bIfcBuildingElementElement\./gi, 'IfcElement.')
        .replace(/\bIfcBuildingElement\./gi, 'IfcElement.')
        .replace(/\bIfcObject\./gi, 'IfcElement.');
    }

    // Table/view and type normalizations

    if (!isExplicitSql) {
      rewritten = rewritten
        .replace(/\bFROM\s+elements\s+AS\s+IfcElement\b/gi, 'FROM IfcElement AS IfcElement')
        .replace(/\bFROM\s+elements\b/gi, 'FROM IfcElement')
        .replace(/\bJOIN\s+elements\b/gi, 'JOIN IfcElement')
        .replace(/\bIfcElement\.element_type\b/gi, 'IfcElement.type')
        .replace(/\belement_type\b/gi, 'type')
        .replace(/\bIfcType\b/gi, 'type');
    }

    // Normalize type comparisons when users use category names (Wall, Slab, ...)
    // type = 'Wall'  => category = 'Wall'
    if (!isExplicitSql) {
      rewritten = rewritten.replace(/\btype\s*=\s*'([A-Za-z]+)'/gi, (m, val) => {
        if (/^Ifc/i.test(val)) return m; // already full Ifc type
        return `category='${val}'`;
      });
      // type IN ('Wall','Door') => category IN (...)
      rewritten = rewritten.replace(/\btype\s+IN\s*\(([^\)]+)\)/gi, (m, list) => `category IN (${list})`);
      // LOWER(type) = 'wall' => LOWER(category) = 'wall'
      rewritten = rewritten.replace(/LOWER\(\s*type\s*\)/gi, 'LOWER(category)');
    }
    const result = sqliteDb.exec(rewritten);
    // sql.js returns an array of result sets; map first set to list of objects
    let rows = [];
    if (Array.isArray(result) && result.length > 0) {
      const r = result[0];
      const cols = r.columns || [];
      rows = (r.values || []).map(arr => {
        const obj = {};
        cols.forEach((c, i) => { obj[c] = arr[i]; });
        return obj;
      });
    }

    self.postMessage({
      type: "sqliteResult",
      messageId,
      result: rows,
      query: rewritten,
    });
  } catch (error) {

    self.postMessage({
      type: "error",
      message: `Error executing SQLite query: ${error.message}`,
      messageId,
    });
  }
}

// Export the current sql.js database bytes back to the main thread
async function handleSqliteExport({ modelId, messageId }) {
  try {


    // First try to get the comprehensive database from IndexedDB (created by ifc2sql.py Patcher)
    const key = currentSqlKey || (modelId ? `model-sqlite-db:${modelId}` : 'model-sqlite-db');



    try {
      const comprehensiveDbBytes = await idbGet(key);
      if (comprehensiveDbBytes) {




        // Quick analysis of the comprehensive database
        try {
          await initSqlJsModule();
          const tempDb = new SQLModule.Database(new Uint8Array(comprehensiveDbBytes));
          const result = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
          const tableCount = result.length > 0 ? result[0].values.length : 0;

          tempDb.close();
        } catch (analysisError) {

        }

        self.postMessage({
          type: "sqliteExport",
          messageId,
          bytes: comprehensiveDbBytes
        }, [comprehensiveDbBytes.buffer]);
        return;
      } else {
        throw new Error("No comprehensive database found in IndexedDB. The IFC file needs to be reloaded.");
      }
    } catch (idbError) {
      throw new Error(`Failed to export database: ${idbError.message}`);
    }
  } catch (error) {

    self.postMessage({
      type: "error",
      message: `Error exporting SQLite DB: ${error.message}`,
      messageId,
    });
  }
}

// Warm sql.js by opening the persisted DB bytes
async function handleWarmSqlite({ modelKey, messageId }) {
  try {
    await initSqlJsModule();
    // Prefer content-based dbKey if available in cache
    const preferredKey = (ifcModelCache?.dbKey) || currentSqlKey || (modelKey ? `model-sqlite-db:${modelKey}` : null);
    if (!preferredKey) throw new Error("No SQLite database key available to warm");

    // If no bytes exist yet, build the DB now (deferred build path)
    let bytes = await idbGet(preferredKey);
    if (!bytes) {
      try { postSqliteStatus('building', modelKey, {}); } catch { }
      // Ensure model.ifc exists: if missing and we have a recent load buffer, skip build with explicit error
      try {
        await handleBuildSqlite({ modelKey, dbKey: ifcModelCache?.dbKey });
      } catch (e) {
        throw e;
      }
      bytes = await idbGet(preferredKey);
    }
    if (!bytes) throw new Error("No SQLite bytes found in IndexedDB to load");

    // Load into sql.js
    sqliteDb = new SQLModule.Database(new Uint8Array(bytes));
    currentSqlKey = preferredKey;

    let tableCount = 0;
    try {
      const res = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
      tableCount = res.length > 0 ? (res[0].values?.length || 0) : 0;
    } catch (e) { }

    self.postMessage({ type: "sqliteWarmed", messageId, key: preferredKey, tableCount });
  } catch (error) {

    self.postMessage({ type: "error", message: `Error warming SQLite: ${error.message}`, messageId });
  }
}

// Normalize IFC4X3 schema variants to IFC4X3_ADD2
// Converts IFC4X3_RC1, IFC4X3_RC2, IFC4X3_RC3, etc. to IFC4X3_ADD2
// This is required because ifcopenshell may not recognize older IFC4X3 schema variants
// Optimized: Only scans first 10KB (header section) instead of entire file
function normalizeIfc4x3Schema(uint8Array) {
  try {
    // Only scan header section (~first 10KB contains FILE_SCHEMA)
    const headerSize = Math.min(10240, uint8Array.length);
    const headerBytes = uint8Array.subarray(0, headerSize);
    const headerText = new TextDecoder('utf-8').decode(headerBytes);
    
    const regex = /FILE_SCHEMA\s*\(\s*\(\s*'IFC4X3(?:_[A-Z0-9]+)?'\s*\)\s*\)/;
    const match = headerText.match(regex);
    
    if (match) {
      // Find position and replace in full array
      const matchStart = headerText.indexOf(match[0]);
      const replacement = "FILE_SCHEMA(('IFC4X3_ADD2'))";
      const before = uint8Array.subarray(0, matchStart);
      const after = uint8Array.subarray(matchStart + match[0].length);
      const replacementBytes = new TextEncoder().encode(replacement);
      
      const result = new Uint8Array(before.length + replacementBytes.length + after.length);
      result.set(before, 0);
      result.set(replacementBytes, before.length);
      result.set(after, before.length + replacementBytes.length);
      
      console.log("Schema normalization applied - converted IFC4X3 variant to IFC4X3_ADD2");
      return result;
    }
    return uint8Array;
  } catch (normalizationError) {
    console.warn("Schema normalization failed, using original file:", normalizationError);
    return uint8Array;
  }
}

// Handle loading an IFC file: parse IFC metadata and counts, then build SQLite in background
async function handleLoadIfc({ arrayBuffer, filename, messageId }) {
  try {
    await initPyodide();

    let uint8Array = new Uint8Array(arrayBuffer);
    
    // Normalize IFC4X3 schema variants
    uint8Array = normalizeIfc4x3Schema(uint8Array);
    
    pyodide.FS.writeFile("model.ifc", uint8Array);

    const ns = pyodide.globals.get("dict")();
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
  # Single-pass extraction using IfcOpenShell's efficient by_type()
  print("Python: Fast extraction of all IFC elements...")
  
  all_elements = []
  element_counts = {}
  
  # Essential spatial types to always include
  SPATIAL_TYPES = ['IfcProject', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey', 
                   'IfcSpace', 'IfcZone', 'IfcFacility', 'IfcFacilityPart']
  
  # Get products with geometry in one pass
  products_with_geom = []
  for e in f.by_type('IfcProduct'):
    try:
      if hasattr(e, 'Representation') and e.Representation is not None:
        products_with_geom.append(e)
    except:
      continue
  
  # Collect unique types from products with geometry
  types_found = set(e.is_a() for e in products_with_geom)
  
  # Add spatial types that exist in the model
  for spatial_type in SPATIAL_TYPES:
    try:
      spatial_elements = f.by_type(spatial_type)
      if spatial_elements:
        types_found.add(spatial_type)
    except:
      continue
  
  # Extract elements by type (single iteration per type)
  for element_type in sorted(types_found):
    try:
      elements = f.by_type(element_type)
      if not elements:
        continue
      
      element_counts[element_type] = len(elements)
      
      for el in elements:
        try:
          element_dict = {
            'expressId': el.id(),
            'type': element_type,
            'properties': {},
            'psets': {},
            'relationships': {}
          }
          
          # Extract essential properties
          if hasattr(el, 'GlobalId') and el.GlobalId:
            element_dict['properties']['GlobalId'] = el.GlobalId
          if hasattr(el, 'Name') and el.Name:
            element_dict['properties']['Name'] = el.Name
          
          # Lightweight material reference (name only, not full structure)
          if hasattr(el, 'HasAssociations') and el.HasAssociations:
            for assoc in el.HasAssociations:
              if assoc.is_a('IfcRelAssociatesMaterial'):
                mat = getattr(assoc, 'RelatingMaterial', None)
                if mat:
                  element_dict['relationships']['material'] = {
                    'name': getattr(mat, 'Name', None),
                    'type': mat.is_a()
                  }
                break
          
          # Extract Type Definition (lightweight)
          if hasattr(el, 'IsTypedBy') and el.IsTypedBy:
            for rel in el.IsTypedBy:
              if rel.is_a('IfcRelDefinesByType'):
                relating_type = rel.RelatingType
                element_dict['relationships']['IsTypedBy'] = {
                  'RelatingType': {
                    'Name': getattr(relating_type, 'Name', None),
                    'type': relating_type.is_a()
                  }
                }
                break
          
          # Add type-specific essential properties
          if element_type == 'IfcBuildingStorey' and hasattr(el, 'Elevation'):
            element_dict['properties']['Elevation'] = el.Elevation
          elif element_type == 'IfcProject' and hasattr(el, 'LongName') and el.LongName:
            element_dict['properties']['LongName'] = el.LongName
          
          all_elements.append(element_dict)
          
        except Exception as e:
          # Skip problematic elements but continue
          continue
          
    except Exception as e:
      # Skip element types that don't exist
      continue

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
    );

    // Send progress update after Python execution
    self.postMessage({
      type: "progress",
      message: "Processing Python results...",
      percentage: 90,
      messageId,
    });

    const ok = ns.get("success");
    if (!ok) {
      const em = ns.get("error_msg") || "Unknown error";
      throw new Error(String(em));
    }
    const result = JSON.parse(ns.get("result_json"));
    ns.destroy();

    // Send progress update after getting results
    self.postMessage({
      type: "progress",
      message: `Found ${result.total_elements || 0} elements`,
      percentage: 95,
      messageId,
    });

    const dbKey = computeDbKeyFromBuffer(result.model_id || result.filename, arrayBuffer);
    ifcModelCache = { filename: result.filename, schema: result.schema, model_id: result.model_id, dbKey };

    self.postMessage({ type: "progress", message: "IFC file loaded successfully!", percentage: 100, messageId });
    self.postMessage({ type: "loadComplete", messageId, ...result, sqlite_db: null, sqlite_success: false });

    // Background build of comprehensive SQLite for ALL models (non-blocking)
    try { postSqliteStatus('building', result.model_id || result.filename, {}); } catch { }
    setTimeout(async () => {
      try {
        await handleBuildSqlite({ modelKey: result.model_id || result.filename, dbKey });
      } catch (e) {

        try { postSqliteStatus('error', result.model_id || result.filename, { message: e.message }); } catch { }
      }
    }, 0);
  } catch (error) {

    self.postMessage({ type: "error", message: `Error loading IFC file: ${error.message}`, messageId });
  }
}

// Build comprehensive SQLite using Ifc2Sql
async function handleBuildSqlite({ modelKey, dbKey, messageId }) {
  try {
    await initPyodide();
    try { postSqliteStatus('building', modelKey, {}); } catch { }

    const ns = pyodide.globals.get("dict")();
    await pyodide.runPythonAsync(
      `
import os, sqlite3, json
try:
  from ifc2sql import Patcher
except Exception:
  Patcher = globals().get('Patcher', None)
success = False
db_path = '/model.db'
try:
  import ifcopenshell
  if not os.path.exists('model.ifc'):
    raise FileNotFoundError('model.ifc not found')
  f = ifcopenshell.open('model.ifc')
  if Patcher is None:
    # NOTE: Skipping ifcopenshell.ifcpatch - it corrupts the WASM module
    # Use ifcopenshell.sql directly instead
    import ifcopenshell.sql
    print("Python: Using ifcopenshell.sql for SQLite conversion")
    db = ifcopenshell.sql.sqlite(db_path)
    success = os.path.exists(db_path)
    print(f"Python: ifcopenshell.sql SQLite created: {success}")
  else:
    if os.path.exists(db_path):
      os.remove(db_path)
    patcher = Patcher(
      file=f,
      sql_type='SQLite',
      database=db_path,
      full_schema=True,
      is_strict=False,
      should_expand=False,
      should_get_inverses=True,
      should_get_psets=True,
      should_get_geometry=False,
      should_skip_geometry_data=False
    )
    patcher.patch()
    success = os.path.exists(db_path)
  # Minimal metadata only; avoid per-table row counting/logging
  table_count = 0
  if success:
    try:
      conn = sqlite3.connect(db_path)
      c = conn.cursor()
      c.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
      table_count = int(c.fetchone()[0])
      conn.close()
    except Exception:
      table_count = 0
  result = json.dumps({'success': success, 'db_path': db_path, 'table_count': table_count})
except Exception as e:
  result = json.dumps({'success': False, 'error': str(e)})
      `,
      { globals: ns }
    );
    const pyRes = JSON.parse(ns.get("result"));
    ns.destroy();
    if (!pyRes.success) throw new Error(pyRes.error || 'SQLite build failed');

    // If a duplicate exists under dbKey, skip storing/building
    const dbBytes = pyodide.FS.readFile(pyRes.db_path);
    const effectiveKey = dbKey || (ifcModelCache?.dbKey);
    const key = effectiveKey || `model-sqlite-db:${modelKey || (ifcModelCache?.model_id || ifcModelCache?.filename || 'default')}`;
    currentSqlKey = key;
    try { await idbDelete(key); } catch { }
    await idbPut(key, dbBytes);

    // Defer sql.js warm-up; only persist now. AI node will warm on demand.

    try { postSqliteStatus('ready', modelKey, { tableCount: pyRes.table_count }); } catch { }
    self.postMessage({ type: 'sqliteBuilt', key, tableCount: pyRes.table_count, byteLength: dbBytes.length });
  } catch (error) {

    try { postSqliteStatus('error', modelKey, { message: error.message }); } catch { }
    if (messageId) {
      self.postMessage({ type: 'error', message: `Error building SQLite: ${error.message}`, messageId });
    }
  }
}

// Get full material details for an element
async function handleGetMaterialDetails({ elementId, expressId, messageId }) {
  try {
    await initPyodide();

    if (!pyodide.FS.analyzePath('model.ifc').exists) {
      throw new Error('Model file not found');
    }

    const ns = pyodide.globals.get("dict")();
    await pyodide.runPythonAsync(
      `
import ifcopenshell, json
try:
  f = ifcopenshell.open('model.ifc')
  
  # Find element by expressId
  element = f.by_id(${expressId})
  
  material_details = None
  
  # Extract full material associations
  if hasattr(element, "HasAssociations") and element.HasAssociations:
    for assoc in element.HasAssociations:
      if assoc.is_a("IfcRelAssociatesMaterial"):
        mat = getattr(assoc, "RelatingMaterial", None)
        if mat:
          material_details = {
            "Name": getattr(mat, "Name", None),
            "type": mat.is_a()
          }
          
          # Extract full layer/constituent/profile details
          if mat.is_a("IfcMaterialLayerSetUsage"):
            if hasattr(mat, "ForLayerSet"):
              ls = mat.ForLayerSet
              material_details["ForLayerSet"] = {
                "LayerSetName": getattr(ls, "LayerSetName", None),
                "MaterialLayers": []
              }
              if hasattr(ls, "MaterialLayers"):
                for layer in ls.MaterialLayers:
                  layer_mat_name = getattr(layer.Material, "Name", None) if hasattr(layer, "Material") and layer.Material else "Unnamed"
                  material_details["ForLayerSet"]["MaterialLayers"].append({
                    "Material": {"Name": layer_mat_name},
                    "LayerThickness": getattr(layer, "LayerThickness", 0)
                  })
          elif mat.is_a("IfcMaterialLayerSet"):
            material_details["MaterialLayers"] = []
            if hasattr(mat, "MaterialLayers"):
              for layer in mat.MaterialLayers:
                layer_mat_name = getattr(layer.Material, "Name", None) if hasattr(layer, "Material") and layer.Material else "Unnamed"
                material_details["MaterialLayers"].append({
                  "Material": {"Name": layer_mat_name},
                  "LayerThickness": getattr(layer, "LayerThickness", 0)
                })
          elif mat.is_a("IfcMaterialConstituentSet"):
            material_details["MaterialConstituents"] = []
            if hasattr(mat, "MaterialConstituents"):
              for const in mat.MaterialConstituents:
                const_mat_name = getattr(const.Material, "Name", None) if hasattr(const, "Material") and const.Material else "Unnamed"
                material_details["MaterialConstituents"].append({
                  "Material": {"Name": const_mat_name},
                  "Name": getattr(const, "Name", None),
                  "Fraction": getattr(const, "Fraction", None)
                })
          elif mat.is_a("IfcMaterialProfileSet"):
            material_details["MaterialProfiles"] = []
            if hasattr(mat, "MaterialProfiles"):
              for prof in mat.MaterialProfiles:
                prof_mat_name = getattr(prof.Material, "Name", None) if hasattr(prof, "Material") and prof.Material else "Unnamed"
                material_details["MaterialProfiles"].append({
                  "Material": {"Name": prof_mat_name},
                  "Name": getattr(prof, "Name", None)
                })
          elif mat.is_a("IfcMaterialProfileSetUsage"):
            if hasattr(mat, "ForProfileSet"):
              ps = mat.ForProfileSet
              material_details["ForProfileSet"] = {
                "Name": getattr(ps, "Name", None),
                "MaterialProfiles": []
              }
              if hasattr(ps, "MaterialProfiles"):
                for prof in ps.MaterialProfiles:
                  prof_mat_name = getattr(prof.Material, "Name", None) if hasattr(prof, "Material") and prof.Material else "Unnamed"
                  material_details["ForProfileSet"]["MaterialProfiles"].append({
                    "Material": {"Name": prof_mat_name},
                    "Name": getattr(prof, "Name", None)
                  })
          break
  
  result_json = json.dumps(material_details) if material_details else json.dumps(None)
  success = True
except Exception as e:
  result_json = json.dumps(None)
  error_msg = str(e)
  success = False
      `,
      { globals: ns }
    );

    const ok = ns.get("success");
    if (!ok) {
      const em = ns.get("error_msg") || "Unknown error";
      throw new Error(String(em));
    }
    
    const materialDetails = JSON.parse(ns.get("result_json"));
    ns.destroy();

    self.postMessage({
      type: "materialDetails",
      messageId,
      materialDetails,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Error getting material details: ${error.message}`,
      messageId,
    });
  }
}