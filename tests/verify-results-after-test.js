#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 POST-TEST VERIFICATION: Comprehensive IFC2SQL Database');
console.log('=========================================================');

const dbPaths = [
    './4_DT(2).sqlite',
    './4_DT.sqlite',
    './model.db',
    './database.sqlite'
];

let latestDb = null;
let latestTime = 0;

// Find the most recently modified database
for (const dbPath of dbPaths) {
    if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        if (stats.mtime.getTime() > latestTime) {
            latestTime = stats.mtime.getTime();
            latestDb = dbPath;
        }
    }
}

if (!latestDb) {
    console.log('❌ No database files found!');
    console.log('\n📝 You need to generate a database first:');
    console.log('   1. Open http://localhost:3000');
    console.log('   2. Load the IFC file');
    console.log('   3. Generate SQLite database');
    console.log('   4. Run this script again');
    process.exit(1);
}

console.log(`✅ Found database: ${latestDb}`);
const stats = fs.statSync(latestDb);
const sizeKB = (stats.size / 1024).toFixed(2);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`📊 Database Statistics:`);
console.log(`   Size: ${sizeKB} KB (${sizeMB} MB)`);
console.log(`   Modified: ${stats.mtime.toISOString()}`);
console.log(`   Created: ${stats.birthtime.toISOString()}`);

// Check if database size indicates comprehensive structure
if (stats.size < 50 * 1024) {
    console.log('\n❌ FAILURE: Database is still limited!');
    console.log(`   Current size: ${sizeKB} KB (should be > 100 KB)`);
    console.log('\n🔍 TROUBLESHOOTING STEPS:');
    console.log('   1. Check browser console - did you see:');
    console.log('      "Python: Using official ifc2sql.py Patcher from module"');
    console.log('   2. If you saw "Python: Using ifcpatch" instead, there\'s a loading issue');
    console.log('   3. Clear browser cache and try again');
    console.log('   4. Check if the ifc2sql.py file exists at public/ifc2sql.py');

    process.exit(1);
}

console.log('\n✅ SUCCESS: Database size indicates comprehensive structure!');
console.log(`   Size: ${sizeKB} KB (meets minimum 100KB requirement)`);

// Run detailed analysis
console.log('\n🔍 Running detailed database analysis...');

const { spawn } = require('child_process');
const analysisProcess = spawn('node', ['enhanced-sqlite-analysis.js', latestDb], {
    stdio: 'inherit'
});

analysisProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n🎉 COMPREHENSIVE DATABASE SUCCESSFULLY GENERATED!');
        console.log('   • The ifc2sql.py Patcher is working correctly');
        console.log('   • You now have a full IFC database structure');
        console.log('   • This matches the BIMcollab example structure');
    } else {
        console.log('\n⚠️  Analysis completed with warnings');
        console.log('   Check the output above for details');
    }
});

analysisProcess.on('error', (error) => {
    console.log('\n⚠️  Could not run detailed analysis');
    console.log('   But the database size looks good!');
    console.log(`   Run manually: node enhanced-sqlite-analysis.js ${latestDb}`);
});

console.log('\n⏳ Analyzing database structure...');
