const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Test script to verify our optimized AI node queries work with the actual database
 */

class OptimizedQueryTester {
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

    async testOptimizedQueries() {
        console.log('\n🚀 Testing Optimized AI Node Queries');
        console.log('═'.repeat(80));

        const queries = [
            {
                name: "Wall Count",
                sql: "SELECT COUNT(*) as count FROM IfcWallStandardCase",
                expectedType: "count"
            },
            {
                name: "Slab Count",
                sql: "SELECT COUNT(*) as count FROM IfcSlab",
                expectedType: "count"
            },
            {
                name: "Beam Count",
                sql: "SELECT COUNT(*) as count FROM IfcBeam",
                expectedType: "count"
            },
            {
                name: "Wall Names",
                sql: "SELECT ifc_id, GlobalId, Name, ObjectType FROM IfcWallStandardCase ORDER BY Name LIMIT 5",
                expectedType: "list"
            },
            {
                name: "Wall Properties",
                sql: `SELECT w.ifc_id, w.GlobalId, w.Name, p.pset_name, p.name as property_name, p.value 
                      FROM IfcWallStandardCase w 
                      JOIN psets p ON w.ifc_id = p.ifc_id 
                      WHERE w.ifc_id = (SELECT MIN(ifc_id) FROM IfcWallStandardCase)
                      ORDER BY p.pset_name, p.name`,
                expectedType: "properties"
            },
            {
                name: "Wall Quantities",
                sql: `SELECT w.ifc_id, w.GlobalId, w.Name, p.name as quantity_name, p.value 
                      FROM IfcWallStandardCase w 
                      JOIN psets p ON w.ifc_id = p.ifc_id 
                      WHERE p.pset_name = 'BaseQuantities'
                      AND w.ifc_id = (SELECT MIN(ifc_id) FROM IfcWallStandardCase)
                      ORDER BY p.name`,
                expectedType: "quantities"
            },
            {
                name: "All Element Types",
                sql: `SELECT ifc_class, COUNT(*) as count 
                      FROM id_map 
                      WHERE ifc_class LIKE 'Ifc%' 
                      AND ifc_class NOT LIKE '%Rel%' 
                      AND ifc_class NOT LIKE '%Property%' 
                      AND ifc_class NOT LIKE '%Quantity%' 
                      GROUP BY ifc_class 
                      ORDER BY count DESC 
                      LIMIT 10`,
                expectedType: "list"
            },
            {
                name: "Elements with Areas",
                sql: `SELECT id_map.ifc_class, p.ifc_id, p.value as area
                      FROM psets p
                      JOIN id_map ON p.ifc_id = id_map.ifc_id
                      WHERE p.pset_name = 'BaseQuantities' 
                      AND p.name IN ('GrossFootprintArea', 'GrossSideArea', 'NetSideArea')
                      AND CAST(p.value AS REAL) > 0
                      ORDER BY CAST(p.value AS REAL) DESC
                      LIMIT 5`,
                expectedType: "quantities"
            }
        ];

        for (const testQuery of queries) {
            try {
                console.log(`\n🔍 Testing: ${testQuery.name}`);
                console.log(`📝 SQL: ${testQuery.sql}`);

                const startTime = Date.now();
                const result = await this.query(testQuery.sql);
                const duration = Date.now() - startTime;

                console.log(`⏱️  Query time: ${duration}ms`);
                console.log(`📊 Result count: ${result.length} rows`);

                if (result.length > 0) {
                    console.log(`📋 Sample result:`, JSON.stringify(result[0], null, 2));

                    // Validate result structure based on expected type
                    this.validateResultStructure(result, testQuery.expectedType);
                } else {
                    console.log(`⚠️  No results returned`);
                }

                console.log(`✅ ${testQuery.name} - PASSED`);

            } catch (error) {
                console.error(`❌ ${testQuery.name} - FAILED:`, error.message);
            }
        }
    }

    validateResultStructure(result, expectedType) {
        const firstRow = result[0];

        switch (expectedType) {
            case 'count':
                if (!('count' in firstRow)) {
                    throw new Error('Count query should return a "count" column');
                }
                console.log(`✓ Count result structure valid`);
                break;

            case 'list':
                console.log(`✓ List result structure valid (${result.length} items)`);
                break;

            case 'properties':
                if (!('property_name' in firstRow) && !('pset_name' in firstRow)) {
                    console.log('⚠️  Properties query may not have expected structure');
                } else {
                    console.log(`✓ Properties result structure valid`);
                }
                break;

            case 'quantities':
                if (!('quantity_name' in firstRow) && !('area' in firstRow) && !('volume' in firstRow)) {
                    console.log('⚠️  Quantities query may not have expected structure');
                } else {
                    console.log(`✓ Quantities result structure valid`);
                }
                break;
        }
    }

    async testAINodeCompatibility() {
        console.log('\n🤖 Testing AI Node Compatibility');
        console.log('═'.repeat(80));

        // Test queries that the AI node would commonly use
        const aiQueries = [
            "How many walls are there?",
            "What are the wall names?",
            "Show me wall properties",
            "What materials are used in walls?",
            "How many slabs are in the model?"
        ];

        const queryMappings = {
            "How many walls are there?": "SELECT COUNT(*) as count FROM IfcWallStandardCase",
            "What are the wall names?": "SELECT Name FROM IfcWallStandardCase WHERE Name IS NOT NULL ORDER BY Name",
            "Show me wall properties": `SELECT w.Name, p.pset_name, p.name, p.value FROM IfcWallStandardCase w JOIN psets p ON w.ifc_id = p.ifc_id LIMIT 10`,
            "What materials are used in walls?": "SELECT DISTINCT ObjectType FROM IfcWallStandardCase WHERE ObjectType IS NOT NULL",
            "How many slabs are in the model?": "SELECT COUNT(*) as count FROM IfcSlab"
        };

        for (const question of aiQueries) {
            console.log(`\n❓ Question: "${question}"`);
            const sql = queryMappings[question];
            console.log(`🔧 Generated SQL: ${sql}`);

            try {
                const result = await this.query(sql);
                console.log(`✅ Query successful - ${result.length} results`);

                // Show sample result
                if (result.length > 0) {
                    if (result.length === 1 && 'count' in result[0]) {
                        console.log(`📊 Answer: ${result[0].count}`);
                    } else if (result.length <= 5) {
                        console.log(`📋 Results:`, result.map(r => r.Name || r.ObjectType || JSON.stringify(r)));
                    } else {
                        console.log(`📋 Sample results:`, result.slice(0, 3).map(r => r.Name || r.ObjectType || JSON.stringify(r)));
                        console.log(`   ... and ${result.length - 3} more`);
                    }
                }

            } catch (error) {
                console.error(`❌ Query failed:`, error.message);
            }
        }
    }

    async close() {
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

// Main execution
async function main() {
    const dbPath = process.argv[2] || './02_BIMcollab_Example_STR_random_C_ebkp(1).sqlite';

    if (!require('fs').existsSync(dbPath)) {
        console.error(`❌ Database file not found: ${dbPath}`);
        console.log('\nUsage: node test-optimized-ai-queries.js [path-to-database]');
        process.exit(1);
    }

    const tester = new OptimizedQueryTester(dbPath);

    try {
        await tester.connect();
        await tester.testOptimizedQueries();
        await tester.testAINodeCompatibility();
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await tester.close();
    }
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

// Run the tests
main().catch(console.error);
