/* global importScripts */
// Import Pyodide v0.28.0 (optimal compatibility with ifcopenshell-0.8.4 wheel)
importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js");
// Load sql.js (SQLite WASM)
importScripts("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js");
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // lib/workers/worker-utils.ts
  function postProgress(messageId, percentage, message) {
    try {
      self.postMessage({
        type: "progress",
        messageId,
        percentage,
        message
      });
    } catch (e) {
    }
  }
  function postError(messageId, error) {
    try {
      self.postMessage({
        type: "error",
        messageId,
        message: error.message,
        stack: error.stack
      });
    } catch (e) {
    }
  }
  function postMessage(message, transfer) {
    try {
      if (transfer && transfer.length > 0) {
        self.postMessage(message, transfer);
      } else {
        self.postMessage(message);
      }
    } catch (e) {
    }
  }
  var init_worker_utils = __esm({
    "lib/workers/worker-utils.ts"() {
      "use strict";
    }
  });

  // lib/workers/shared/pyodide-manager.ts
  var _PyodideManager, PyodideManager;
  var init_pyodide_manager = __esm({
    "lib/workers/shared/pyodide-manager.ts"() {
      "use strict";
      _PyodideManager = class _PyodideManager {
        constructor() {
          this.pyodide = null;
          this.pySqliteReady = false;
          this.isInitializing = false;
          this.initializationPromise = null;
        }
        static getInstance() {
          if (!_PyodideManager.instance) {
            _PyodideManager.instance = new _PyodideManager();
          }
          return _PyodideManager.instance;
        }
        /**
         * Get current Pyodide instance
         */
        getInstance() {
          return this.pyodide;
        }
        /**
         * Check if Pyodide is initialized
         */
        isInitialized() {
          return this.pyodide !== null;
        }
        /**
         * Check if Python sqlite3 is available
         */
        isPySqliteReady() {
          return this.pySqliteReady;
        }
        /**
         * Initialize Pyodide with IfcOpenShell
         */
        async initialize(onProgress, ensureIfc2sqlPyCode) {
          if (this.pyodide) {
            return this.pyodide;
          }
          if (this.isInitializing && this.initializationPromise) {
            return this.initializationPromise;
          }
          this.isInitializing = true;
          this.initializationPromise = this._doInitialize(onProgress, ensureIfc2sqlPyCode);
          try {
            this.pyodide = await this.initializationPromise;
            return this.pyodide;
          } finally {
            this.isInitializing = false;
            this.initializationPromise = null;
          }
        }
        async _doInitialize(onProgress, ensureIfc2sqlPyCode) {
          onProgress == null ? void 0 : onProgress(5, "Loading Pyodide...");
          try {
            console.log("initPyodide: Starting Pyodide initialization");
            const pyodide = await loadPyodide({
              indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.0/full/"
            });
            console.log("initPyodide: Pyodide loaded successfully");
            onProgress == null ? void 0 : onProgress(30, "Installing required packages...");
            console.log("initPyodide: Loading micropip, numpy, typing-extensions");
            await pyodide.loadPackage(["micropip", "numpy", "typing-extensions"]);
            console.log("initPyodide: Basic packages loaded");
            await pyodide.runPythonAsync(`
        import sys

        # SIMPLE BYPASS: Just replace the core check function
        def simple_bypass(filename):
            print(f"\u{1F6AB} BYPASSED: Allowing wheel {filename}")
            return None

        # Import micropip first
        import micropip
        print("Micropip imported successfully")

        # Only patch the essential compatibility check
        import micropip._utils
        micropip._utils.check_compatible = simple_bypass
        print("\u2705 Disabled micropip._utils.check_compatible")

        # Verify the patch worked
        try:
            result = micropip._utils.check_compatible("test.whl")
            print(f"\u{1F9EA} Compatibility check result: {result}")
        except Exception as e:
            print(f"\u274C Error testing compatibility check: {e}")

        print("\u{1F3AF} SIMPLE BYPASS COMPLETE")
      `);
            onProgress == null ? void 0 : onProgress(50, "Installing IfcOpenShell...");
            await pyodide.runPythonAsync(`
        import micropip, importlib

        # SIMPLE BYPASS RE-APPLICATION FOR INSTALLATIONS
        def simple_bypass(filename):
            print(f"\u{1F6AB} BYPASSED: Allowing wheel {filename}")
            return None

        # Ensure bypass is active before installations
        import micropip._utils
        micropip._utils.check_compatible = simple_bypass
        print("\u2705 Bypass ready for installations")

        # Install lark for stream support
        print("\u{1F4E6} Installing lark...")
        await micropip.install('lark')
        print("\u2705 Lark installed successfully")

        # Use local 0.8.4 wheel - supports IFC4X3_ADD2 schema
        wheel_urls = [
            '/wasm/ifcopenshell-0.8.4+b1b95ec-cp313-cp313-emscripten_4_0_9_wasm32.whl'
        ]
        last_exc = None
        installed = False
        for url in wheel_urls:
            try:
                print(f"\u{1F3AF} Installing ifcopenshell 0.8.4: {url}")

                # Ensure bypass is active before each install
                micropip._utils.check_compatible = simple_bypass

                await micropip.install(url, keep_going=True, deps=False)

                # Verify import works
                import ifcopenshell
                print('\u2705 IfcOpenShell 0.8.4 import OK:', getattr(ifcopenshell, 'version', 'unknown'))

                print("\u2705 SUCCESS: IfcOpenShell 0.8.4 loaded and ready for IFC processing!")

                installed = True
                break
            except Exception as e:
                last_exc = e
                print(f"\u274C Install/import failed for ifcopenshell 0.8.4: {e}")
                # Clean up failed installation
                try:
                    import sys
                    if 'ifcopenshell' in sys.modules:
                        del sys.modules['ifcopenshell']
                    import importlib
                    importlib.invalidate_caches()
                    print("\u{1F9F9} Cleaned up failed ifcopenshell 0.8.4 installation")
                except Exception as cleanup_e:
                    print(f"\u274C Cleanup failed: {cleanup_e}")

        if not installed:
            if last_exc:
                raise last_exc
            else:
                raise RuntimeError('Failed to install IfcOpenShell 0.8.4')
      `);
            try {
              await pyodide.loadPackage(["sqlite3"]);
              await pyodide.runPythonAsync(`import sqlite3
print('sqlite3 available')`);
              this.pySqliteReady = true;
            } catch (e) {
              this.pySqliteReady = false;
            }
            onProgress == null ? void 0 : onProgress(62, "Loading shapely...");
            try {
              await pyodide.loadPackage(["shapely"]);
              await pyodide.runPythonAsync(`import shapely
print('shapely available')`);
            } catch (e) {
            }
            onProgress == null ? void 0 : onProgress(60, "Installing SQLite and Ifc2Sql support...");
            await pyodide.runPythonAsync(`
        import sys
        import ifcopenshell
        import ifcopenshell.sql
        import json

        # Global variables for storing SQLite databases
        sqlite_databases = {}
      `);
            try {
              await pyodide.runPythonAsync(`
          import micropip
          try:
              await micropip.install('ifcpatch', keep_going=True)
              print('ifcpatch installed')
          except Exception as e:
              print('ifcpatch install warning:', e)

          # Install additional dependencies
          try:
              await micropip.install(['numpy', 'shapely'], keep_going=True)
              print('Additional dependencies installed')
          except Exception as e:
              print('Additional dependencies install warning:', e)

          # Also install ifcopenshell dependencies
          try:
              await micropip.install(['ifcopenshell'], keep_going=True)
              print('ifcopenshell installed for ifc2sql.py')
          except Exception as e:
              print('ifcopenshell install warning:', e)
        `);
            } catch (e) {
            }
            if (ensureIfc2sqlPyCode) {
              const ifc2sqlText = await ensureIfc2sqlPyCode();
              if (ifc2sqlText) {
                const encoded = btoa(unescape(encodeURIComponent(ifc2sqlText)));
                await pyodide.runPythonAsync(`
            import base64
            import sys
            import importlib

            # First ensure ifcopenshell is available
            try:
                import ifcopenshell
                print('ifcopenshell available for ifc2sql.py')
            except ImportError as e:
                print('ifcopenshell not available:', e)

            try:
                import ifcpatch
                print('ifcpatch available for ifc2sql.py')
            except ImportError as e:
                print('ifcpatch not available:', e)

            # Decode and execute the ifc2sql.py code
            src = base64.b64decode('${encoded}').decode('utf-8')

            # Create a new module and execute the code in it
            import types
            ifc2sql_module = types.ModuleType('ifc2sql')
            sys.modules['ifc2sql'] = ifc2sql_module

            try:
                exec(src, ifc2sql_module.__dict__)
                Patcher = getattr(ifc2sql_module, 'Patcher', None)
                print('official ifc2sql.py loaded successfully:', bool(Patcher))
                if Patcher:
                    print('Patcher class found:', Patcher.__name__)
                    # Make Patcher available globally for later use
                    globals()['Patcher'] = Patcher
                    print('Patcher class added to globals')
                else:
                    print('Patcher class not found in ifc2sql.py')
            except Exception as e:
                print('Error loading ifc2sql.py:', e)
                import traceback
                print(traceback.format_exc())
                Patcher = None
          `);
              }
            }
            onProgress == null ? void 0 : onProgress(100, "IfcOpenShell loaded successfully");
            return pyodide;
          } catch (error) {
            throw new Error(`Failed to load Pyodide: ${error.message}`);
          }
        }
        /**
         * Ensure ifc2sql.py code is loaded (helper function)
         */
        async ensureIfc2sqlPyCode() {
          try {
            const res = await fetch("/ifc2sql.py");
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            return await res.text();
          } catch (e) {
            console.warn("Failed to load ifc2sql.py:", e);
            return null;
          }
        }
      };
      _PyodideManager.instance = null;
      PyodideManager = _PyodideManager;
    }
  });

  // lib/workers/shared/indexeddb-manager.ts
  var indexeddb_manager_exports = {};
  __export(indexeddb_manager_exports, {
    IndexedDBManager: () => IndexedDBManager
  });
  var IDB_NAME, IDB_STORE, _IndexedDBManager, IndexedDBManager;
  var init_indexeddb_manager = __esm({
    "lib/workers/shared/indexeddb-manager.ts"() {
      "use strict";
      IDB_NAME = "ifc-sql-db";
      IDB_STORE = "sqlite";
      _IndexedDBManager = class _IndexedDBManager {
        constructor() {
        }
        static getInstance() {
          if (!_IndexedDBManager.instance) {
            _IndexedDBManager.instance = new _IndexedDBManager();
          }
          return _IndexedDBManager.instance;
        }
        /**
         * Open IndexedDB database
         */
        async open() {
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
        /**
         * Store database bytes in IndexedDB
         */
        async put(key, bytes) {
          const db = await this.open();
          return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
            tx.objectStore(IDB_STORE).put(bytes, key);
          });
        }
        /**
         * Get database bytes from IndexedDB
         */
        async get(key) {
          const db = await this.open();
          return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readonly");
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => {
              const v = req.result || null;
              db.close();
              resolve(v);
            };
            req.onerror = () => {
              const e = req.error;
              db.close();
              reject(e);
            };
          });
        }
        /**
         * Delete database from IndexedDB
         */
        async delete(key) {
          const db = await this.open();
          return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            const req = tx.objectStore(IDB_STORE).delete(key);
            req.onsuccess = () => {
              db.close();
              resolve();
            };
            req.onerror = () => {
              const e = req.error;
              db.close();
              reject(e);
            };
          });
        }
        /**
         * Clean up old fallback databases from IndexedDB
         */
        async cleanupFallbackDatabases() {
          try {
            const db = await new Promise((resolve, reject) => {
              const req = indexedDB.open("ifcWorkerDB", 1);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            const tx = db.transaction(["kvStore"], "readonly");
            const store = tx.objectStore("kvStore");
            const getAllKeysReq = store.getAllKeys();
            await new Promise((resolve, reject) => {
              getAllKeysReq.onsuccess = async () => {
                const keys = getAllKeysReq.result;
                const fallbackKeys = keys.filter((k) => k.includes(":v2"));
                if (fallbackKeys.length > 0) {
                  const deleteTx = db.transaction(["kvStore"], "readwrite");
                  const deleteStore = deleteTx.objectStore("kvStore");
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
            console.warn("Failed to cleanup fallback databases:", error);
          }
        }
        /**
         * Compute database key from buffer for caching
         */
        computeDbKeyFromBuffer(filename, arrayBuffer) {
          try {
            const u8 = new Uint8Array(arrayBuffer);
            const size = u8.length >>> 0;
            const slice = 16 * 1024 * 1024;
            const first = u8.subarray(0, Math.min(slice, size));
            const last = size > slice ? u8.subarray(size - slice, size) : first;
            const c1 = this.crc32(first).toString(16);
            const c2 = this.crc32(last).toString(16);
            return `db:${size}-${c1}-${c2}`;
          } catch (e) {
            return `db:${filename || "default"}`;
          }
        }
        /**
         * Fast CRC32 implementation for Uint8Array
         */
        crc32(uint8) {
          let crc = -1 >>> 0;
          for (let i = 0; i < uint8.length; i++) {
            crc = (crc ^ uint8[i]) >>> 0;
            for (let j = 0; j < 8; j++) {
              const mask = -(crc & 1);
              crc = crc >>> 1 ^ 3988292384 & mask;
            }
          }
          return (crc ^ -1 >>> 0) >>> 0;
        }
      };
      _IndexedDBManager.instance = null;
      IndexedDBManager = _IndexedDBManager;
    }
  });

  // lib/workers/core/state.ts
  var _WorkerState, WorkerState;
  var init_state = __esm({
    "lib/workers/core/state.ts"() {
      "use strict";
      _WorkerState = class _WorkerState {
        constructor() {
          this.pyodide = null;
          this.sqliteDb = null;
          this.currentSqlKey = null;
          this.ifcModelCache = null;
        }
        static getInstance() {
          if (!_WorkerState.instance) {
            _WorkerState.instance = new _WorkerState();
          }
          return _WorkerState.instance;
        }
        // Pyodide
        getPyodide() {
          return this.pyodide;
        }
        setPyodide(pyodide) {
          this.pyodide = pyodide;
        }
        // SQLite
        getSqliteDb() {
          return this.sqliteDb;
        }
        setSqliteDb(db) {
          this.sqliteDb = db;
        }
        getCurrentSqlKey() {
          return this.currentSqlKey;
        }
        setCurrentSqlKey(key) {
          this.currentSqlKey = key;
        }
        // IFC Model Cache
        getIfcModelCache() {
          return this.ifcModelCache;
        }
        setIfcModelCache(cache) {
          this.ifcModelCache = cache;
        }
        /**
         * Reset all state (useful for cleanup)
         */
        reset() {
          this.pyodide = null;
          this.sqliteDb = null;
          this.currentSqlKey = null;
          this.ifcModelCache = null;
        }
      };
      _WorkerState.instance = null;
      WorkerState = _WorkerState;
    }
  });

  // lib/workers/handlers/init-handler.ts
  var init_handler_exports = {};
  __export(init_handler_exports, {
    handleInit: () => handleInit
  });
  async function handleInit(message) {
    const { messageId } = message;
    try {
      postProgress(messageId, 5, "Initializing worker...");
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      postProgress(messageId, 95, "Cleaning up old databases...");
      const idbManager = IndexedDBManager.getInstance();
      await idbManager.cleanupFallbackDatabases();
      postMessage({
        type: "initialized",
        messageId
      });
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  var init_init_handler = __esm({
    "lib/workers/handlers/init-handler.ts"() {
      "use strict";
      init_worker_utils();
      init_pyodide_manager();
      init_indexeddb_manager();
      init_state();
    }
  });

  // lib/workers/handlers/ifc-loader-handler.ts
  var ifc_loader_handler_exports = {};
  __export(ifc_loader_handler_exports, {
    handleLoadIfc: () => handleLoadIfc,
    handleLoadIfcFast: () => handleLoadIfcFast
  });
  function normalizeIfcSchema(uint8Array) {
    try {
      const fileContents = new TextDecoder("utf-8").decode(uint8Array);
      console.log("handleLoadIfc: Applying schema normalization");
      const regex = /FILE_SCHEMA\s*\(\s*\(\s*'IFC4X3(?:_[A-Z0-9]+)?'\s*\)\s*\)/;
      const replacement = "FILE_SCHEMA(('IFC4X3_ADD2'))";
      const normalizedContents = fileContents.replace(regex, replacement);
      if (normalizedContents !== fileContents) {
        console.log(
          "handleLoadIfc: Schema normalization applied - converted IFC4X3 variant to IFC4X3_ADD2"
        );
      }
      const encoded = new TextEncoder().encode(normalizedContents);
      const newBuffer = new ArrayBuffer(encoded.length);
      const newArray = new Uint8Array(newBuffer);
      newArray.set(encoded);
      return newArray;
    } catch (normalizationError) {
      console.warn("handleLoadIfc: Schema normalization failed, proceeding with original file:", normalizationError);
      const newBuffer = new ArrayBuffer(uint8Array.length);
      const newArray = new Uint8Array(newBuffer);
      newArray.set(uint8Array);
      return newArray;
    }
  }
  async function handleLoadIfc(message) {
    const { messageId, data } = message;
    const { arrayBuffer, filename } = data;
    try {
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      postProgress(messageId, 60, "Preparing IFC file...");
      const uint8ArrayBuffer = new ArrayBuffer(arrayBuffer.byteLength);
      const uint8ArrayView = new Uint8Array(uint8ArrayBuffer);
      uint8ArrayView.set(new Uint8Array(arrayBuffer));
      postProgress(messageId, 65, "Normalizing IFC schema...");
      const uint8Array = normalizeIfcSchema(uint8ArrayView);
      postProgress(messageId, 70, "Writing file to memory...");
      pyodide.FS.writeFile("model.ifc", uint8Array);
      console.log("handleLoadIfc: File written to filesystem");
      postProgress(messageId, 75, "Opening IFC file with IfcOpenShell...");
      postProgress(messageId, 80, "Discovering element types dynamically...");
      postProgress(messageId, 85, "Analyzing IFC structure...");
      const namespace = pyodide.globals.get("dict")();
      await pyodide.runPythonAsync(
        `
      import ifcopenshell
      import json
      import sys
      import traceback
      import sqlite3
    `,
        { globals: namespace }
      );
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
      );
      const success = namespace.get("success");
      if (!success) {
        const errorMsg = namespace.get("error_msg");
        const errorTrace = namespace.get("error_trace");
        throw new Error(`Python error: ${errorMsg}
${errorTrace}`);
      }
      const result = namespace.get("result_json");
      if (!result) {
        throw new Error("Python execution did not produce a result");
      }
      const modelInfo = JSON.parse(result);
      state.setIfcModelCache({
        filename: modelInfo.filename,
        schema: modelInfo.schema,
        model_id: modelInfo.model_id,
        dbKey: ""
      });
      try {
        if (modelInfo.sqlite_success && modelInfo.sqlite_db) {
          const dbBytes = pyodide.FS.readFile(modelInfo.sqlite_db);
          const idbManager = IndexedDBManager.getInstance();
          const key = `model-sqlite-db:${modelInfo.model_id || modelInfo.filename || "default"}`;
          state.setCurrentSqlKey(key);
          try {
            await idbManager.delete(key);
          } catch (deleteError) {
          }
          await idbManager.put(key, dbBytes);
          try {
            const verifyBytes = await idbManager.get(key);
            if (!verifyBytes || verifyBytes.length !== dbBytes.length) {
              console.warn("SQLite database verification failed");
            }
          } catch (verifyError) {
          }
        }
      } catch (e) {
        console.warn("Failed to persist SQLite database:", e);
      }
      namespace.destroy();
      postProgress(messageId, 100, "File processed successfully!");
      postMessage(__spreadValues({
        type: "loadComplete",
        messageId
      }, modelInfo));
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  async function handleLoadIfcFast(message) {
    const { messageId, data } = message;
    const { arrayBuffer, filename } = data;
    try {
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      const uint8Array = new Uint8Array(arrayBuffer);
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
      );
      postProgress(messageId, 90, "Processing Python results...");
      const ok = ns.get("success");
      if (!ok) {
        const em = ns.get("error_msg") || "Unknown error";
        throw new Error(String(em));
      }
      const result = JSON.parse(ns.get("result_json"));
      ns.destroy();
      postProgress(messageId, 95, `Found ${result.total_elements || 0} elements`);
      const idbManager = IndexedDBManager.getInstance();
      const dbKey = idbManager.computeDbKeyFromBuffer(
        result.model_id || result.filename,
        arrayBuffer
      );
      state.setIfcModelCache({
        filename: result.filename,
        schema: result.schema,
        model_id: result.model_id,
        dbKey
      });
      postProgress(messageId, 100, "IFC file loaded successfully!");
      postMessage(__spreadProps(__spreadValues({
        type: "loadComplete",
        messageId
      }, result), {
        sqlite_db: null,
        sqlite_success: false
      }));
      postMessage({
        type: "sqliteStatus",
        status: "building",
        modelKey: result.model_id || result.filename,
        messageId
      });
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  var init_ifc_loader_handler = __esm({
    "lib/workers/handlers/ifc-loader-handler.ts"() {
      "use strict";
      init_worker_utils();
      init_pyodide_manager();
      init_indexeddb_manager();
      init_state();
    }
  });

  // lib/workers/handlers/data-handler.ts
  var data_handler_exports = {};
  __export(data_handler_exports, {
    handleExtractData: () => handleExtractData,
    handleExtractQuantities: () => handleExtractQuantities
  });
  async function handleExtractData(message) {
    const { messageId, data } = message;
    const { types = ["IfcWall"], arrayBuffer } = data;
    try {
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      postProgress(messageId, 60, "Converting IFC to structured data...");
      if (arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
        pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));
      }
      const namespace = pyodide.globals.get("dict")();
      namespace.set("types_str", JSON.stringify(types));
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
`;
      await pyodide.runPythonAsync(pythonCode, { globals: namespace });
      const success = namespace.get("success");
      if (!success) {
        const errorMsg = namespace.get("error_msg");
        throw new Error(`Python data extraction failed: ${errorMsg}`);
      }
      const resultJson = namespace.get("result_json");
      const elements = JSON.parse(resultJson);
      namespace.destroy();
      postProgress(messageId, 100, "Data extraction complete!");
      postMessage({
        type: "dataExtracted",
        messageId,
        elements
      });
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  async function handleExtractQuantities(message) {
    const { messageId, data } = message;
    const { elementIds = [], quantityType = "area", groupBy = "none", arrayBuffer } = data;
    try {
      postProgress(messageId, 10, "Starting quantity extraction...");
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error("ArrayBuffer for IFC file was not provided or is invalid.");
      }
      try {
        pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));
      } catch (fsError) {
        throw new Error(
          `Failed to prepare IFC file in VFS: ${fsError instanceof Error ? fsError.message : String(fsError)}`
        );
      }
      const namespace = pyodide.globals.get("dict")();
      namespace.set("element_ids_json", JSON.stringify(elementIds));
      namespace.set("quantity_type", quantityType.toLowerCase());
      namespace.set("group_by", groupBy);
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
`;
      const progressUpdater = setInterval(() => {
        try {
          if (namespace.has("progress_info")) {
            const progressInfo = namespace.get("progress_info");
            if (progressInfo) {
              postProgress(
                messageId,
                progressInfo.percentage,
                `Extracted ${progressInfo.processed}/${progressInfo.total} elements...`
              );
            }
          }
        } catch (e) {
        }
      }, 500);
      await pyodide.runPythonAsync(pythonCode, { globals: namespace });
      clearInterval(progressUpdater);
      const success = namespace.get("success");
      if (!success) {
        const errorMsg = namespace.get("error_msg");
        const errorTrace = namespace.get("error_trace");
        throw new Error(`Python error: ${errorMsg}
${errorTrace}`);
      }
      const resultJson = namespace.get("result_json");
      const results = JSON.parse(resultJson);
      namespace.destroy();
      postProgress(messageId, 100, "Quantity extraction complete!");
      postMessage({
        type: "quantityResults",
        messageId,
        data: results
      });
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  var init_data_handler = __esm({
    "lib/workers/handlers/data-handler.ts"() {
      "use strict";
      init_worker_utils();
      init_pyodide_manager();
      init_state();
    }
  });

  // lib/workers/handlers/geometry-handler.ts
  var geometry_handler_exports = {};
  __export(geometry_handler_exports, {
    handleExtractGeometry: () => handleExtractGeometry
  });
  async function handleExtractGeometry(message) {
    const { messageId, data } = message;
    const { elementType = "all", includeOpenings = true, arrayBuffer } = data;
    let mountSuccessful = false;
    let progressUpdater;
    const VFS_PATH = "/data";
    const VFS_FILENAME = "model.ifc";
    const VFS_FULL_PATH = `${VFS_PATH}/${VFS_FILENAME}`;
    try {
      if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error("Valid ArrayBuffer not received in handleExtractGeometry.");
      }
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      try {
        pyodide.FS.mkdirTree(VFS_PATH);
        const uint8Array = new Uint8Array(arrayBuffer);
        pyodide.FS.createDataFile(VFS_PATH, VFS_FILENAME, uint8Array, true, true, true);
        mountSuccessful = true;
      } catch (mountError) {
        throw new Error(
          `Failed to mount IFC data in worker: ${mountError instanceof Error ? mountError.message : String(mountError)}`
        );
      }
      postProgress(messageId, 10, "Preparing geometry extraction...");
      const namespace = pyodide.globals.get("dict")();
      namespace.set("element_type", elementType);
      namespace.set("include_openings", includeOpenings ? true : false);
      namespace.set("vfs_path", VFS_FULL_PATH);
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
      postProgress(messageId, 20, "Loading IFC file...");
      try {
        progressUpdater = setInterval(() => {
          try {
            if (namespace.has("progress_info")) {
              const progressInfo = namespace.get("progress_info");
              if (progressInfo) {
                const percentage = Math.min(40 + Math.floor(progressInfo.percentage * 0.6), 99);
                postProgress(
                  messageId,
                  percentage,
                  `Processing element ${progressInfo.processed}/${progressInfo.total}...`
                );
              }
            }
          } catch (e) {
          }
        }, 500);
        await pyodide.runPythonAsync(pythonCode, { globals: namespace });
        if (progressUpdater) {
          clearInterval(progressUpdater);
          progressUpdater = void 0;
        }
        const success = namespace.get("success");
        if (!success) {
          throw new Error("Geometry extraction failed in Python");
        }
        const resultJson = namespace.get("result_json");
        const elements = JSON.parse(resultJson);
        if (mountSuccessful) {
          try {
            pyodide.FS.unlink(VFS_FULL_PATH);
          } catch (unlinkError) {
          }
        }
        namespace.destroy();
        postProgress(messageId, 100, "Geometry extraction complete!");
        postMessage({
          type: "geometry",
          elements,
          messageId
        });
      } catch (error) {
        if (mountSuccessful) {
          try {
            pyodide.FS.unlink(VFS_FULL_PATH);
          } catch (e) {
          }
        }
        if (progressUpdater) {
          clearInterval(progressUpdater);
          progressUpdater = void 0;
        }
        namespace.destroy();
        throw new Error(`Python geometry extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (mountSuccessful) {
        try {
          const state = WorkerState.getInstance();
          const pyodide = state.getPyodide();
          if (pyodide) pyodide.FS.unlink(VFS_FULL_PATH);
        } catch (e) {
        }
      }
      if (progressUpdater) {
        clearInterval(progressUpdater);
      }
      postError(messageId, new Error(`Geometry extraction failed: ${errorMessage}`));
    }
  }
  var init_geometry_handler = __esm({
    "lib/workers/handlers/geometry-handler.ts"() {
      "use strict";
      init_worker_utils();
      init_pyodide_manager();
      init_state();
    }
  });

  // lib/workers/handlers/export-handler.ts
  var export_handler_exports = {};
  __export(export_handler_exports, {
    handleExportIfc: () => handleExportIfc
  });
  async function handleExportIfc(message) {
    const { messageId, data } = message;
    const { arrayBuffer, filename = "export.ifc", modifications = [] } = data;
    try {
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      postProgress(messageId, 20, "Loading IFC file...");
      const uint8Array = new Uint8Array(arrayBuffer);
      pyodide.FS.writeFile("model.ifc", uint8Array);
      postProgress(messageId, 40, "Applying modifications...");
      const namespace = pyodide.globals.get("dict")();
      namespace.set("modifications_json", JSON.stringify(modifications));
      namespace.set("output_filename", filename);
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
`;
      await pyodide.runPythonAsync(pythonCode, { globals: namespace });
      const success = namespace.get("success");
      if (!success) {
        const errorMsg = namespace.get("error_msg");
        throw new Error(`Python export failed: ${errorMsg}`);
      }
      const resultJson = namespace.get("result_json");
      const result = JSON.parse(resultJson);
      const decodedBytes = Uint8Array.from(atob(result.file_base64), (c) => c.charCodeAt(0));
      namespace.destroy();
      postProgress(messageId, 100, "Export complete!");
      postMessage(
        {
          type: "exportComplete",
          messageId,
          filename: result.filename,
          size: result.size,
          bytes: decodedBytes.buffer
        },
        [decodedBytes.buffer]
      );
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  var init_export_handler = __esm({
    "lib/workers/handlers/export-handler.ts"() {
      "use strict";
      init_worker_utils();
      init_pyodide_manager();
      init_state();
    }
  });

  // lib/workers/handlers/python-handler.ts
  var python_handler_exports = {};
  __export(python_handler_exports, {
    handleRunPython: () => handleRunPython
  });
  async function handleRunPython(message) {
    const { messageId, data } = message;
    const { script, arrayBuffer, inputData, properties } = data;
    try {
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        postProgress(messageId, percentage, msg);
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      let hasIfcFile = false;
      if (arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
        try {
          pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));
          hasIfcFile = true;
        } catch (fsError) {
        }
      }
      const namespace = pyodide.globals.get("dict")();
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
has_ifc_file = ${hasIfcFile ? "True" : "False"}

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
`;
      await pyodide.runPythonAsync(pythonCode, { globals: namespace });
      const success = namespace.get("success");
      if (!success) {
        const errorMsg = namespace.get("error_msg");
        throw new Error(`Python execution failed: ${errorMsg}`);
      }
      const resultJson = namespace.get("result_json");
      const result = JSON.parse(resultJson);
      namespace.destroy();
      postMessage({
        type: "pythonResult",
        result,
        messageId
      });
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  var init_python_handler = __esm({
    "lib/workers/handlers/python-handler.ts"() {
      "use strict";
      init_worker_utils();
      init_pyodide_manager();
      init_state();
    }
  });

  // lib/workers/shared/sqlite-manager.ts
  var _SQLiteManager, SQLiteManager;
  var init_sqlite_manager = __esm({
    "lib/workers/shared/sqlite-manager.ts"() {
      "use strict";
      _SQLiteManager = class _SQLiteManager {
        constructor() {
          this.sqlModule = null;
          this.currentDb = null;
          this.currentKey = null;
        }
        static getInstance() {
          if (!_SQLiteManager.instance) {
            _SQLiteManager.instance = new _SQLiteManager();
          }
          return _SQLiteManager.instance;
        }
        /**
         * Initialize sql.js module
         */
        async initialize() {
          if (this.sqlModule) return this.sqlModule;
          if (typeof initSqlJs === "undefined") {
            throw new Error("initSqlJs is not available. Make sure sql-wasm.js is loaded.");
          }
          this.sqlModule = await initSqlJs({
            locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
          });
          return this.sqlModule;
        }
        /**
         * Get sql.js module
         */
        getModule() {
          if (!this.sqlModule) {
            throw new Error("SQLite module not initialized. Call initialize() first.");
          }
          return this.sqlModule;
        }
        /**
         * Load database from IndexedDB and open in sql.js
         */
        async loadDatabase(key, bytes = null) {
          const sqlModule = await this.initialize();
          if (!bytes) {
            const { IndexedDBManager: IndexedDBManager2 } = await Promise.resolve().then(() => (init_indexeddb_manager(), indexeddb_manager_exports));
            const idbManager = IndexedDBManager2.getInstance();
            bytes = await idbManager.get(key);
          }
          if (!bytes) {
            return null;
          }
          if (this.currentDb && this.currentKey !== key) {
            this.currentDb.close();
            this.currentDb = null;
          }
          this.currentDb = new sqlModule.Database(new Uint8Array(bytes));
          this.currentKey = key;
          return this.currentDb;
        }
        /**
         * Get current database instance
         */
        getCurrentDatabase() {
          return this.currentDb;
        }
        /**
         * Get current database key
         */
        getCurrentKey() {
          return this.currentKey;
        }
        /**
         * Set current database (for external use)
         */
        setCurrentDatabase(db, key) {
          if (this.currentDb && this.currentKey !== key) {
            this.currentDb.close();
          }
          this.currentDb = db;
          this.currentKey = key;
        }
        /**
         * Ensure database is loaded for a given key
         */
        async ensureDbLoaded(key) {
          if (this.currentDb && this.currentKey === key) {
            return this.currentDb;
          }
          return this.loadDatabase(key);
        }
        /**
         * Close current database
         */
        closeCurrentDatabase() {
          if (this.currentDb) {
            this.currentDb.close();
            this.currentDb = null;
            this.currentKey = null;
          }
        }
      };
      _SQLiteManager.instance = null;
      SQLiteManager = _SQLiteManager;
    }
  });

  // lib/workers/handlers/sqlite-handler.ts
  var sqlite_handler_exports = {};
  __export(sqlite_handler_exports, {
    handleBuildSqlite: () => handleBuildSqlite,
    handleSqliteExport: () => handleSqliteExport,
    handleSqliteQuery: () => handleSqliteQuery,
    handleWarmSqlite: () => handleWarmSqlite
  });
  function normalizeSqlQuery(query) {
    let rewritten = String(query || "").trim();
    const isExplicitSql = /^(with|select)\b/i.test(rewritten);
    if (!isExplicitSql) {
      const nl = rewritten.toLowerCase();
      const wantCount = /\bcount\b|how many|number of/.test(nl);
      const wantNames = /\bname\b|\bnames\b|list\b/.test(nl);
      const wantGuids = /\bguid\b|\bifcguid\b|globalid/.test(nl);
      const limitMatch = nl.match(/\b(\d+)\b/) || nl.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
      const wordToNum = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10
      };
      let limit = 10;
      if (limitMatch) {
        const val = limitMatch[1];
        limit = Number(val) || wordToNum[val] || limit;
      }
      const typeMap = [
        ["wall", "Wall"],
        ["slab", "Slab"],
        ["beam", "Beam"],
        ["column", "Column"],
        ["door", "Door"],
        ["window", "Window"],
        ["roof", "Roof"],
        ["stair", "Stair"],
        ["space", "Space"],
        ["furnish", "FurnishingElement"]
      ];
      let cat = "";
      for (const [k, v] of typeMap) {
        if (nl.includes(k)) {
          cat = v;
          break;
        }
      }
      if (wantCount) {
        rewritten = cat ? `SELECT COUNT(*) AS count FROM IfcElement WHERE category='${cat}'` : `SELECT COUNT(*) AS count FROM IfcElement`;
      } else if (wantGuids) {
        rewritten = cat ? `SELECT GlobalId, Name FROM IfcElement WHERE category='${cat}' LIMIT ${limit}` : `SELECT GlobalId, Name FROM IfcElement LIMIT ${limit}`;
      } else if (wantNames || cat) {
        rewritten = cat ? `SELECT DISTINCT Name FROM IfcElement WHERE category='${cat}' AND Name IS NOT NULL LIMIT ${limit}` : `SELECT DISTINCT Name FROM IfcElement WHERE Name IS NOT NULL LIMIT ${limit}`;
      } else {
        rewritten = `SELECT * FROM IfcElement LIMIT ${limit}`;
      }
    }
    rewritten = rewritten.replace(/\bIfcGuid\b/gi, "GlobalId");
    if (!isExplicitSql) {
      rewritten = rewritten.replace(/\bIfcBuildingElementElement\./gi, "IfcElement.").replace(/\bIfcBuildingElement\./gi, "IfcElement.").replace(/\bIfcObject\./gi, "IfcElement.");
      rewritten = rewritten.replace(/\bFROM\s+elements\s+AS\s+IfcElement\b/gi, "FROM IfcElement AS IfcElement").replace(/\bFROM\s+elements\b/gi, "FROM IfcElement").replace(/\bJOIN\s+elements\b/gi, "JOIN IfcElement").replace(/\bIfcElement\.element_type\b/gi, "IfcElement.type").replace(/\belement_type\b/gi, "type").replace(/\bIfcType\b/gi, "type");
      rewritten = rewritten.replace(/\btype\s*=\s*'([A-Za-z]+)'/gi, (m, val) => {
        if (/^Ifc/i.test(val)) return m;
        return `category='${val}'`;
      });
      rewritten = rewritten.replace(/\btype\s+IN\s*\(([^\)]+)\)/gi, (m, list) => `category IN (${list})`);
      rewritten = rewritten.replace(/LOWER\(\s*type\s*\)/gi, "LOWER(category)");
    }
    return rewritten;
  }
  async function handleSqliteQuery(message) {
    const { messageId, data } = message;
    const { query, modelId } = data;
    try {
      const sqliteManager = SQLiteManager.getInstance();
      await sqliteManager.initialize();
      const state = WorkerState.getInstance();
      const preferredKey = state.getCurrentSqlKey() || (modelId ? `model-sqlite-db:${modelId}` : "model-sqlite-db");
      const db = await sqliteManager.ensureDbLoaded(preferredKey);
      if (!db) {
        throw new Error("SQLite database is not available in sql.js");
      }
      const normalizedQuery = normalizeSqlQuery(query);
      const result = db.exec(normalizedQuery);
      let rows = [];
      if (Array.isArray(result) && result.length > 0) {
        const r = result[0];
        const cols = r.columns || [];
        rows = (r.values || []).map((arr) => {
          const obj = {};
          cols.forEach((c, i) => {
            obj[c] = arr[i];
          });
          return obj;
        });
      }
      postMessage({
        type: "sqliteResult",
        messageId,
        result: rows,
        query: normalizedQuery
      });
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  async function handleSqliteExport(message) {
    const { messageId, data } = message;
    const { modelId } = data;
    try {
      const state = WorkerState.getInstance();
      const preferredKey = state.getCurrentSqlKey() || (modelId ? `model-sqlite-db:${modelId}` : "model-sqlite-db");
      const idbManager = IndexedDBManager.getInstance();
      const comprehensiveDbBytes = await idbManager.get(preferredKey);
      if (!comprehensiveDbBytes) {
        throw new Error(
          "No comprehensive database found in IndexedDB. The IFC file needs to be reloaded."
        );
      }
      try {
        const sqliteManager = SQLiteManager.getInstance();
        await sqliteManager.initialize();
        const sqlModule = sqliteManager.getModule();
        const tempDb = new sqlModule.Database(new Uint8Array(comprehensiveDbBytes));
        const result = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
        const tableCount = result.length > 0 ? result[0].values.length : 0;
        tempDb.close();
      } catch (analysisError) {
      }
      postMessage(
        {
          type: "sqliteExport",
          messageId,
          bytes: comprehensiveDbBytes
        },
        [comprehensiveDbBytes.buffer]
      );
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  async function handleWarmSqlite(message) {
    var _a;
    const { messageId, data } = message;
    const { modelKey } = data;
    try {
      const sqliteManager = SQLiteManager.getInstance();
      await sqliteManager.initialize();
      const state = WorkerState.getInstance();
      const cache = state.getIfcModelCache();
      const preferredKey = (cache == null ? void 0 : cache.dbKey) || state.getCurrentSqlKey() || (modelKey ? `model-sqlite-db:${modelKey}` : null);
      if (!preferredKey) {
        throw new Error("No SQLite database key available to warm");
      }
      const idbManager = IndexedDBManager.getInstance();
      let bytes = await idbManager.get(preferredKey);
      if (!bytes) {
        postMessage({
          type: "sqliteStatus",
          status: "building",
          modelKey: modelKey || "",
          messageId
        });
        try {
          const { handleBuildSqlite: handleBuildSqlite2 } = await Promise.resolve().then(() => (init_sqlite_handler(), sqlite_handler_exports));
          await handleBuildSqlite2({
            action: "buildSqlite",
            messageId: messageId || "",
            // Use empty string if no messageId
            data: { modelKey, dbKey: cache == null ? void 0 : cache.dbKey }
          });
        } catch (e) {
          throw e;
        }
        bytes = await idbManager.get(preferredKey);
      }
      if (!bytes) {
        throw new Error("No SQLite bytes found in IndexedDB to load");
      }
      const db = await sqliteManager.loadDatabase(preferredKey, bytes);
      if (db) {
        state.setSqliteDb(db);
        state.setCurrentSqlKey(preferredKey);
      }
      let tableCount = 0;
      try {
        if (db) {
          const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
          tableCount = res.length > 0 ? ((_a = res[0].values) == null ? void 0 : _a.length) || 0 : 0;
        }
      } catch (e) {
      }
      postMessage({
        type: "sqliteWarmed",
        messageId,
        key: preferredKey,
        tableCount
      });
    } catch (error) {
      postError(messageId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  async function handleBuildSqlite(message) {
    const { messageId, data } = message;
    const { modelKey, dbKey } = data;
    try {
      const pyodideManager = PyodideManager.getInstance();
      const progressCallback = (percentage, msg) => {
        if (messageId) {
          postProgress(messageId, percentage, msg);
        }
      };
      const ensureIfc2sqlPyCode = async () => {
        try {
          const res = await fetch("/ifc2sql.py");
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return await res.text();
        } catch (e) {
          console.warn("Failed to load ifc2sql.py:", e);
          return null;
        }
      };
      const pyodide = await pyodideManager.initialize(progressCallback, ensureIfc2sqlPyCode);
      const state = WorkerState.getInstance();
      state.setPyodide(pyodide);
      if (messageId) {
        postMessage({
          type: "sqliteStatus",
          status: "building",
          modelKey: modelKey || "",
          messageId
        });
      }
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
    import ifcopenshell.ifcpatch
    cfg = {
      'input': 'model.ifc',
      'file': None,
      'recipe': 'Ifc2Sql',
      'arguments': {
        'sqlite_path': db_path,
        'full_schema': True,
        'should_get_psets': True,
        'should_get_inverses': True,
        'should_get_geometry': False,
        'should_skip_geometry_data': True
      }
    }
    ifcopenshell.ifcpatch.execute(cfg)
    success = os.path.exists(db_path)
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
  # Minimal metadata only
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
      if (!pyRes.success) {
        throw new Error(pyRes.error || "SQLite build failed");
      }
      const dbBytes = pyodide.FS.readFile(pyRes.db_path);
      const cache = state.getIfcModelCache();
      const effectiveKey = dbKey || (cache == null ? void 0 : cache.dbKey) || `model-sqlite-db:${modelKey || (cache == null ? void 0 : cache.model_id) || (cache == null ? void 0 : cache.filename) || "default"}`;
      state.setCurrentSqlKey(effectiveKey);
      const idbManager = IndexedDBManager.getInstance();
      try {
        await idbManager.delete(effectiveKey);
      } catch (e) {
      }
      await idbManager.put(effectiveKey, dbBytes);
      if (messageId) {
        postMessage({
          type: "sqliteStatus",
          status: "ready",
          modelKey: modelKey || "",
          tableCount: pyRes.table_count,
          messageId
        });
        postMessage({
          type: "sqliteBuilt",
          key: effectiveKey,
          tableCount: pyRes.table_count,
          byteLength: dbBytes.length,
          messageId
        });
      }
    } catch (error) {
      if (messageId) {
        postMessage({
          type: "sqliteStatus",
          status: "error",
          modelKey: modelKey || "",
          message: error instanceof Error ? error.message : String(error),
          messageId
        });
        postError(messageId, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
  var init_sqlite_handler = __esm({
    "lib/workers/handlers/sqlite-handler.ts"() {
      "use strict";
      init_worker_utils();
      init_sqlite_manager();
      init_indexeddb_manager();
      init_pyodide_manager();
      init_state();
    }
  });

  // lib/workers/core/router.ts
  init_worker_utils();
  var handlerRegistry = /* @__PURE__ */ new Map();
  var handlerCache = /* @__PURE__ */ new Map();
  function registerHandler(action, factory) {
    handlerRegistry.set(action, factory);
  }
  async function getHandler(action) {
    if (handlerCache.has(action)) {
      return handlerCache.get(action);
    }
    const factory = handlerRegistry.get(action);
    if (factory) {
      try {
        const handler = await factory();
        handlerCache.set(action, handler);
        return handler;
      } catch (error) {
        console.error(`Failed to load handler for action "${action}":`, error);
        return null;
      }
    }
    return null;
  }
  async function routeMessage(message) {
    try {
      const handler = await getHandler(message.action);
      if (handler) {
        await handler(message);
      } else {
        throw new Error(`No handler registered for action: ${message.action}`);
      }
    } catch (error) {
      postError(
        message.messageId,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  async function initializeHandlers() {
    registerHandler("init", async () => {
      const { handleInit: handleInit2 } = await Promise.resolve().then(() => (init_init_handler(), init_handler_exports));
      return handleInit2;
    });
    registerHandler("loadIfc", async () => {
      const { handleLoadIfc: handleLoadIfc2 } = await Promise.resolve().then(() => (init_ifc_loader_handler(), ifc_loader_handler_exports));
      return handleLoadIfc2;
    });
    registerHandler("loadIfcFast", async () => {
      const { handleLoadIfcFast: handleLoadIfcFast2 } = await Promise.resolve().then(() => (init_ifc_loader_handler(), ifc_loader_handler_exports));
      return handleLoadIfcFast2;
    });
    registerHandler("extractData", async () => {
      const { handleExtractData: handleExtractData2 } = await Promise.resolve().then(() => (init_data_handler(), data_handler_exports));
      return handleExtractData2;
    });
    registerHandler("extractQuantities", async () => {
      const { handleExtractQuantities: handleExtractQuantities2 } = await Promise.resolve().then(() => (init_data_handler(), data_handler_exports));
      return handleExtractQuantities2;
    });
    registerHandler("extractGeometry", async () => {
      const { handleExtractGeometry: handleExtractGeometry2 } = await Promise.resolve().then(() => (init_geometry_handler(), geometry_handler_exports));
      return handleExtractGeometry2;
    });
    registerHandler("exportIfc", async () => {
      const { handleExportIfc: handleExportIfc2 } = await Promise.resolve().then(() => (init_export_handler(), export_handler_exports));
      return handleExportIfc2;
    });
    registerHandler("runPython", async () => {
      const { handleRunPython: handleRunPython2 } = await Promise.resolve().then(() => (init_python_handler(), python_handler_exports));
      return handleRunPython2;
    });
    registerHandler("querySqlite", async () => {
      const { handleSqliteQuery: handleSqliteQuery2 } = await Promise.resolve().then(() => (init_sqlite_handler(), sqlite_handler_exports));
      return handleSqliteQuery2;
    });
    registerHandler("exportSqlite", async () => {
      const { handleSqliteExport: handleSqliteExport2 } = await Promise.resolve().then(() => (init_sqlite_handler(), sqlite_handler_exports));
      return handleSqliteExport2;
    });
    registerHandler("warmSqlite", async () => {
      const { handleWarmSqlite: handleWarmSqlite2 } = await Promise.resolve().then(() => (init_sqlite_handler(), sqlite_handler_exports));
      return handleWarmSqlite2;
    });
    registerHandler("buildSqlite", async () => {
      const { handleBuildSqlite: handleBuildSqlite2 } = await Promise.resolve().then(() => (init_sqlite_handler(), sqlite_handler_exports));
      return handleBuildSqlite2;
    });
    console.log("Worker handlers registered successfully");
  }

  // lib/workers/core/worker-main.ts
  var handlersInitialized = false;
  async function ensureHandlersInitialized() {
    if (!handlersInitialized) {
      await initializeHandlers();
      handlersInitialized = true;
    }
  }
  self.onmessage = async (event) => {
    var _a;
    try {
      await ensureHandlersInitialized();
      await routeMessage(event.data);
    } catch (error) {
      self.postMessage({
        type: "error",
        messageId: ((_a = event.data) == null ? void 0 : _a.messageId) || "unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : void 0
      });
    }
  };
  ensureHandlersInitialized().catch((error) => {
    console.error("Failed to initialize worker handlers:", error);
  });
})();
