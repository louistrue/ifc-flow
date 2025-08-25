#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking IFC2SQL Database Progress');
console.log('=====================================');

// Check for database files
const possibleDbPaths = [
    './4_DT(2).sqlite',
    './4_DT.sqlite',
    './model.db',
    './database.sqlite',
    './public/4_DT(2).sqlite'
];

let foundDatabase = false;
let dbPath = null;

for (const testPath of possibleDbPaths) {
    if (fs.existsSync(testPath)) {
        console.log(`✅ Found database: ${testPath}`);
        dbPath = testPath;
        foundDatabase = true;
        break;
    }
}

if (!foundDatabase) {
    console.log('❌ No database files found');
    console.log('\n📝 Generate a database first:');
    console.log('   1. Open http://localhost:3000');
    console.log('   2. Load the IFC file');
    console.log('   3. Use AI node to generate SQLite database');
    process.exit(1);
}

// Analyze the database
const stats = fs.statSync(dbPath);
const sizeKB = (stats.size / 1024).toFixed(2);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`📊 Database Statistics:`);
console.log(`   Size: ${sizeKB} KB (${sizeMB} MB)`);
console.log(`   Modified: ${stats.mtime.toISOString()}`);

// Assess database quality
if (stats.size < 50 * 1024) {
    console.log('\n⚠️  WARNING: Database appears to be limited!');
    console.log('   Expected: 100KB+ for comprehensive IFC database');
    console.log('   Current: Only ' + sizeKB + ' KB');

    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Open browser Developer Tools (F12)');
    console.log('   2. Check Console tab for ifc2sql.py logs');
    console.log('   3. Look for messages like:');
    console.log('      • "Python: Using official ifc2sql.py Patcher from module"');
    console.log('      • "Python: Created X tables" (where X > 50)');
    console.log('      • "Python: Total rows across all tables: Y" (where Y > 3000)');

    console.log('\n   4. If you see "Python: Using ifcpatch" instead, the Patcher failed');
    console.log('   5. If table count is still low, the IndexedDB cache needs clearing');

} else {
    console.log('\n✅ Database size looks good for comprehensive IFC data!');
    console.log('   This suggests the comprehensive database was generated successfully.');

    console.log('\n🔍 To verify the structure, run:');
    console.log('   node enhanced-sqlite-analysis.js ' + dbPath);
}

// Check if there's a newer database that might have been generated
console.log('\n🔄 Checking for newer database files...');
const allDbFiles = possibleDbPaths
    .filter(p => fs.existsSync(p))
    .map(p => ({
        path: p,
        stats: fs.statSync(p),
        size: fs.statSync(p).size
    }))
    .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

if (allDbFiles.length > 1) {
    console.log('📁 Found multiple database files:');
    allDbFiles.forEach((file, index) => {
        const sizeKB = (file.size / 1024).toFixed(2);
        const time = file.stats.mtime.toISOString();
        console.log(`   ${index + 1}. ${file.path} (${sizeKB} KB, ${time})`);
    });
}

console.log('\n🎯 Expected Results in Browser Console:');
console.log('   Python: Enhanced Ifc2Sql integration starting...');
console.log('   Python: Using official ifc2sql.py Patcher from module');
console.log('   Python: Patcher-based SQLite creation completed: True');
console.log('   Python: Created 58 tables');
console.log('   Python: Table metadata: 1 rows');
console.log('   Python: Table id_map: 3268 rows');
console.log('   Python: Total rows across all tables: 8000 rows');
