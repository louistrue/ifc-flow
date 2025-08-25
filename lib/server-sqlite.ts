import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { aiLogger } from './logger';

// Enable verbose mode for better error reporting
const sqlite = sqlite3.verbose();

interface QueryResult {
    type: 'count' | 'list' | 'properties' | 'quantities' | 'queryResult' | 'error';
    value?: number;
    items?: any[];
    count?: number;
    message?: string;
    description: string;
    query: string;
    rawData?: any[];
    result?: any[];
    error?: string;
}

export class ServerSQLiteManager {
    private db: sqlite3.Database | null = null;
    private dbPath: string | null = null;

    private static readonly MAX_SELECT_ROWS = 1000;
    private static readonly LOG_ROW_CAP = 50;
    private static readonly SENSITIVE_KEY_REGEX = /(name|email|phone|address|password|secret|token)/i;

    private enforceSelectLimit(originalQuery: string): string {
        const q = (originalQuery || '').trim();
        // Only apply to simple SELECT queries (ignore PRAGMA and sqlite_master schema list we already allow)
        if (!/^select\s+/i.test(q)) return q;
        // If a LIMIT exists, clamp it to MAX_SELECT_ROWS
        const limitMatch = q.match(/limit\s+(\d+)/i);
        if (limitMatch) {
            const current = parseInt(limitMatch[1], 10);
            if (Number.isFinite(current) && current > ServerSQLiteManager.MAX_SELECT_ROWS) {
                return q.replace(/limit\s+\d+/i, `LIMIT ${ServerSQLiteManager.MAX_SELECT_ROWS}`);
            }
            return q;
        }
        // Append LIMIT if none present
        return `${q} LIMIT ${ServerSQLiteManager.MAX_SELECT_ROWS}`;
    }

    private maskSensitiveForLog(row: any): any {
        if (!row || typeof row !== 'object') return row;
        const masked: any = Array.isArray(row) ? [...row] : { ...row };
        if (Array.isArray(row)) return (masked as any[]).map((v: any) => (typeof v === 'object' ? this.maskSensitiveForLog(v) : v));
        for (const key of Object.keys(masked)) {
            if (ServerSQLiteManager.SENSITIVE_KEY_REGEX.test(key)) {
                masked[key] = '***';
            }
        }
        return masked;
    }

    /**
     * Connect to the SQLite database file
     */
    async connectToDatabase(modelId: string): Promise<boolean> {
        try {
            // Sanitize modelId to prevent path traversal or injection
            const safeModelId = (modelId || '')
                .replace(/[^a-zA-Z0-9._-]/g, '')
                .slice(0, 64) || 'model';

            // Look for the SQLite database file in controlled locations
            // The database should be created by the worker and saved with the model name
            const possiblePaths = [
                path.join(process.cwd(), `${safeModelId}.sqlite`),
                path.join(process.cwd(), 'public', `${safeModelId}.sqlite`),
            ];

            // Find the first existing database file
            for (const dbPath of possiblePaths) {
                if (fs.existsSync(dbPath)) {
                    this.dbPath = dbPath;
                    break;
                }
            }

            if (!this.dbPath) {
                console.error('❌ No SQLite database file found for model:', modelId);
                console.log('Searched paths:', possiblePaths);

                // Log the database connection failure
                aiLogger.logToolExecution({
                    toolName: 'querySqlite',
                    query: 'CONNECT_DB',
                    description: `Connect to SQLite database for model ${modelId}`,
                    result: null,
                    executionTime: 0,
                    success: false,
                    error: `No database file found. Searched paths: ${possiblePaths.join(', ')}`
                });

                return false;
            }

            return new Promise((resolve, reject) => {
                // Open database in READONLY mode
                this.db = new sqlite.Database(this.dbPath!, sqlite3.OPEN_READONLY, (err) => {
                    if (err) {
                        console.error('❌ Error connecting to SQLite database:', err.message);

                        // Log the SQLite connection error
                        aiLogger.logToolExecution({
                            toolName: 'querySqlite',
                            query: 'CONNECT_DB',
                            description: `SQLite connection to ${this.dbPath}`,
                            result: null,
                            executionTime: 0,
                            success: false,
                            error: err.message
                        });

                        reject(err);
                    } else {
                        console.log('✅ Connected to SQLite database:', this.dbPath);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Error in connectToDatabase:', error);

            // Log the general connection error
            aiLogger.logToolExecution({
                toolName: 'querySqlite',
                query: 'CONNECT_DB',
                description: `Database connection attempt for model ${modelId}`,
                result: null,
                executionTime: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown connection error'
            });

            return false;
        }
    }

    /**
     * Execute a SQL query and return structured results
     */
    async executeQuery(query: string, description: string): Promise<QueryResult> {
        if (!this.db) {
            return {
                type: 'error',
                message: 'Database not connected',
                description,
                query,
                error: 'Database connection not established'
            };
        }

        const startTime = Date.now();

        // Enforce strict allowlist: single-statement, read-only queries
        const isQueryAllowed = (q: string): boolean => {
            const s = (q || '').trim();
            if (!s) return false;
            // Disallow semicolons to prevent multi-statement
            if (s.includes(';')) return false;
            const lower = s.toLowerCase();
            // Allow PRAGMA table_info(TableName)
            const pragmaOk = /^pragma\s+table_info\s*\([a-zA-Z0-9_]+\)\s*$/.test(lower);
            // Allow listing tables
            const listTablesOk = /^select\s+name\s+from\s+sqlite_master\s+where\s+type\s*=\s*'table'(\s+order\s+by\s+name)?\s*$/.test(lower);
            // Allow generic SELECT ... (basic guard)
            const selectOk = /^select\s+[\s\S]+$/i.test(s) && !/(insert|update|delete|drop|create|alter|attach|detach|vacuum|reindex|replace|pragma\s+(?!table_info))/i.test(s) && !/\bunion\b/i.test(s);
            return pragmaOk || listTablesOk || selectOk;
        };

        if (!isQueryAllowed(query)) {
            aiLogger.logToolExecution({
                toolName: 'querySqlite',
                query,
                description,
                result: null,
                executionTime: 0,
                success: false,
                error: 'Blocked non-allowlisted SQL'
            });
            return {
                type: 'error',
                message: 'Query not allowed',
                description,
                query,
                error: 'Blocked non-allowlisted SQL'
            };
        }

        // Apply default LIMIT for SELECT queries without a LIMIT, and clamp excessive limits
        const enforcedQuery = this.enforceSelectLimit(query);

        return new Promise((resolve) => {
            this.db!.all(enforcedQuery, [], (err, rows) => {
                const executionTime = Date.now() - startTime;

                if (err) {
                    console.error('❌ SQLite query error:', err.message);

                    // Log the error
                    aiLogger.logToolExecution({
                        toolName: 'querySqlite',
                        query: enforcedQuery,
                        description,
                        result: null,
                        executionTime,
                        success: false,
                        error: err.message
                    });

                    resolve({
                        type: 'error',
                        message: err.message,
                        description,
                        query: enforcedQuery,
                        error: err.message
                    });
                    return;
                }

                // Log successful execution with masked, sampled rows only
                const sample = Array.isArray(rows) ? rows.slice(0, ServerSQLiteManager.LOG_ROW_CAP).map((r) => this.maskSensitiveForLog(r)) : [];
                aiLogger.logToolExecution({
                    toolName: 'querySqlite',
                    query: enforcedQuery,
                    description,
                    result: { rowCount: Array.isArray(rows) ? rows.length : 0, sample },
                    executionTime,
                    success: true
                });

                // Process results based on query type and content
                const result = this.processQueryResults(rows, enforcedQuery, description);
                resolve(result);
            });
        });
    }

    /**
     * Process raw query results into structured format
     */
    private processQueryResults(rows: any[], query: string, description: string): QueryResult {
        const lowerQuery = query.toLowerCase();

        // Handle count queries
        if (lowerQuery.includes('count(') && rows.length === 1 && 'count' in rows[0]) {
            return {
                type: 'count',
                value: rows[0].count || rows[0]['COUNT(*)'] || 0,
                description,
                query,
                rawData: rows
            };
        }

        // Handle list queries (names, materials, etc.)
        if (lowerQuery.includes('select') && (lowerQuery.includes('name') || lowerQuery.includes('objecttype'))) {
            const items = rows.map(row => {
                // Extract the main value (Name, ObjectType, etc.)
                const keys = Object.keys(row);
                if (keys.includes('Name')) return row.Name;
                if (keys.includes('ObjectType')) return row.ObjectType;
                return Object.values(row)[0]; // First value if no specific key
            }).filter(Boolean);

            return {
                type: 'list',
                items: items,
                count: items.length,
                description,
                query,
                rawData: rows
            };
        }

        // Handle property queries
        if (lowerQuery.includes('psets') || lowerQuery.includes('properties')) {
            return {
                type: 'properties',
                items: rows,
                count: rows.length,
                description,
                query,
                rawData: rows
            };
        }

        // Handle quantity queries
        if (lowerQuery.includes('quantity') || lowerQuery.includes('value')) {
            return {
                type: 'quantities',
                items: rows,
                count: rows.length,
                description,
                query,
                rawData: rows
            };
        }

        // Generic query result
        return {
            type: 'queryResult',
            result: rows,
            count: rows.length,
            message: rows.length > 0 ? `Found ${rows.length} results` : 'No results found',
            description,
            query,
            rawData: rows
        };
    }

    /**
     * Get database schema information
     */
    async getTableInfo(): Promise<string[]> {
        if (!this.db) return [];

        return new Promise((resolve) => {
            this.db!.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
                if (err) {
                    console.error('❌ Error getting table info:', err.message);
                    resolve([]);
                } else {
                    const tables = rows.map((row: any) => row.name);
                    console.log('📊 Available tables:', tables);
                    resolve(tables);
                }
            });
        });
    }

    /**
     * Close the database connection
     */
    close(): void {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err.message);
                } else {
                    console.log('✅ Database connection closed');
                }
            });
            this.db = null;
        }
    }
}

// Singleton instance for reuse
let sqliteManager: ServerSQLiteManager | null = null;

export async function getServerSQLiteManager(modelId: string): Promise<ServerSQLiteManager | null> {
    if (!sqliteManager) {
        sqliteManager = new ServerSQLiteManager();
    }

    const connected = await sqliteManager.connectToDatabase(modelId);
    return connected ? sqliteManager : null;
}
