/**
 * Worker Main Entry Point
 * This replaces the switch statement in ifcWorker.js
 * 
 * NOTE: This file will be compiled to JavaScript and used as the new worker
 */

import { routeMessage } from './worker-router'
import type { BaseWorkerMessage } from './worker-types'

// Main message handler
self.onmessage = async (event: MessageEvent) => {
  try {
    const message = event.data as BaseWorkerMessage
    await routeMessage(message)
  } catch (error) {
    self.postMessage({
      type: 'error',
      messageId: event.data?.messageId || '',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}

// Initialize handlers on worker load
import('./worker-router').then(({ initializeHandlers }) => {
  initializeHandlers().catch(console.error)
})

