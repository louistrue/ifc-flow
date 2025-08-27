"use strict";var IfcWorkerBundle=(()=>{importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");importScripts("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js");try{importScripts("/ifcWorker.legacy.js")}catch{}var t=null;var n=!1;var a=null;async function r(){if(a)return a;try{let e=await fetch("/ifc2sql.py");if(!e.ok)throw new Error(`HTTP ${e.status} ${e.statusText}`);return a=await e.text(),a}catch(e){return console.warn("Failed to load ifc2sql.py from /public:",e),a=null,null}}async function o(){if(t!==null)return t;self.postMessage({type:"progress",message:"Loading Pyodide...",percentage:5});try{t=await self.loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"}),self.postMessage({type:"progress",message:"Installing required packages...",percentage:30}),await t.loadPackage(["micropip","numpy","typing-extensions"]),await t.runPythonAsync(`
import micropip
from micropip._micropip import WheelInfo
WheelInfo.check_compatible = lambda self: None
`),self.postMessage({type:"progress",message:"Installing IfcOpenShell 0.8.1...",percentage:50}),await t.runPythonAsync(`
import micropip
await micropip.install('lark')
await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@33b437e5fd5425e606f34aff602c42034ff5e6dc/ifcopenshell-0.8.1+latest-cp312-cp312-emscripten_3_1_58_wasm32.whl')
`);try{await t.loadPackage(["sqlite3"]),await t.runPythonAsync(`import sqlite3
print('sqlite3 available')`),n=!0}catch{n=!1,console.warn("Python sqlite3 not available in Pyodide, using sql.js path")}self.postMessage({type:"progress",message:"Loading shapely...",percentage:62});try{await t.loadPackage(["shapely"]),await t.runPythonAsync(`import shapely
print('shapely available')`)}catch(s){console.warn("Failed to load shapely package:",s)}await t.runPythonAsync(`
import ifcopenshell, ifcopenshell.sql, json
sqlite_databases = {}
`);try{await t.runPythonAsync(`
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
`)}catch{}let e=await r();if(e){let s=btoa(unescape(encodeURIComponent(e)));await t.runPythonAsync(`
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
src = base64.b64decode('${s}').decode('utf-8')
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
`)}return self.postMessage({type:"progress",message:"IfcOpenShell loaded successfully",percentage:100}),t}catch(e){throw self.postMessage({type:"error",message:`Failed to load Pyodide: ${e.message}`,stack:e.stack}),e}}self.onmessage=async e=>{try{let{action:s,data:l,messageId:i}=e.data||{};if((self.__IFC_LEGACY_READY__||typeof self.__IFC_HANDLE_MESSAGE__=="function")&&typeof self.__IFC_HANDLE_MESSAGE__=="function")return self.__IFC_HANDLE_MESSAGE__(e);switch(s){case"init":await o(),self.postMessage({type:"initialized",messageId:i});break;default:throw new Error(`Worker not yet migrated: action ${s} is temporarily unavailable`)}}catch(s){self.postMessage({type:"error",message:s.message,stack:s.stack,messageId:(e.data||{}).messageId})}};})();
//# sourceMappingURL=index.global.js.map