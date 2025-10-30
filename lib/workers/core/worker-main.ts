/**
 * Worker Main Entry Point
 * This is the entry point for the unified TypeScript worker
 */

import type { BaseWorkerMessage } from '../worker-types'
import { routeMessage, initializeHandlers } from './router'

// Initialize handlers when worker starts
let handlersInitialized = false

async function ensureHandlersInitialized() {
  if (!handlersInitialized) {
    await initializeHandlers()
    handlersInitialized = true
  }
}

// Main message handler
self.onmessage = async (event: MessageEvent<BaseWorkerMessage>) => {
  try {
    // Ensure handlers are initialized
    await ensureHandlersInitialized()

    // Route the message to the appropriate handler
    await routeMessage(event.data)
  } catch (error) {
    // Fallback error handling
    self.postMessage({
      type: 'error',
      messageId: event.data?.messageId || 'unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}

// Initialize handlers on worker load
ensureHandlersInitialized().catch((error) => {
  console.error('Failed to initialize worker handlers:', error)
})

