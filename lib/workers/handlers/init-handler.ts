/**
 * Init Handler
 * Handles worker initialization - Pyodide setup and database cleanup
 */

import type { BaseWorkerMessage } from '../worker-types'
import { postError, postProgress, postMessage } from '../worker-utils'
import { PyodideManager } from '../shared/pyodide-manager'
import { IndexedDBManager } from '../shared/indexeddb-manager'
import { WorkerState } from '../core/state'

export async function handleInit(message: BaseWorkerMessage): Promise<void> {
  const { messageId } = message

  try {
    postProgress(messageId, 5, 'Initializing worker...')

    // Initialize Pyodide
    const pyodideManager = PyodideManager.getInstance()
    const progressCallback = (percentage: number, msg: string) => {
      postProgress(messageId, percentage, msg)
    }

    // Helper to fetch ifc2sql.py
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

    // Store in state
    const state = WorkerState.getInstance()
    state.setPyodide(pyodide)

    // Cleanup old fallback databases
    postProgress(messageId, 95, 'Cleaning up old databases...')
    const idbManager = IndexedDBManager.getInstance()
    await idbManager.cleanupFallbackDatabases()

    // Send initialization complete
    postMessage({
      type: 'initialized',
      messageId,
    })
  } catch (error) {
    postError(messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

