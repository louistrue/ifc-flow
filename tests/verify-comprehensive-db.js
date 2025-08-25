const fs = require('fs');
const path = require('path');

async function verifyComprehensiveDatabase(dbPath) {
    console.log('🔍 Verifying SQLite Database Structure');
    console.log('═'.repeat(50));

    if (!fs.existsSync(dbPath)) {
        console.error(`❌ Database file not found: ${dbPath}`);
        console.log('\n📝 Usage: node verify-comprehensive-db.js <path-to-database>');
        console.log('Example: node verify-comprehensive-db.js ./downloaded-database.sqlite');
        return;
    }

    console.log(`✅ Database found: ${dbPath}`);

    // This is a simple verification script
    // In a real scenario, you'd use sqlite3 package to query the database
    const stats = fs.statSync(dbPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`📊 Database size: ${sizeKB} KB`);

    if (stats.size < 50 * 1024) { // Less than 50KB suggests limited database
        console.log('⚠️  Database size suggests it might be limited (simple schema)');
        console.log('   Expected: 100KB+ for comprehensive IFC database');
    } else {
        console.log('✅ Database size looks reasonable for comprehensive IFC data');
    }

    console.log('\n🔧 To properly verify the database structure:');
    console.log('   1. Download the .sqlite file from your browser');
    console.log('   2. Run: node enhanced-sqlite-analysis.js ./downloaded-database.sqlite');
    console.log('   3. Look for 50+ tables including:');
    console.log('      • metadata (schema info)');
    console.log('      • id_map (IFC ID mappings)');
    console.log('      • psets (property sets)');
    console.log('      • 50+ IFC class tables (IfcWall, IfcBeam, etc.)');

    console.log('\n🎯 Expected comprehensive database should have:');
    console.log('   • 50+ tables instead of 2-3');
    console.log('   • metadata and id_map tables');
    console.log('   • Relationship tables (RelDefinesByProperties, etc.)');
    console.log('   • Property set data');
    console.log('   • 3,000+ elements instead of just 3');
}

// Get database path from command line
const dbPath = process.argv[2] || './4_DT(2).sqlite';

verifyComprehensiveDatabase(dbPath).catch(console.error);
