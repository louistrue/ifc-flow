const sqlite3 = require('sqlite3').verbose();

/**
 * Test script to verify AI node compatibility with different IFC database schemas
 */

class AINodeCompatibilityTester {
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

    async detectWallTableType() {
        console.log('\n🔍 Detecting Wall Table Type');
        console.log('═'.repeat(50));

        try {
            // Check for IfcWallStandardCase
            const standardCaseResult = await this.query("SELECT COUNT(*) as count FROM IfcWallStandardCase");
            console.log(`✅ IfcWallStandardCase found: ${standardCaseResult[0].count} walls`);
            return { table: 'IfcWallStandardCase', count: standardCaseResult[0].count };
        } catch (error) {
            console.log(`⚠️  IfcWallStandardCase not found: ${error.message}`);
        }

        try {
            // Check for IfcWall
            const wallResult = await this.query("SELECT COUNT(*) as count FROM IfcWall");
            console.log(`✅ IfcWall found: ${wallResult[0].count} walls`);
            return { table: 'IfcWall', count: wallResult[0].count };
        } catch (error) {
            console.log(`⚠️  IfcWall not found: ${error.message}`);
        }

        // Check id_map for wall types
        try {
            const idMapResult = await this.query("SELECT ifc_class, COUNT(*) as count FROM id_map WHERE ifc_class LIKE '%Wall%' GROUP BY ifc_class");
            console.log(`📋 Wall types in id_map:`, idMapResult);
            return { table: 'id_map', wallTypes: idMapResult };
        } catch (error) {
            console.log(`❌ Could not detect wall table type: ${error.message}`);
            return null;
        }
    }

    async testAIQueries() {
        console.log('\n🤖 Testing AI-Compatible Queries');
        console.log('═'.repeat(50));

        const wallInfo = await this.detectWallTableType();
        if (!wallInfo) {
            console.log('❌ Cannot test AI queries without wall table information');
            return;
        }

        const queries = [
            {
                name: "Wall Count (Adaptive)",
                sql: wallInfo.table === 'IfcWallStandardCase'
                    ? "SELECT COUNT(*) as count FROM IfcWallStandardCase"
                    : wallInfo.table === 'IfcWall'
                        ? "SELECT COUNT(*) as count FROM IfcWall"
                        : "SELECT COUNT(*) as count FROM id_map WHERE ifc_class LIKE '%Wall%'",
                expectedAnswer: `There are ${wallInfo.count || wallInfo.wallTypes?.reduce((sum, wt) => sum + wt.count, 0) || 0} walls in this building model.`
            },
            {
                name: "All Element Types",
                sql: "SELECT ifc_class, COUNT(*) as count FROM id_map WHERE ifc_class LIKE 'Ifc%' AND ifc_class NOT LIKE '%Rel%' GROUP BY ifc_class ORDER BY count DESC LIMIT 5",
                expectedAnswer: "Element breakdown with counts"
            },
            {
                name: "Available Properties",
                sql: "SELECT DISTINCT pset_name FROM psets ORDER BY pset_name LIMIT 5",
                expectedAnswer: "Available property sets"
            }
        ];

        for (const testQuery of queries) {
            try {
                console.log(`\n🔧 Testing: ${testQuery.name}`);
                console.log(`📝 SQL: ${testQuery.sql}`);

                const result = await this.query(testQuery.sql);
                console.log(`✅ Query successful - ${result.length} results`);

                if (result.length > 0) {
                    if (result.length === 1 && 'count' in result[0]) {
                        console.log(`📊 Result: ${result[0].count}`);
                        console.log(`🎯 AI Answer: "${testQuery.expectedAnswer}"`);
                    } else {
                        console.log(`📋 Sample results:`, result.slice(0, 3));
                    }
                }

            } catch (error) {
                console.error(`❌ ${testQuery.name} failed:`, error.message);
            }
        }
    }

    async testToolChoiceKeywords() {
        console.log('\n🎯 Testing Tool Choice Keywords');
        console.log('═'.repeat(50));

        const testQuestions = [
            "How many walls are there?",
            "total m2?",
            "What materials are used?",
            "Show me the wall names",
            "List all elements",
            "Hello, how are you?", // Should not trigger tool
            "What is BIM?" // Should not trigger tool
        ];

        const dataKeywords = [
            'list', 'count', 'how many', 'materials', 'material', 'schedule', 'areas', 'area', 'volumes', 'volume',
            'find', 'show', 'walls', 'wall', 'slabs', 'slab', 'doors', 'windows', 'elements', 'pset', 'properties', 'names', 'name'
        ];

        testQuestions.forEach(question => {
            const lowerQuestion = question.toLowerCase();
            const matchedKeywords = dataKeywords.filter(k => lowerQuestion.includes(k));
            const shouldTriggerTool = matchedKeywords.length > 0;

            console.log(`❓ "${question}"`);
            console.log(`   Keywords matched: ${matchedKeywords.join(', ') || 'none'}`);
            console.log(`   Should trigger tool: ${shouldTriggerTool ? '✅ YES' : '❌ NO'}`);
        });
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
        console.log('\nUsage: node test-ai-node-compatibility.js [path-to-database]');
        process.exit(1);
    }

    const tester = new AINodeCompatibilityTester(dbPath);

    try {
        await tester.connect();
        await tester.detectWallTableType();
        await tester.testAIQueries();
        await tester.testToolChoiceKeywords();
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
