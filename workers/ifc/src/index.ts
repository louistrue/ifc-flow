/* global importScripts */

// Keep CDN imports identical to the legacy worker for behavior parity
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");
importScripts("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js");
// Temporarily import the full legacy implementation to preserve all actions while we migrate
// This keeps public API and behavior identical while we incrementally port to TypeScript.
try {
  importScripts('/ifcWorker.legacy.js');
} catch (e) {
  // If legacy file is missing, we will fall back to the TS scaffold below
}

// Shared singletons in worker global scope
let pyodide: any = null;
let ifcModelCache: any = null;
let pySqliteReady = false;

let SQLModule: any = null;
let sqliteDb: any = null;
let currentSqlKey: string | null = null;

// Cache ifc2sql.py source
let ifc2sqlPyCodeCache: string | null = null;
async function ensureIfc2sqlPyCode(): Promise<string | null> {
  if (ifc2sqlPyCodeCache) return ifc2sqlPyCodeCache;
  try {
    const res = await fetch('/ifc2sql.py');
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    ifc2sqlPyCodeCache = await res.text();
    return ifc2sqlPyCodeCache;
  } catch (e) {
    console.warn('Failed to load ifc2sql.py from /public:', e);
    ifc2sqlPyCodeCache = null;
    return null;
  }
}

async function initSqlJsModule() {
  if (SQLModule) return SQLModule;
  // initSqlJs is exposed by sql-wasm.js
  // @ts-ignore
  SQLModule = await (self as any).initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
  });
  return SQLModule;
}

// IndexedDB helpers
const IDB_NAME = 'ifc-sql-db';
const IDB_STORE = 'sqlite';

function idbOpen(): Promise<IDBDatabase> {
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

async function idbPut(key: string, bytes: Uint8Array | ArrayBuffer) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    // Normalize to ArrayBuffer
    // @ts-ignore
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
    tx.objectStore(IDB_STORE).put(buf, key);
  });
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { const v = req.result || null; db.close(); resolve(v); };
    req.onerror = () => { const e = req.error; db.close(); reject(e); };
  });
}

async function idbDelete(key: string) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { const e = req.error; db.close(); reject(e); };
  });
}

async function ensureDbLoaded(key: string) {
  if (sqliteDb) return sqliteDb;
  await initSqlJsModule();
  const bytes = await idbGet(key);
  if (bytes) {
    // @ts-ignore
    sqliteDb = new SQLModule.Database(new Uint8Array(bytes));
    currentSqlKey = key;
    return sqliteDb;
  }
  return null;
}

async function initPyodide() {
  if (pyodide !== null) return pyodide;

  (self as any).postMessage({ type: 'progress', message: 'Loading Pyodide...', percentage: 5 });

  try {
    // @ts-ignore loadPyodide injected by pyodide.js
    pyodide = await (self as any).loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });

    (self as any).postMessage({ type: 'progress', message: 'Installing required packages...', percentage: 30 });

    await pyodide.loadPackage(["micropip", "numpy", "typing-extensions"]);

    await pyodide.runPythonAsync(`
import micropip
from micropip._micropip import WheelInfo
WheelInfo.check_compatible = lambda self: None
`);

    (self as any).postMessage({ type: 'progress', message: 'Installing IfcOpenShell 0.8.1...', percentage: 50 });

    await pyodide.runPythonAsync(`
import micropip
await micropip.install('lark')
await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@33b437e5fd5425e606f34aff602c42034ff5e6dc/ifcopenshell-0.8.1+latest-cp312-cp312-emscripten_3_1_58_wasm32.whl')
`);

    try {
      await pyodide.loadPackage(["sqlite3"]);
      await pyodide.runPythonAsync(`import sqlite3\nprint('sqlite3 available')`);
      pySqliteReady = true;
    } catch {
      pySqliteReady = false;
      console.warn('Python sqlite3 not available in Pyodide, using sql.js path');
    }

    (self as any).postMessage({ type: 'progress', message: 'Loading shapely...', percentage: 62 });
    try {
      await pyodide.loadPackage(["shapely"]);
      await pyodide.runPythonAsync(`import shapely\nprint('shapely available')`);
    } catch (e) {
      console.warn('Failed to load shapely package:', e);
    }

    await pyodide.runPythonAsync(`
import ifcopenshell, ifcopenshell.sql, json
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
try:
    await micropip.install(['numpy', 'shapely'], keep_going=True)
    print('Additional dependencies installed')
except Exception as e:
    print('Additional dependencies install warning:', e)
try:
    await micropip.install(['ifcopenshell'], keep_going=True)
    print('ifcopenshell installed for ifc2sql.py')
except Exception as e:
    print('ifcopenshell install warning:', e)
`);
    } catch {}

    const ifc2sqlText = await ensureIfc2sqlPyCode();
    if (ifc2sqlText) {
      const encoded = btoa(unescape(encodeURIComponent(ifc2sqlText)));
      await pyodide.runPythonAsync(`
import base64, sys, importlib, types
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
src = base64.b64decode('${encoded}').decode('utf-8')
ifc2sql_module = types.ModuleType('ifc2sql')
sys.modules['ifc2sql'] = ifc2sql_module
try:
    exec(src, ifc2sql_module.__dict__)
    Patcher = getattr(ifc2sql_module, 'Patcher', None)
    print('official ifc2sql.py loaded successfully:', bool(Patcher))
    if Patcher:
        globals()['Patcher'] = Patcher
except Exception as e:
    print('Error loading ifc2sql.py:', e)
`);
    }

    (self as any).postMessage({ type: 'progress', message: 'IfcOpenShell loaded successfully', percentage: 100 });
    return pyodide;
  } catch (error: any) {
    (self as any).postMessage({ type: 'error', message: `Failed to load Pyodide: ${error.message}`, stack: error.stack });
    throw error;
  }
}

// Handlers: inline minimal wrappers that defer to the legacy logic ported verbatim
// For maintainability in this step, we keep them in this single file.
// The body implementations are copied from the existing public/ifcWorker.js.

// We will paste the original functions below via a direct copy to preserve behavior.
// To keep this edit small, we import nothing else and rely on globals.

// Paste of original functions will be large; for this first commit, we only wire router
// and leave a fallback error to ensure build/test works before full port. We'll replace
// with full implementations next commit in this session.

(self as any).onmessage = async (event: MessageEvent) => {
  try {
    const { action, data, messageId } = (event.data || {}) as { action: string; data?: any; messageId?: string };
    // If the legacy worker registered its own onmessage, it might have overwritten this handler.
    // We detect that by checking for a special symbol; if present, delegate to legacy handler by reposting.
    const hasLegacy = (self as any).__IFC_LEGACY_READY__ || typeof (self as any).__IFC_HANDLE_MESSAGE__ === 'function';
    if (hasLegacy && typeof (self as any).__IFC_HANDLE_MESSAGE__ === 'function') {
      return (self as any).__IFC_HANDLE_MESSAGE__(event);
    }

    // Minimal TS fallback for init only, to avoid breaking during build-before-legacy-load
    switch (action) {
      case 'init':
        await initPyodide();
        (self as any).postMessage({ type: 'initialized', messageId });
        break;
      default:
        throw new Error(`Worker not yet migrated: action ${action} is temporarily unavailable`);
    }
  } catch (error: any) {
    (self as any).postMessage({ type: 'error', message: error.message, stack: error.stack, messageId: (event.data || {}).messageId });
  }
};