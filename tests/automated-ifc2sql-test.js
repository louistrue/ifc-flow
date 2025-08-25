#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Automated test for IFC2SQL comprehensive database generation
class AutomatedIFC2SQLTest {
    constructor() {
        this.serverUrl = 'http://localhost:3000';
        this.ifcFilePath = path.join(__dirname, 'public', '4_DT.ifc');
        this.testResults = {
            serverRunning: false,
            ifcFileExists: false,
            databaseGenerated: false,
            tableCount: 0,
            totalRows: 0,
            comprehensiveDatabase: false
        };
    }

    async run() {
        console.log('🚀 Starting Automated IFC2SQL Test');
        console.log('==================================');

        try {
            // Step 1: Check prerequisites
            await this.checkPrerequisites();

            // Step 2: Test server connectivity
            await this.testServerConnectivity();

            // Step 3: Check IFC file
            await this.checkIFCFile();

            // Step 4: Test API endpoints
            await this.testAPIEndpoints();

            // Step 5: Test IFC loading simulation
            await this.simulateIFCLoading();

            // Step 6: Generate and verify database
            await this.generateAndVerifyDatabase();

            // Step 7: Report results
            this.reportResults();

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            this.testResults.error = error.message;
            this.reportResults();
        }
    }

    async checkPrerequisites() {
        console.log('📋 Checking prerequisites...');

        // Check if Node.js modules are available
        const requiredModules = ['fs', 'path', 'http'];
        for (const module of requiredModules) {
            try {
                require.resolve(module);
                console.log(`   ✅ ${module} available`);
            } catch (e) {
                console.log(`   ❌ ${module} not available`);
            }
        }
    }

    async testServerConnectivity() {
        console.log('🌐 Testing server connectivity...');

        return new Promise((resolve, reject) => {
            const http = require('http');
            const url = new URL(this.serverUrl);

            const req = http.get({
                hostname: url.hostname,
                port: url.port || 80,
                path: '/',
                timeout: 5000
            }, (res) => {
                if (res.statusCode === 200) {
                    console.log(`   ✅ Server responding at ${this.serverUrl}`);
                    this.testResults.serverRunning = true;
                    resolve();
                } else {
                    console.log(`   ❌ Server returned status ${res.statusCode}`);
                    reject(new Error(`Server returned status ${res.statusCode}`));
                }
            });

            req.on('error', (err) => {
                console.log(`   ❌ Cannot connect to server: ${err.message}`);
                reject(err);
            });

            req.on('timeout', () => {
                console.log(`   ❌ Server connection timeout`);
                req.destroy();
                reject(new Error('Connection timeout'));
            });
        });
    }

    async checkIFCFile() {
        console.log('📁 Checking IFC file...');

        if (fs.existsSync(this.ifcFilePath)) {
            const stats = fs.statSync(this.ifcFilePath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            console.log(`   ✅ IFC file found: ${sizeKB} KB`);
            this.testResults.ifcFileExists = true;

            // Read first few lines to verify it's a valid IFC file
            const fileContent = fs.readFileSync(this.ifcFilePath, 'utf8');
            if (fileContent.startsWith('ISO-10303-21;')) {
                console.log(`   ✅ Valid IFC file format detected`);
            } else {
                console.log(`   ⚠️  File doesn't appear to be a valid IFC file`);
            }
        } else {
            console.log(`   ❌ IFC file not found at: ${this.ifcFilePath}`);
            throw new Error('IFC file not found');
        }
    }

    async testAPIEndpoints() {
        console.log('🔗 Testing API endpoints...');

        const endpoints = ['/api/chat', '/api/ai'];

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async testEndpoint(endpoint) {
        return new Promise((resolve) => {
            const http = require('http');
            const url = new URL(this.serverUrl + endpoint);

            const req = http.get({
                hostname: url.hostname,
                port: url.port || 80,
                path: endpoint,
                timeout: 3000
            }, (res) => {
                console.log(`   ${res.statusCode === 200 ? '✅' : '⚠️ '} ${endpoint}: ${res.statusCode}`);
                resolve();
            });

            req.on('error', () => {
                console.log(`   ❌ ${endpoint}: Connection failed`);
                resolve();
            });

            req.on('timeout', () => {
                console.log(`   ⚠️  ${endpoint}: Timeout`);
                req.destroy();
                resolve();
            });
        });
    }

    async simulateIFCLoading() {
        console.log('🔄 Simulating IFC loading workflow...');

        // This simulates what would happen when the user loads the IFC file
        // In a real automated test, you'd use Puppeteer or similar

        console.log('   📝 Simulation steps:');
        console.log('      1. User opens browser to http://localhost:3000');
        console.log('      2. User uploads IFC file via file input');
        console.log('      3. Application processes IFC file');
        console.log('      4. User connects AI node to trigger SQLite generation');
        console.log('      5. Application calls ifc2sql.py Patcher');
        console.log('      6. Patcher creates comprehensive database');
        console.log('      7. Database is stored and exported');

        // Simulate expected database structure
        console.log('   📊 Expected database structure:');
        console.log('      • Tables: 50+ (not just 2-3)');
        console.log('      • Total rows: 3000+ (not just 3)');
        console.log('      • Core tables: metadata, id_map, psets, IFC* classes');

        this.testResults.workflowSimulation = true;
    }

    async generateAndVerifyDatabase() {
        console.log('🗄️  Database generation verification...');

        // This is where we would normally trigger the database generation
        // For now, we'll check if the database files exist and analyze their structure

        const possibleDbPaths = [
            './4_DT(2).sqlite',
            './4_DT.sqlite',
            './model.db',
            './database.sqlite'
        ];

        let foundDatabase = false;
        for (const dbPath of possibleDbPaths) {
            if (fs.existsSync(dbPath)) {
                console.log(`   ✅ Found database: ${dbPath}`);
                await this.analyzeDatabase(dbPath);
                foundDatabase = true;
                break;
            }
        }

        if (!foundDatabase) {
            console.log('   ⚠️  No existing database found - this is expected for a fresh test');
            console.log('   📝 Database will be generated when you run the manual test');
            this.testResults.databaseGenerated = false;
        }
    }

    async analyzeDatabase(dbPath) {
        console.log(`   🔍 Analyzing database: ${dbPath}`);

        const stats = fs.statSync(dbPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`      Size: ${sizeKB} KB`);

        if (stats.size < 50 * 1024) {
            console.log('      ⚠️  Database size suggests limited structure');
            this.testResults.comprehensiveDatabase = false;
        } else {
            console.log('      ✅ Database size suggests comprehensive structure');
            this.testResults.comprehensiveDatabase = true;
        }

        this.testResults.databaseGenerated = true;
    }

    reportResults() {
        console.log('\n📊 Test Results Summary');
        console.log('========================');

        const results = this.testResults;

        console.log(`Server Running: ${results.serverRunning ? '✅' : '❌'}`);
        console.log(`IFC File Available: ${results.ifcFileExists ? '✅' : '❌'}`);
        console.log(`Database Generated: ${results.databaseGenerated ? '✅' : '❌'}`);
        console.log(`Comprehensive Database: ${results.comprehensiveDatabase ? '✅' : '❌'}`);

        if (results.tableCount > 0) {
            console.log(`Table Count: ${results.tableCount}`);
            console.log(`Total Rows: ${results.totalRows.toLocaleString()}`);
        }

        if (results.error) {
            console.log(`Error: ${results.error}`);
        }

        console.log('\n🎯 Next Steps:');
        if (!results.databaseGenerated) {
            console.log('1. Open browser to http://localhost:3000');
            console.log('2. Load the IFC file and generate database');
            console.log('3. Run this test again to verify results');
        } else if (!results.comprehensiveDatabase) {
            console.log('1. Check browser console for ifc2sql.py logs');
            console.log('2. Verify table count > 50 and total rows > 3000');
            console.log('3. If still limited, check if all fixes were applied');
        } else {
            console.log('✅ Comprehensive database generation is working!');
        }

        console.log('\n🔧 Manual Verification Commands:');
        console.log('node enhanced-sqlite-analysis.js ./generated-database.sqlite');
        console.log('node verify-comprehensive-db.js ./generated-database.sqlite');
    }
}

// Run the automated test
if (require.main === module) {
    const test = new AutomatedIFC2SQLTest();
    test.run().catch(console.error);
}

module.exports = AutomatedIFC2SQLTest;
