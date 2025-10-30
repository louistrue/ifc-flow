/**
 * Worker Router
 * Routes messages to appropriate handlers with lazy loading support
 */

import type { BaseWorkerMessage, WorkerHandler } from '../worker-types'
import { postError } from '../worker-utils'

// Handler registry with lazy loading
const handlerRegistry = new Map<string, () => Promise<WorkerHandler>>()

// Cache for loaded handlers
const handlerCache = new Map<string, WorkerHandler>()

// Register handlers (lazy load)
export function registerHandler(action: string, factory: () => Promise<WorkerHandler>) {
  handlerRegistry.set(action, factory)
}

// Get handler (lazy load)
async function getHandler(action: string): Promise<WorkerHandler | null> {
  // Check cache first
  if (handlerCache.has(action)) {
    return handlerCache.get(action)!
  }

  const factory = handlerRegistry.get(action)
  if (factory) {
    try {
      const handler = await factory()
      handlerCache.set(action, handler)
      return handler
    } catch (error) {
      console.error(`Failed to load handler for action "${action}":`, error)
      return null
    }
  }

  return null
}

// Main message router
export async function routeMessage(message: BaseWorkerMessage): Promise<void> {
  try {
    const handler = await getHandler(message.action)

    if (handler) {
      await handler(message)
    } else {
      throw new Error(`No handler registered for action: ${message.action}`)
    }
  } catch (error) {
    postError(
      message.messageId,
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

// Initialize handlers - registers all handlers with lazy loading
export async function initializeHandlers() {
  // Register all handlers with lazy loading factories
  registerHandler('init', async () => {
    const { handleInit } = await import('../handlers/init-handler')
    return handleInit as WorkerHandler
  })

  registerHandler('loadIfc', async () => {
    const { handleLoadIfc } = await import('../handlers/ifc-loader-handler')
    return handleLoadIfc as WorkerHandler
  })

  registerHandler('loadIfcFast', async () => {
    const { handleLoadIfcFast } = await import('../handlers/ifc-loader-handler')
    return handleLoadIfcFast as WorkerHandler
  })

  registerHandler('extractData', async () => {
    const { handleExtractData } = await import('../handlers/data-handler')
    return handleExtractData as WorkerHandler
  })

  registerHandler('extractQuantities', async () => {
    const { handleExtractQuantities } = await import('../handlers/data-handler')
    return handleExtractQuantities as WorkerHandler
  })

  registerHandler('extractGeometry', async () => {
    const { handleExtractGeometry } = await import('../handlers/geometry-handler')
    return handleExtractGeometry as WorkerHandler
  })

  registerHandler('exportIfc', async () => {
    const { handleExportIfc } = await import('../handlers/export-handler')
    return handleExportIfc as WorkerHandler
  })

  registerHandler('runPython', async () => {
    const { handleRunPython } = await import('../handlers/python-handler')
    return handleRunPython as WorkerHandler
  })

  registerHandler('querySqlite', async () => {
    const { handleSqliteQuery } = await import('../handlers/sqlite-handler')
    return handleSqliteQuery as WorkerHandler
  })

  registerHandler('exportSqlite', async () => {
    const { handleSqliteExport } = await import('../handlers/sqlite-handler')
    return handleSqliteExport as WorkerHandler
  })

  registerHandler('warmSqlite', async () => {
    const { handleWarmSqlite } = await import('../handlers/sqlite-handler')
    return handleWarmSqlite as WorkerHandler
  })

  registerHandler('buildSqlite', async () => {
    const { handleBuildSqlite } = await import('../handlers/sqlite-handler')
    return handleBuildSqlite as WorkerHandler
  })

  console.log('Worker handlers registered successfully')
}

