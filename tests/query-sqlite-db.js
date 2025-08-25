const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLiteQueryTool {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ Connected to database: ${this.dbPath}`);
                    resolve();
                }
            });
        });
    }

    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ Query error:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getTables() {
        const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
        const tables = await this.query(sql);
        return tables.map(row => row.name);
    }

    async getTableSchema(tableName) {
        const sql = `PRAGMA table_info(${tableName})`;
        return await this.query(sql);
    }

    async getTableRowCount(tableName) {
        const sql = `SELECT COUNT(*) as count FROM ${tableName}`;
        const result = await this.query(sql);
        return result[0]?.count || 0;
    }

    async getSampleData(tableName, limit = 5) {
        const sql = `SELECT * FROM ${tableName} LIMIT ${limit}`;
        return await this.query(sql);
    }

    formatTable(data, title) {
        if (!data || data.length === 0) {
            console.log(`\n📊 ${title}: No data`);
            return;
        }

        console.log(`\n📊 ${title}:`);
        console.log('─'.repeat(80));

        // Get column names
        const columns = Object.keys(data[0]);
        console.log(columns.join(' | '));
        console.log('─'.repeat(80));

        // Print rows
        data.forEach(row => {
            const values = columns.map(col => {
                const value = row[col];
                if (value === null || value === undefined) return 'NULL';
                const str = String(value);
                return str.length > 50 ? str.substring(0, 47) + '...' : str;
            });
            console.log(values.join(' | '));
        });

        console.log('─'.repeat(80));
        console.log(`Total rows shown: ${data.length}`);
    }

    async analyzeTable(tableName) {
        console.log(`\n🔍 Analyzing table: ${tableName}`);
        console.log('═'.repeat(100));

        try {
            // Get schema
            const schema = await this.getTableSchema(tableName);
            console.log(`\n📋 Schema for ${tableName}:`);
            schema.forEach(col => {
                console.log(`  ${col.name}: ${col.type} ${col.notnull ? '(NOT NULL)' : ''} ${col.pk ? '(PRIMARY KEY)' : ''}`);
            });

            // Get row count
            const rowCount = await this.getTableRowCount(tableName);
            console.log(`\n📈 Row count: ${rowCount.toLocaleString()} rows`);

            // Get sample data if table is not empty
            if (rowCount > 0) {
                const sampleData = await this.getSampleData(tableName, 10);
                this.formatTable(sampleData, `Sample data from ${tableName}`);
            } else {
                console.log('\n📊 Table is empty');
            }

        } catch (error) {
            console.error(`❌ Error analyzing table ${tableName}:`, error.message);
        }
    }

    async analyzeDatabase() {
        try {
            await this.connect();

            console.log('\n🚀 SQLite Database Analysis Tool');
            console.log('═'.repeat(100));

            // Get all tables
            const tables = await this.getTables();
            console.log(`\n📁 Found ${tables.length} tables:`);
            tables.forEach(table => console.log(`  - ${table}`));

            // Database info
            const dbInfo = await this.query("SELECT sqlite_version() as version, name FROM sqlite_master WHERE type='table' LIMIT 1");
            console.log(`\n💾 SQLite version: ${dbInfo[0]?.version || 'Unknown'}`);

            // Analyze each table
            for (const table of tables) {
                await this.analyzeTable(table);
            }

            // Special focus on metadata and id_map tables
            if (tables.includes('metadata')) {
                console.log('\n🎯 SPECIAL ANALYSIS: metadata table');
                console.log('═'.repeat(100));
                await this.analyzeTable('metadata');
            }

            if (tables.includes('id_map')) {
                console.log('\n🎯 SPECIAL ANALYSIS: id_map table');
                console.log('═'.repeat(100));
                await this.analyzeTable('id_map');
            }

            // Additional database statistics
            console.log('\n📊 Database Statistics:');
            console.log('─'.repeat(50));

            for (const table of tables) {
                const count = await this.getTableRowCount(table);
                const schema = await this.getTableSchema(table);
                console.log(`${table.padEnd(20)} | ${count.toString().padStart(8)} rows | ${schema.length} columns`);
            }

        } catch (error) {
            console.error('❌ Database analysis failed:', error);
        } finally {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                    } else {
                        console.log('\n✅ Database connection closed');
                    }
                });
            }
        }
    }
}

// Main execution
async function main() {
    const dbPath = process.argv[2] || './4_DT(2).sqlite';

    if (!require('fs').existsSync(dbPath)) {
        console.error(`❌ Database file not found: ${dbPath}`);
        console.log('\nUsage: node query-sqlite-db.js [path-to-database]');
        console.log('Example: node query-sqlite-db.js ./4_DT(2).sqlite');
        process.exit(1);
    }

    const tool = new SQLiteQueryTool(dbPath);
    await tool.analyzeDatabase();
}

// Check if sqlite3 is installed
try {
    require('sqlite3');
} catch (error) {
    console.error('❌ sqlite3 module not found!');
    console.log('\nPlease install sqlite3:');
    console.log('  npm install sqlite3');
    process.exit(1);
}

// Run the analysis
main().catch(console.error);
