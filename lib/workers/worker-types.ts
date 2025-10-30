/**
 * Worker Message Protocol Types
 * Defines type-safe message communication between main thread and worker
 */

export type WorkerAction =
    | 'init'
    | 'loadIfc'
    | 'loadIfcFast'
    | 'extractData'
    | 'exportIfc'
    | 'extractGeometry'
    | 'extractQuantities'
    | 'runPython'
    | 'querySqlite'
    | 'exportSqlite'
    | 'warmSqlite'
    | 'buildSqlite'

export type WorkerMessageType =
    | 'initialized'
    | 'loadComplete'
    | 'dataExtracted'
    | 'ifcExported'
    | 'geometry'
    | 'extractQuantities'
    | 'quantityResults'
    | 'pythonResult'
    | 'sqliteResult'
    | 'sqliteExport'
    | 'sqliteBuilt'
    | 'sqliteWarmed'
    | 'sqliteStatus'
    | 'progress'
    | 'error'

export interface BaseWorkerMessage {
    action: WorkerAction
    messageId: string
    data?: any
}

export interface WorkerResponse {
    type: WorkerMessageType
    messageId: string
    error?: string
    stack?: string
    message?: string
    [key: string]: any
}

export interface ProgressMessage {
    type: 'progress'
    messageId: string
    percentage: number
    message?: string
}

export interface ErrorMessage {
    type: 'error'
    messageId: string
    message: string
    stack?: string
}

// Handler function type
export type WorkerHandler = (message: BaseWorkerMessage) => Promise<void>

// Handler factory type (for lazy loading)
export type HandlerFactory = () => Promise<WorkerHandler>

