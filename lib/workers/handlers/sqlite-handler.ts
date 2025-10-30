/**
 * SQLite Handler
 * Handles SQLite database operations: query, export, warm, build
 */

import type { BaseWorkerMessage } from '../worker-types'
import { postError, postProgress, postMessage } from '../worker-utils'
import { SQLiteManager } from '../shared/sqlite-manager'
import { IndexedDBManager } from '../shared/indexeddb-manager'
import { PyodideManager } from '../shared/pyodide-manager'
import { WorkerState } from '../core/state'

interface SqliteQueryMessage extends BaseWorkerMessage {
  action: 'querySqlite'
  data: {
    query: string
    modelId?: string
  }
}

interface SqliteExportMessage extends BaseWorkerMessage {
  action: 'exportSqlite'
  data: {
    modelId?: string
  }
}

interface WarmSqliteMessage extends BaseWorkerMessage {
  action: 'warmSqlite'
  data: {
    modelKey?: string
  }
}

interface BuildSqliteMessage extends BaseWorkerMessage {
  action: 'buildSqlite'
  data: {
    modelKey?: string
    dbKey?: string
  }
}

/**
 * Normalize SQL query - translate natural language to SQL and normalize column/table names
 */
function normalizeSqlQuery(query: string): string {
  let rewritten = String(query || '').trim()

  // Check if it's already valid SQL
  const isExplicitSql = /^(with|select)\b/i.test(rewritten)

  if (!isExplicitSql) {
    // Natural language translation
    const nl = rewritten.toLowerCase()
    const wantCount = /\bcount\b|how many|number of/.test(nl)
    const wantNames = /\bname\b|\bnames\b|list\b/.test(nl)
    const wantGuids = /\bguid\b|\bifcguid\b|globalid/.test(nl)
    const limitMatch =
      nl.match(/\b(\d+)\b/) || nl.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/)
    const wordToNum: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    }
    let limit = 10
    if (limitMatch) {
      const val = limitMatch[1]
      limit = Number(val) || wordToNum[val] || limit
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
      ['furnish', 'FurnishingElement'],
    ]
    let cat = ''
    for (const [k, v] of typeMap) {
      if (nl.includes(k)) {
        cat = v
        break
      }
    }

    if (wantCount) {
      rewritten = cat
        ? `SELECT COUNT(*) AS count FROM IfcElement WHERE category='${cat}'`
        : `SELECT COUNT(*) AS count FROM IfcElement`
    } else if (wantGuids) {
      rewritten = cat
        ? `SELECT GlobalId, Name FROM IfcElement WHERE category='${cat}' LIMIT ${limit}`
        : `SELECT GlobalId, Name FROM IfcElement LIMIT ${limit}`
    } else if (wantNames || cat) {
      rewritten = cat
        ? `SELECT DISTINCT Name FROM IfcElement WHERE category='${cat}' AND Name IS NOT NULL LIMIT ${limit}`
        : `SELECT DISTINCT Name FROM IfcElement WHERE Name IS NOT NULL LIMIT ${limit}`
    } else {
      rewritten = `SELECT * FROM IfcElement LIMIT ${limit}`
    }
  }

  // Column normalizations
  rewritten = rewritten.replace(/\bIfcGuid\b/gi, 'GlobalId')

  if (!isExplicitSql) {
    // Legacy table/alias prefixes
    rewritten = rewritten
      .replace(/\bIfcBuildingElementElement\./gi, 'IfcElement.')
      .replace(/\bIfcBuildingElement\./gi, 'IfcElement.')
      .replace(/\bIfcObject\./gi, 'IfcElement.')

    // Table/view normalizations
    rewritten = rewritten
      .replace(/\bFROM\s+elements\s+AS\s+IfcElement\b/gi, 'FROM IfcElement AS IfcElement')
      .replace(/\bFROM\s+elements\b/gi, 'FROM IfcElement')
      .replace(/\bJOIN\s+elements\b/gi, 'JOIN IfcElement')
      .replace(/\bIfcElement\.element_type\b/gi, 'IfcElement.type')
      .replace(/\belement_type\b/gi, 'type')
      .replace(/\bIfcType\b/gi, 'type')

    // Type to category normalization
    rewritten = rewritten.replace(/\btype\s*=\s*'([A-Za-z]+)'/gi, (m, val) => {
      if (/^Ifc/i.test(val)) return m
      return `category='${val}'`
    })
    rewritten = rewritten.replace(/\btype\s+IN\s*\(([^\)]+)\)/gi, (m, list) => `category IN (${list})`)
    rewritten = rewritten.replace(/LOWER\(\s*type\s*\)/gi, 'LOWER(category)')
  }

  return rewritten
}

/**
 * Handle SQLite query
 */
export async function handleSqliteQuery(message: SqliteQueryMessage): Promise<void> {
  const { messageId, data } = message
  const { query, modelId } = data

  try {
    const sqliteManager = SQLiteManager.getInstance()
    await sqliteManager.initialize()

    const state = WorkerState.getInstance()
    const preferredKey =
      state.getCurrentSqlKey() || (modelId ? `model-sqlite-db:${modelId}` : 'model-sqlite-db')

    const db = await sqliteManager.ensureDbLoaded(preferredKey)
    if (!db) {
      throw new Error('SQLite database is not available in sql.js')
    }

    // Normalize query
    const normalizedQuery = normalizeSqlQuery(query)

    // Execute query
    const result = db.exec(normalizedQuery)

    // Convert result to array of objects
    let rows: any[] = []
    if (Array.isArray(result) && result.length > 0) {
      const r = result[0]
      const cols = r.columns || []
      rows = (r.values || []).map((arr: any[]) => {
        const obj: any = {}
        cols.forEach((c: string, i: number) => {
          obj[c] = arr[i]
        })
        return obj
      })
    }

    postMessage({
      type: 'sqliteResult',
      messageId,
      result: rows,
      query: normalizedQuery,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Handle SQLite export
 */
export async function handleSqliteExport(message: SqliteExportMessage): Promise<void> {
  const { messageId, data } = message
  const { modelId } = data

  try {
    const state = WorkerState.getInstance()
    const preferredKey =
      state.getCurrentSqlKey() || (modelId ? `model-sqlite-db:${modelId}` : 'model-sqlite-db')

    const idbManager = IndexedDBManager.getInstance()
    const comprehensiveDbBytes = await idbManager.get(preferredKey)

    if (!comprehensiveDbBytes) {
      throw new Error(
        'No comprehensive database found in IndexedDB. The IFC file needs to be reloaded.'
      )
    }

    // Quick analysis of the comprehensive database
    try {
      const sqliteManager = SQLiteManager.getInstance()
      await sqliteManager.initialize()
      const sqlModule = sqliteManager.getModule()
      const tempDb = new sqlModule.Database(new Uint8Array(comprehensiveDbBytes))
      const result = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table'")
      const tableCount = result.length > 0 ? result[0].values.length : 0
      tempDb.close()
    } catch (analysisError) {
      // Ignore analysis errors
    }

    postMessage(
      {
        type: 'sqliteExport',
        messageId,
        bytes: comprehensiveDbBytes,
      },
      [comprehensiveDbBytes.buffer]
    )
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Handle SQLite warm (load database into sql.js)
 */
export async function handleWarmSqlite(message: WarmSqliteMessage): Promise<void> {
  const { messageId, data } = message
  const { modelKey } = data

  try {
    const sqliteManager = SQLiteManager.getInstance()
    await sqliteManager.initialize()

    const state = WorkerState.getInstance()
    const cache = state.getIfcModelCache()
    const preferredKey =
      cache?.dbKey ||
      state.getCurrentSqlKey() ||
      (modelKey ? `model-sqlite-db:${modelKey}` : null)

    if (!preferredKey) {
      throw new Error('No SQLite database key available to warm')
    }

    const idbManager = IndexedDBManager.getInstance()
    let bytes = await idbManager.get(preferredKey)

    // If no bytes exist yet, build the DB now (deferred build path)
    if (!bytes) {
      postMessage({
        type: 'sqliteStatus',
        status: 'building',
        modelKey: modelKey || '',
        messageId,
      })

      // Try to build SQLite database
      try {
        // Import build handler dynamically to avoid circular dependency
        const { handleBuildSqlite } = await import('./sqlite-handler')
        await handleBuildSqlite({
          action: 'buildSqlite',
          messageId: messageId || '', // Use empty string if no messageId
          data: { modelKey, dbKey: cache?.dbKey },
        } as BuildSqliteMessage)
      } catch (e) {
        throw e
      }

      bytes = await idbManager.get(preferredKey)
    }

    if (!bytes) {
      throw new Error('No SQLite bytes found in IndexedDB to load')
    }

    // Load into sql.js
    const db = await sqliteManager.loadDatabase(preferredKey, bytes)
    if (db) {
      state.setSqliteDb(db)
      state.setCurrentSqlKey(preferredKey)
    }

    let tableCount = 0
    try {
      if (db) {
        const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
        tableCount = res.length > 0 ? (res[0].values?.length || 0) : 0
      }
    } catch (e) {
      // Ignore table count errors
    }

    postMessage({
      type: 'sqliteWarmed',
      messageId,
      key: preferredKey,
      tableCount,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Handle SQLite build (create database from IFC file)
 */
export async function handleBuildSqlite(message: BuildSqliteMessage): Promise<void> {
  const { messageId, data } = message
  const { modelKey, dbKey } = data

  try {
    const pyodideManager = PyodideManager.getInstance()
    const progressCallback = (percentage: number, msg: string) => {
      if (messageId) {
        postProgress(messageId, percentage, msg)
      }
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

    if (messageId) {
      postMessage({
        type: 'sqliteStatus',
        status: 'building',
        modelKey: modelKey || '',
        messageId,
      })
    }

    const ns = pyodide.globals.get('dict')()

    // Build SQLite database using ifc2sql
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
    )

    const pyRes = JSON.parse(ns.get('result'))
    ns.destroy()

    if (!pyRes.success) {
      throw new Error(pyRes.error || 'SQLite build failed')
    }

    // Read database bytes and persist to IndexedDB
    const dbBytes = pyodide.FS.readFile(pyRes.db_path)
    const cache = state.getIfcModelCache()
    const effectiveKey =
      dbKey ||
      cache?.dbKey ||
      `model-sqlite-db:${modelKey || cache?.model_id || cache?.filename || 'default'}`
    state.setCurrentSqlKey(effectiveKey)

    const idbManager = IndexedDBManager.getInstance()
    try {
      await idbManager.delete(effectiveKey)
    } catch {
      // Ignore delete errors
    }
    await idbManager.put(effectiveKey, dbBytes)

    if (messageId) {
      postMessage({
        type: 'sqliteStatus',
        status: 'ready',
        modelKey: modelKey || '',
        tableCount: pyRes.table_count,
        messageId,
      })

      postMessage({
        type: 'sqliteBuilt',
        key: effectiveKey,
        tableCount: pyRes.table_count,
        byteLength: dbBytes.length,
        messageId,
      })
    }
  } catch (error) {
    if (messageId) {
      postMessage({
        type: 'sqliteStatus',
        status: 'error',
        modelKey: modelKey || '',
        message: error instanceof Error ? error.message : String(error),
        messageId,
      })

      postError(messageId, error instanceof Error ? error : new Error(String(error)))
    }
  }
}
