/**
 * Worker State
 * Centralized state management for the worker
 */

import type { PyodideInstance } from '../shared/pyodide-manager'
import type { SQLiteDatabase } from '../shared/sqlite-manager'

export interface IfcModelCache {
  filename: string
  schema: string
  model_id: string
  dbKey: string
}

/**
 * Centralized worker state management
 * Replaces global variables: pyodide, sqliteDb, currentSqlKey, ifcModelCache
 */
export class WorkerState {
  private static instance: WorkerState | null = null

  private pyodide: PyodideInstance | null = null
  private sqliteDb: SQLiteDatabase | null = null
  private currentSqlKey: string | null = null
  private ifcModelCache: IfcModelCache | null = null

  private constructor() {}

  static getInstance(): WorkerState {
    if (!WorkerState.instance) {
      WorkerState.instance = new WorkerState()
    }
    return WorkerState.instance
  }

  // Pyodide
  getPyodide(): PyodideInstance | null {
    return this.pyodide
  }

  setPyodide(pyodide: PyodideInstance | null): void {
    this.pyodide = pyodide
  }

  // SQLite
  getSqliteDb(): SQLiteDatabase | null {
    return this.sqliteDb
  }

  setSqliteDb(db: SQLiteDatabase | null): void {
    this.sqliteDb = db
  }

  getCurrentSqlKey(): string | null {
    return this.currentSqlKey
  }

  setCurrentSqlKey(key: string | null): void {
    this.currentSqlKey = key
  }

  // IFC Model Cache
  getIfcModelCache(): IfcModelCache | null {
    return this.ifcModelCache
  }

  setIfcModelCache(cache: IfcModelCache | null): void {
    this.ifcModelCache = cache
  }

  /**
   * Reset all state (useful for cleanup)
   */
  reset(): void {
    this.pyodide = null
    this.sqliteDb = null
    this.currentSqlKey = null
    this.ifcModelCache = null
  }
}

