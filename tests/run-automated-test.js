#!/usr/bin/env node

// Quick automated test runner
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Running Automated IFC2SQL Test');
console.log('==================================');

// Run the automated test
const testProcess = spawn('node', [path.join(__dirname, 'automated-ifc2sql-test.js')], {
    stdio: 'inherit',
    cwd: __dirname
});

testProcess.on('close', (code) => {
    console.log(`\n🏁 Automated test completed with exit code: ${code}`);
    if (code === 0) {
        console.log('✅ Test passed - all prerequisites are ready!');
        console.log('\n📝 Next: Open your browser and test the actual workflow:');
        console.log('   1. Go to http://localhost:3000');
        console.log('   2. Load the IFC file');
        console.log('   3. Generate SQLite database');
        console.log('   4. Check browser console for comprehensive database logs');
    } else {
        console.log('❌ Test failed - check the output above for issues');
    }
});

testProcess.on('error', (error) => {
    console.error('❌ Failed to start automated test:', error);
});
