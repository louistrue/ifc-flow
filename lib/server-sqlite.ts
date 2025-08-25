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

    /**
     * Connect to the SQLite database file
     */
    async connectToDatabase(modelId: string): Promise<boolean> {
        try {
            // Look for the SQLite database file in the project root
            // The database should be created by the worker and saved with the model name
            const possiblePaths = [
                path.join(process.cwd(), `${modelId}.sqlite`),
                path.join(process.cwd(), 'public', `${modelId}.sqlite`),
                path.join(process.cwd(), `02_BIMcollab_Example_STR_random_C_ebkp(1).sqlite`), // Current file
                path.join(process.cwd(), `02_BIMcollab_Example_STR_random_C_ebkp.sqlite`),
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
                this.db = new sqlite.Database(this.dbPath!, (err) => {
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

        return new Promise((resolve) => {
            this.db!.all(query, [], (err, rows) => {
                const executionTime = Date.now() - startTime;

                if (err) {
                    console.error('❌ SQLite query error:', err.message);

                    // Log the error
                    aiLogger.logToolExecution({
                        toolName: 'querySqlite',
                        query,
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
                        query,
                        error: err.message
                    });
                    return;
                }

                // Log successful execution
                aiLogger.logToolExecution({
                    toolName: 'querySqlite',
                    query,
                    description,
                    result: rows,
                    executionTime,
                    success: true
                });

                // Process results based on query type and content
                const result = this.processQueryResults(rows, query, description);
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
