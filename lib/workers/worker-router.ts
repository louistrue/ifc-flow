/**
 * Worker Router
 * Routes messages to appropriate handlers with lazy loading support
 */

import type { BaseWorkerMessage, WorkerHandler } from './worker-types'
import { postError } from './worker-utils'

// Handler registry with lazy loading
const handlerRegistry = new Map<string, () => Promise<WorkerHandler>>()

// Register handlers (lazy load)
export function registerHandler(action: string, factory: () => Promise<WorkerHandler>) {
  handlerRegistry.set(action, factory)
}

// Get handler (lazy load)
async function getHandler(action: string): Promise<WorkerHandler | null> {
  const factory = handlerRegistry.get(action)
  if (!factory) return null
  
  try {
    return await factory()
  } catch (error) {
    console.error(`Failed to load handler for ${action}:`, error)
    return null
  }
}

// Main message router
export async function routeMessage(message: BaseWorkerMessage): Promise<void> {
  try {
    const handler = await getHandler(message.action)
    
    if (handler) {
      await handler(message)
    } else {
      // Fallback to legacy handler (existing ifcWorker.js switch statement)
      // This allows gradual migration
      throw new Error(`No handler registered for action: ${message.action}. Using legacy handler.`)
    }
  } catch (error) {
    // Fallback to legacy error handling
    postError(message.messageId, error instanceof Error ? error : new Error(String(error)))
  }
}

// Initialize handlers
export async function initializeHandlers() {
  // Register handlers here as they are extracted
  // For now, handlers will delegate to legacy code
}

