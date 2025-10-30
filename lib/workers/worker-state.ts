/**
 * Shared state and initialization for worker handlers
 * This module manages Pyodide, SQLite, and shared caches
 */

// These will be initialized by handlers
export let pyodide: any = null
export let ifcModelCache: any = null
export let pySqliteReady = false
export let SQLModule: any = null
export let sqliteDb: any = null
export let currentSqlKey: string | null = null
export let ifc2sqlPyCodeCache: string | null = null

// Initialize Pyodide (extracted from ifcWorker.js)
export async function initPyodide(): Promise<any> {
  if (pyodide !== null) {
    return pyodide
  }

  // This will be implemented in the handler, but we need the interface
  throw new Error('Pyodide initialization should be handled by init handler')
}

// Initialize SQL.js module
export async function initSqlJsModule(): Promise<any> {
  if (SQLModule) return SQLModule
  
  // @ts-ignore - initSqlJs is global from sql-wasm.js
  SQLModule = await initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
  })
  return SQLModule
}

// Ensure database is loaded
export async function ensureDbLoaded(key: string): Promise<any> {
  if (sqliteDb) return sqliteDb
  await initSqlJsModule()
  const { idbGet } = await import('./worker-utils')
  const bytes = await idbGet(key)
  if (bytes) {
    sqliteDb = new SQLModule.Database(new Uint8Array(bytes))
    currentSqlKey = key
    return sqliteDb
  }
  return null
}

// Ensure ifc2sql.py code is cached
export async function ensureIfc2sqlPyCode(): Promise<string | null> {
  if (ifc2sqlPyCodeCache) return ifc2sqlPyCodeCache
  try {
    const res = await fetch('/ifc2sql.py')
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    ifc2sqlPyCodeCache = await res.text()
    return ifc2sqlPyCodeCache
  } catch (e) {
    ifc2sqlPyCodeCache = null
    return null
  }
}

// Post SQLite status to main thread
export function postSqliteStatus(status: string, modelKey: string, extra?: any) {
  try {
    self.postMessage({
      type: 'sqliteStatus',
      status,
      modelKey,
      ...extra,
    })
  } catch (e) {
    // Ignore errors in worker context
  }
}

