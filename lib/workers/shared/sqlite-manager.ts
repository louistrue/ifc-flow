/**
 * SQLite Manager
 * Handles sql.js initialization and database operations
 */

declare global {
    interface Window {
        initSqlJs: any
    }
}

declare const initSqlJs: any

export interface SQLiteDatabase {
    exec(query: string): any[]
    close(): void
}

export class SQLiteManager {
    private static instance: SQLiteManager | null = null
    private sqlModule: any = null
    private currentDb: SQLiteDatabase | null = null
    private currentKey: string | null = null

    private constructor() { }

    static getInstance(): SQLiteManager {
        if (!SQLiteManager.instance) {
            SQLiteManager.instance = new SQLiteManager()
        }
        return SQLiteManager.instance
    }

    /**
     * Initialize sql.js module
     */
    async initialize(): Promise<any> {
        if (this.sqlModule) return this.sqlModule

        // initSqlJs is exposed by sql-wasm.js
        // In worker context, it's available globally
        if (typeof initSqlJs === 'undefined') {
            throw new Error('initSqlJs is not available. Make sure sql-wasm.js is loaded.')
        }

        this.sqlModule = await initSqlJs({
            locateFile: (file: string) =>
                `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
        })

        return this.sqlModule
    }

    /**
     * Get sql.js module
     */
    getModule(): any {
        if (!this.sqlModule) {
            throw new Error('SQLite module not initialized. Call initialize() first.')
        }
        return this.sqlModule
    }

    /**
     * Load database from IndexedDB and open in sql.js
     */
    async loadDatabase(key: string, bytes: Uint8Array | null = null): Promise<SQLiteDatabase | null> {
        const sqlModule = await this.initialize()

        if (!bytes) {
            // Try to load from IndexedDB
            const { IndexedDBManager } = await import('./indexeddb-manager')
            const idbManager = IndexedDBManager.getInstance()
            bytes = await idbManager.get(key)
        }

        if (!bytes) {
            return null
        }

        // Close existing database if different key
        if (this.currentDb && this.currentKey !== key) {
            this.currentDb.close()
            this.currentDb = null
        }

        // Open new database
        this.currentDb = new sqlModule.Database(new Uint8Array(bytes))
        this.currentKey = key

        return this.currentDb
    }

    /**
     * Get current database instance
     */
    getCurrentDatabase(): SQLiteDatabase | null {
        return this.currentDb
    }

    /**
     * Get current database key
     */
    getCurrentKey(): string | null {
        return this.currentKey
    }

    /**
     * Set current database (for external use)
     */
    setCurrentDatabase(db: SQLiteDatabase, key: string): void {
        if (this.currentDb && this.currentKey !== key) {
            this.currentDb.close()
        }
        this.currentDb = db
        this.currentKey = key
    }

    /**
     * Ensure database is loaded for a given key
     */
    async ensureDbLoaded(key: string): Promise<SQLiteDatabase | null> {
        if (this.currentDb && this.currentKey === key) {
            return this.currentDb
        }

        return this.loadDatabase(key)
    }

    /**
     * Close current database
     */
    closeCurrentDatabase(): void {
        if (this.currentDb) {
            this.currentDb.close()
            this.currentDb = null
            this.currentKey = null
        }
    }
}
