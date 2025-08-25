#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

console.log('🤖 AUTOMATED BROWSER TEST - IFC2SQL Comprehensive Database');
console.log('==========================================================');

async function testIFC2SQLWorkflow() {
    let browser;
    try {
        // Launch browser
        console.log('🚀 Launching browser...');
        browser = await puppeteer.launch({
            headless: false, // Keep visible to see what's happening
            devtools: true,  // Open DevTools
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Enable console logging
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Python:') || text.includes('handleLoadIfc:') || text.includes('Created') || text.includes('tables') || text.includes('rows')) {
                console.log('🔍 BROWSER:', text);
            }
        });

        // Navigate to the application
        console.log('🌐 Navigating to http://localhost:3000...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Wait for the application to load
        await page.waitForTimeout(2000);

        console.log('📁 Looking for file input...');

        // Find and click the file input or upload area
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
            console.log('❌ File input not found. Looking for upload area...');
            // Try to find upload area by text or class
            await page.waitForSelector('[data-testid="file-upload"], .file-upload, .upload-area', { timeout: 5000 });
        }

        // Upload the IFC file
        console.log('📤 Uploading IFC file...');
        const ifcPath = path.resolve('./public/4_DT.ifc');
        if (fileInput) {
            await fileInput.uploadFile(ifcPath);
        }

        // Wait for file processing
        console.log('⏳ Waiting for file processing...');
        await page.waitForTimeout(5000);

        // Look for AI node or trigger SQLite generation
        console.log('🤖 Looking for AI node or SQLite generation trigger...');

        // Try to find and click elements that might trigger SQLite generation
        const possibleTriggers = [
            'button[data-testid="generate-sqlite"]',
            'button:contains("Generate")',
            'button:contains("SQLite")',
            '.ai-node',
            '[data-node-type="ai"]'
        ];

        let triggered = false;
        for (const selector of possibleTriggers) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`🎯 Found trigger: ${selector}`);
                    await element.click();
                    triggered = true;
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        if (!triggered) {
            console.log('⚠️  Could not find automatic trigger. Manual intervention needed.');
            console.log('   Please manually trigger SQLite generation in the browser.');
            console.log('   Waiting 30 seconds for manual action...');
            await page.waitForTimeout(30000);
        } else {
            // Wait for processing
            console.log('⏳ Waiting for SQLite generation...');
            await page.waitForTimeout(10000);
        }

        // Check for success indicators in console
        console.log('✅ Browser test completed. Check console output above for:');
        console.log('   • "Python: Using official ifc2sql.py Patcher from module"');
        console.log('   • "Python: Created XX tables" (should be 50+)');
        console.log('   • "Python: Total rows across all tables: XXXX rows" (should be 3000+)');

    } catch (error) {
        console.error('❌ Browser test failed:', error.message);
    } finally {
        if (browser) {
            console.log('🔚 Closing browser...');
            await browser.close();
        }
    }
}

// Check if puppeteer is available
try {
    require('puppeteer');
    testIFC2SQLWorkflow().then(() => {
        console.log('\n📊 After test completion, run:');
        console.log('   node verify-results-after-test.js');
        process.exit(0);
    });
} catch (e) {
    console.log('❌ Puppeteer not available. Install with: npm install puppeteer');
    console.log('\n🔧 MANUAL TESTING REQUIRED:');
    console.log('   1. Open http://localhost:3000 in browser');
    console.log('   2. Open DevTools → Console');
    console.log('   3. Upload IFC file');
    console.log('   4. Trigger SQLite generation');
    console.log('   5. Watch console for comprehensive database messages');
    console.log('   6. Run: node verify-results-after-test.js');
    process.exit(1);
}
