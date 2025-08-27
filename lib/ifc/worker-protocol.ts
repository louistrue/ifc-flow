// Define the message protocol between the main thread and the IFC worker

export type WorkerAction =
  | 'init'
  | 'loadIfc'
  | 'extractData'
  | 'extractGeometry'
  | 'extractQuantities'
  | 'runPython'
  | 'querySqlite'
  | 'exportSqlite'
  | 'warmSqlite'
  | 'exportIfc';

export interface WorkerRequest<T extends WorkerAction = WorkerAction> {
  action: T;
  messageId: string;
  data?: any;
  // Some actions (like exportIfc) historically placed fields at the root
  // Keep index signature to accept legacy shapes until all callers are unified
  [k: string]: any;
}

export type WorkerEventType =
  | 'initialized'
  | 'loadComplete'
  | 'dataExtracted'
  | 'geometry'
  | 'quantityResults'
  | 'pythonResult'
  | 'sqliteResult'
  | 'sqliteExport'
  | 'sqliteWarmed'
  | 'sqliteStatus'
  | 'progress'
  | 'error'
  | 'ifcExported';

export interface WorkerResponseBase {
  type: WorkerEventType;
  messageId?: string;
}

export type WorkerResponse = WorkerResponseBase & Record<string, any>;