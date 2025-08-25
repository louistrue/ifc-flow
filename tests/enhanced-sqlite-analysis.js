const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class EnhancedSQLiteAnalyzer {
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

    async getViews() {
        const sql = "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name";
        const views = await this.query(sql);
        return views.map(row => row.name);
    }

    async getIndexes() {
        const sql = "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name";
        const indexes = await this.query(sql);
        return indexes.map(row => row.name);
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

    async getTableSize(tableName) {
        try {
            const sql = `SELECT SUM("pgsize") as size FROM dbstat WHERE name='${tableName}'`;
            const result = await this.query(sql);
            return result[0]?.size || 0;
        } catch (error) {
            // dbstat might not be available
            return null;
        }
    }

    async getSampleData(tableName, limit = 10) {
        const sql = `SELECT * FROM ${tableName} LIMIT ${limit}`;
        return await this.query(sql);
    }

    async getDistinctValues(tableName, columnName, limit = 20) {
        const sql = `SELECT DISTINCT ${columnName}, COUNT(*) as count FROM ${tableName} GROUP BY ${columnName} ORDER BY count DESC LIMIT ${limit}`;
        return await this.query(sql);
    }

    async getColumnStats(tableName, columnName) {
        const sql = `
            SELECT
                COUNT(*) as total_count,
                COUNT(${columnName}) as non_null_count,
                COUNT(DISTINCT ${columnName}) as distinct_count,
                MIN(LENGTH(${columnName})) as min_length,
                MAX(LENGTH(${columnName})) as max_length,
                AVG(LENGTH(${columnName})) as avg_length
            FROM ${tableName}
        `;
        try {
            return await this.query(sql);
        } catch (error) {
            // Fallback for non-text columns
            const fallbackSql = `
                SELECT
                    COUNT(*) as total_count,
                    COUNT(${columnName}) as non_null_count,
                    COUNT(DISTINCT ${columnName}) as distinct_count
                FROM ${tableName}
            `;
            return await this.query(fallbackSql);
        }
    }

    formatTable(data, title, maxWidth = 100) {
        if (!data || data.length === 0) {
            console.log(`\n📊 ${title}: No data`);
            return;
        }

        console.log(`\n📊 ${title}:`);
        console.log('─'.repeat(Math.min(80, maxWidth)));

        // Get column names
        const columns = Object.keys(data[0]);

        // Calculate column widths
        const colWidths = {};
        columns.forEach(col => {
            colWidths[col] = Math.min(maxWidth / columns.length, Math.max(col.length, 10));
        });

        // Header
        const header = columns.map(col => col.substring(0, colWidths[col]).padEnd(colWidths[col]));
        console.log(header.join(' | '));
        console.log('─'.repeat(Math.min(80, maxWidth)));

        // Data rows
        data.forEach(row => {
            const values = columns.map(col => {
                const value = row[col];
                let str = value === null || value === undefined ? 'NULL' : String(value);
                str = str.length > colWidths[col] ? str.substring(0, colWidths[col] - 3) + '...' : str;
                return str.padEnd(colWidths[col]);
            });
            console.log(values.join(' | '));
        });

        console.log('─'.repeat(Math.min(80, maxWidth)));
        console.log(`Total rows shown: ${data.length}`);
    }

    async analyzeColumn(tableName, columnName) {
        console.log(`\n📊 Column Analysis: ${tableName}.${columnName}`);
        console.log('─'.repeat(60));

        try {
            const stats = await this.getColumnStats(tableName, columnName);
            if (stats && stats[0]) {
                const stat = stats[0];
                console.log(`Total values: ${stat.total_count}`);
                console.log(`Non-null values: ${stat.non_null_count}`);
                console.log(`Distinct values: ${stat.distinct_count}`);
                if (stat.min_length !== undefined) {
                    console.log(`Length range: ${stat.min_length} - ${stat.max_length} (avg: ${stat.avg_length?.toFixed(1)})`);
                }
                console.log(`Null percentage: ${((1 - stat.non_null_count / stat.total_count) * 100).toFixed(1)}%`);
            }

            // Show distinct values if not too many
            const distinctValues = await this.getDistinctValues(tableName, columnName, 15);
            if (distinctValues.length > 0 && distinctValues.length <= 15) {
                console.log(`\n📋 Distinct values:`);
                distinctValues.forEach(val => {
                    const displayValue = val[columnName] === null || val[columnName] === undefined ? 'NULL' :
                        String(val[columnName]).length > 50 ? String(val[columnName]).substring(0, 47) + '...' :
                            String(val[columnName]);
                    console.log(`  ${displayValue}: ${val.count} times`);
                });
            }
        } catch (error) {
            console.log(`❌ Error analyzing column: ${error.message}`);
        }
    }

    async analyzeTable(tableName) {
        console.log(`\n🔍 Analyzing table: ${tableName}`);
        console.log('═'.repeat(100));

        try {
            // Get schema
            const schema = await this.getTableSchema(tableName);
            console.log(`\n📋 Schema for ${tableName}:`);
            schema.forEach(col => {
                const constraints = [];
                if (col.pk) constraints.push('PRIMARY KEY');
                if (col.notnull) constraints.push('NOT NULL');
                if (col.dflt_value !== null) constraints.push(`DEFAULT ${col.dflt_value}`);
                const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
                console.log(`  ${col.name}: ${col.type}${constraintStr}`);
            });

            // Get row count and size
            const rowCount = await this.getTableRowCount(tableName);
            const size = await this.getTableSize(tableName);
            console.log(`\n📈 Row count: ${rowCount.toLocaleString()} rows`);
            if (size !== null) {
                console.log(`💾 Approximate size: ${(size / 1024).toFixed(2)} KB`);
            }

            // Get sample data if table is not empty
            if (rowCount > 0) {
                const sampleData = await this.getSampleData(tableName);
                this.formatTable(sampleData, `Sample data from ${tableName}`, 120);

                // Analyze each column
                for (const col of schema) {
                    await this.analyzeColumn(tableName, col.name);
                }
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

            console.log('\n🚀 Enhanced SQLite Database Analysis Tool');
            console.log('═'.repeat(100));

            // Get database info
            const dbInfo = await this.query("SELECT sqlite_version() as version");
            console.log(`💾 SQLite version: ${dbInfo[0]?.version || 'Unknown'}`);

            // Get all database objects
            const tables = await this.getTables();
            const views = await this.getViews();
            const indexes = await this.getIndexes();

            console.log(`\n📁 Database Objects:`);
            console.log(`  Tables: ${tables.length}`);
            console.log(`  Views: ${views.length}`);
            console.log(`  Indexes: ${indexes.length}`);

            if (tables.length > 0) {
                console.log(`\n📋 Tables:`);
                tables.forEach(table => console.log(`  - ${table}`));
            }

            if (views.length > 0) {
                console.log(`\n👁️  Views:`);
                views.forEach(view => console.log(`  - ${view}`));
            }

            if (indexes.length > 0) {
                console.log(`\n🔍 Indexes:`);
                indexes.forEach(index => console.log(`  - ${index}`));
            }

            // Check for special tables that user requested
            const specialTables = ['metadata', 'id_map', 'elements', 'ifc_spaces'];
            const foundSpecialTables = specialTables.filter(table => tables.includes(table));
            const missingSpecialTables = specialTables.filter(table => !tables.includes(table));

            if (foundSpecialTables.length > 0) {
                console.log(`\n✅ Found requested tables: ${foundSpecialTables.join(', ')}`);
            }

            if (missingSpecialTables.length > 0) {
                console.log(`\n❌ Missing requested tables: ${missingSpecialTables.join(', ')}`);
                console.log(`   Note: These tables might not exist in this particular IFC model or database export.`);
            }

            // Analyze each table
            for (const table of tables) {
                await this.analyzeTable(table);
            }

            // Database statistics summary
            console.log('\n📊 Database Statistics Summary:');
            console.log('═'.repeat(80));
            console.log('Table'.padEnd(20), '|', 'Rows'.padEnd(10), '|', 'Columns'.padEnd(8), '|', 'Size (KB)');
            console.log('─'.repeat(80));

            for (const table of tables) {
                const count = await this.getTableRowCount(table);
                const schema = await this.getTableSchema(table);
                const size = await this.getTableSize(table);
                const sizeStr = size !== null ? (size / 1024).toFixed(2) : 'N/A';
                console.log(
                    table.padEnd(20),
                    '|',
                    count.toString().padStart(10),
                    '|',
                    schema.length.toString().padEnd(8),
                    '|',
                    sizeStr.padStart(8)
                );
            }

            // Additional database info
            const totalRows = await this.query("SELECT SUM(row_count) as total FROM (SELECT COUNT(*) as row_count FROM sqlite_master WHERE type='table')");
            console.log('─'.repeat(80));
            console.log(`Total rows across all tables: ${(totalRows[0]?.total || 0).toLocaleString()}`);

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
        console.log('\nUsage: node enhanced-sqlite-analysis.js [path-to-database]');
        console.log('Example: node enhanced-sqlite-analysis.js ./4_DT(2).sqlite');
        process.exit(1);
    }

    const analyzer = new EnhancedSQLiteAnalyzer(dbPath);
    await analyzer.analyzeDatabase();
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
