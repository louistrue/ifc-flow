#!/usr/bin/env node

/**
 * Test script to verify that the full IFC database is being generated
 * with all tables and comprehensive data after the recent changes.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function testDatabaseGeneration(dbPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(dbPath)) {
            console.error(`❌ Database file not found: ${dbPath}`);
            reject(new Error('Database file not found'));
            return;
        }

        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err);
                reject(err);
                return;
            }

            console.log(`✅ Successfully opened database: ${dbPath}`);
            console.log('');

            // Test 1: Check for metadata table
            db.get("SELECT * FROM metadata", (err, row) => {
                if (err) {
                    console.log('❌ Metadata table not found - using fallback database');
                } else {
                    console.log('✅ Metadata table found:');
                    console.log(`   - Preprocessor: ${row.preprocessor}`);
                    console.log(`   - Schema: ${row.schema}`);
                    console.log(`   - MVD: ${row.mvd}`);
                }
                console.log('');

                // Test 2: Count total tables
                db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
                    if (err) {
                        console.error('❌ Error listing tables:', err);
                        db.close();
                        reject(err);
                        return;
                    }

                    console.log(`📊 Total tables in database: ${tables.length}`);

                    if (tables.length < 10) {
                        console.log('⚠️  WARNING: Only fallback tables present (expected 50+ for full schema)');
                        console.log('   Found tables:', tables.map(t => t.name).join(', '));
                    } else {
                        console.log('✅ Full schema database detected');

                        // Group tables by category
                        const ifcTables = tables.filter(t => t.name.startsWith('Ifc'));
                        const systemTables = tables.filter(t => !t.name.startsWith('Ifc'));

                        console.log(`   - IFC entity tables: ${ifcTables.length}`);
                        console.log(`   - System tables: ${systemTables.length}`);

                        // Show sample of IFC tables
                        const sampleTables = ifcTables.slice(0, 10);
                        console.log(`   - Sample IFC tables: ${sampleTables.map(t => t.name).join(', ')}...`);
                    }
                    console.log('');

                    // Test 3: Check for essential tables
                    const essentialTables = [
                        'id_map',
                        'metadata',
                        'psets',
                        // Note: geometry and shape tables are not created when should_get_geometry=False
                        'IfcProject',
                        'IfcBuilding',
                        'IfcBuildingStorey',
                        'IfcWall',
                        'IfcSlab',
                        'IfcColumn',
                        'IfcBeam',
                        'IfcDoor',
                        'IfcWindow',
                        'IfcSpace',
                        'IfcPropertySet',
                        'IfcRelDefinesByProperties',
                        'IfcMaterial',
                        'IfcMaterialLayer',
                        'IfcMaterialLayerSet'
                    ];

                    // Optional tables (may not be present depending on geometry settings)
                    const optionalTables = ['geometry', 'shape'];

                    console.log('🔍 Checking for essential tables:');
                    const tableNames = tables.map(t => t.name);
                    let missingCount = 0;

                    essentialTables.forEach(tableName => {
                        if (tableNames.includes(tableName)) {
                            console.log(`   ✅ ${tableName}`);
                        } else {
                            console.log(`   ❌ ${tableName} (missing)`);
                            missingCount++;
                        }
                    });

                    console.log('\n🔍 Checking for optional tables (geometry):');
                    optionalTables.forEach(tableName => {
                        if (tableNames.includes(tableName)) {
                            console.log(`   ✅ ${tableName} (geometry processing enabled)`);
                        } else {
                            console.log(`   ⚪ ${tableName} (geometry processing disabled - normal for Pyodide)`);
                        }
                    });

                    if (missingCount > 0) {
                        console.log(`\n⚠️  Missing ${missingCount} essential tables`);
                    } else {
                        console.log('\n✅ All essential tables present');
                    }
                    console.log('');

                    // Test 4: Check row counts for key tables
                    const checkRowCounts = (tableList, callback) => {
                        const results = {};
                        let pending = tableList.length;

                        if (pending === 0) {
                            callback(results);
                            return;
                        }

                        tableList.forEach(tableName => {
                            db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
                                if (!err && row) {
                                    results[tableName] = row.count;
                                }
                                pending--;
                                if (pending === 0) {
                                    callback(results);
                                }
                            });
                        });
                    };

                    const tablesToCheck = tableNames.filter(name =>
                        essentialTables.includes(name) && tableNames.includes(name)
                    );

                    checkRowCounts(tablesToCheck, (rowCounts) => {
                        console.log('📈 Row counts for key tables:');
                        let totalRows = 0;
                        Object.entries(rowCounts).forEach(([table, count]) => {
                            if (count > 0) {
                                console.log(`   - ${table}: ${count} rows`);
                                totalRows += count;
                            }
                        });
                        console.log(`   Total rows: ${totalRows}`);
                        console.log('');

                        // Final assessment
                        console.log('═══════════════════════════════════════');
                        console.log('ASSESSMENT:');

                        if (tables.length >= 50 && missingCount === 0) {
                            console.log('✅ FULL DATABASE GENERATED SUCCESSFULLY!');
                            console.log('   The ifc2sql.py is now generating a comprehensive database');
                            console.log('   with all IFC entity tables and complete data.');
                            console.log('   Note: Geometry tables are disabled for Pyodide compatibility.');
                        } else if (tables.length >= 20) {
                            console.log('⚠️  PARTIAL DATABASE GENERATED');
                            console.log('   Some IFC tables are present but not all expected tables.');
                            console.log('   This may be normal if the IFC file has limited entity types.');
                        } else {
                            console.log('❌ FALLBACK DATABASE ONLY');
                            console.log('   Only the minimal fallback tables were created.');
                            console.log('   The full ifc2sql.py processing may have failed.');
                            console.log('');
                            console.log('   Troubleshooting:');
                            console.log('   1. Check browser console for Python errors');
                            console.log('   2. Verify ifc2sql.py loaded correctly');
                            console.log('   3. Check that full_schema=True in all locations');
                            console.log('   4. Ensure Pyodide environment is stable');
                            console.log('   5. Try with a different IFC file');
                        }
                        console.log('═══════════════════════════════════════');

                        db.close(() => {
                            resolve();
                        });
                    });
                });
            });
        });
    });
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node test-full-database-generation.js <path-to-sqlite-db>');
        console.log('');
        console.log('Example:');
        console.log('  node test-full-database-generation.js ./model.db');
        console.log('');
        console.log('This script will analyze the SQLite database and report whether');
        console.log('the full comprehensive database was generated or just the fallback.');
        process.exit(1);
    }

    const dbPath = path.resolve(args[0]);

    console.log('═══════════════════════════════════════');
    console.log('IFC2SQL DATABASE GENERATION TEST');
    console.log('═══════════════════════════════════════');
    console.log('');

    try {
        await testDatabaseGeneration(dbPath);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

main();
