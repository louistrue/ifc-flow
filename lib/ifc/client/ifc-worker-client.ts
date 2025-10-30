/**
 * IfcWorkerClient
 * Clean async API for worker communication
 * Replaces scattered worker communication in ifc-utils.ts
 */

import type { IfcModel, IfcElement } from '@/lib/ifc-utils'

type ProgressCallback = (progress: number, message?: string) => void

export interface GeometryOptions {
  elementType?: string
  includeOpenings?: boolean
}

export class IfcWorkerClient {
  private worker: Worker | null = null
  private isInitialized = false
  private resolvers = new Map<string, { resolve: Function; reject: Function }>()

  constructor(workerPath: string = '/ifcWorker.js') {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      this.worker = new Worker(workerPath)
      this.setupMessageHandler()
    }
  }

  private setupMessageHandler() {
    if (!this.worker) return

    this.worker.onmessage = (event) => {
      const { type, messageId, error, ...data } = event.data

      if (type === 'error') {
        const resolver = this.resolvers.get(messageId)
        if (resolver) {
          resolver.reject(new Error(data.message))
          this.resolvers.delete(messageId)
        }
        return
      }

      const resolver = this.resolvers.get(messageId)
      if (resolver) {
        resolver.resolve(data)
        this.resolvers.delete(messageId)
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return
    if (!this.worker) throw new Error('Worker is not available')

    const messageId = `init_${Date.now()}`
    await new Promise<void>((resolve, reject) => {
      this.resolvers.set(messageId, { resolve, reject })
      this.worker!.postMessage({ action: 'init', messageId })
      
      setTimeout(() => {
        if (this.resolvers.has(messageId)) {
          reject(new Error('Worker initialization timed out'))
          this.resolvers.delete(messageId)
        }
      }, 30000)
    })

    this.isInitialized = true
  }

  private sendMessage<T>(
    action: string,
    data: any,
    options?: { timeout?: number; onProgress?: ProgressCallback }
  ): Promise<T> {
    if (!this.worker) throw new Error('Worker is not available')

    const messageId = `${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timeout = options?.timeout || 60000

    // Setup progress handler if provided
    if (options?.onProgress) {
      const progressHandler = (event: MessageEvent) => {
        const msg = event.data
        if (msg.type === 'progress' && msg.messageId === messageId) {
          options.onProgress!(msg.percentage, msg.message)
        }
      }
      this.worker.addEventListener('message', progressHandler)
    }

    return new Promise<T>((resolve, reject) => {
      this.resolvers.set(messageId, { resolve, reject })

      this.worker!.postMessage({
        action,
        messageId,
        data,
      })

      setTimeout(() => {
        if (this.resolvers.has(messageId)) {
          reject(new Error(`${action} operation timed out`))
          this.resolvers.delete(messageId)
        }
      }, timeout)
    })
  }

  async loadIfc(file: File, onProgress?: ProgressCallback): Promise<IfcModel> {
    await this.ensureInitialized()
    
    const arrayBuffer = await file.arrayBuffer()
    const result = await this.sendMessage<any>(
      'loadIfcFast',
      { arrayBuffer, filename: file.name },
      { timeout: file.size > 100 * 1024 * 1024 ? 120000 : 60000, onProgress }
    )

    return {
      id: `model-${Date.now()}`,
      name: file.name,
      file,
      schema: result.schema,
      project: result.project,
      elementCounts: result.element_counts,
      totalElements: result.total_elements,
      elements: result.elements || [],
      sqliteDb: result.sqlite_db,
      sqliteSuccess: result.sqlite_success,
    }
  }

  async querySqlite(model: IfcModel, query: string): Promise<any[]> {
    await this.ensureInitialized()
    return this.sendMessage<any[]>('querySqlite', {
      query,
      modelId: model.name,
    })
  }

  async extractGeometry(
    model: IfcModel,
    options: GeometryOptions = {},
    onProgress?: ProgressCallback
  ): Promise<IfcElement[]> {
    await this.ensureInitialized()
    
    if (!model.file) throw new Error('Model file is required for geometry extraction')
    const file = typeof model.file === 'string' ? null : model.file
    if (!file) throw new Error('Could not retrieve IFC file')

    const arrayBuffer = await file.arrayBuffer()
    return this.sendMessage<IfcElement[]>(
      'extractGeometry',
      {
        elementType: options.elementType || 'all',
        includeOpenings: options.includeOpenings !== false,
        arrayBuffer,
      },
      { timeout: 120000, onProgress }
    )
  }

  async runPython(
    script: string,
    model: IfcModel | null,
    inputData?: any,
    properties?: Record<string, any>,
    onProgress?: ProgressCallback
  ): Promise<any> {
    await this.ensureInitialized()
    
    let arrayBuffer: ArrayBuffer | null = null
    if (model?.file) {
      const file = typeof model.file === 'string' ? null : model.file
      if (file) {
        arrayBuffer = await file.arrayBuffer()
      }
    }

    return this.sendMessage<any>(
      'runPython',
      {
        script,
        arrayBuffer,
        inputData,
        properties,
      },
      { timeout: 120000, onProgress }
    )
  }

  async exportSqlite(model: IfcModel): Promise<Uint8Array> {
    await this.ensureInitialized()
    return this.sendMessage<Uint8Array>('exportSqlite', {
      modelId: model.id,
    })
  }

  async warmSqlite(model: IfcModel): Promise<{ tableCount: number }> {
    await this.ensureInitialized()
    return this.sendMessage<{ tableCount: number }>('warmSqlite', {
      modelKey: model.name,
    })
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.isInitialized = false
      this.resolvers.clear()
    }
  }
}

// Singleton instance
let clientInstance: IfcWorkerClient | null = null

export function getIfcWorkerClient(workerPath?: string): IfcWorkerClient {
  if (!clientInstance) {
    // TODO: Switch to unified worker when built
    // The unified worker will be at /ifcWorker-unified.js once built
    // For now, use legacy worker for backward compatibility
    const defaultPath = process.env.NEXT_PUBLIC_USE_UNIFIED_WORKER === 'true' 
      ? '/ifcWorker-unified.js' 
      : '/ifcWorker.js'
    clientInstance = new IfcWorkerClient(workerPath || defaultPath)
  }
  return clientInstance
}

