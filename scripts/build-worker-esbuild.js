/**
 * Build script for unified TypeScript worker using esbuild
 * Compiles lib/workers/core/worker-main.ts and dependencies to public/ifcWorker-unified.js
 */

const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

async function buildWorker() {
  try {
    console.log('🔨 Building unified TypeScript worker...')

    // Check if esbuild is available
    try {
      require.resolve('esbuild')
    } catch (e) {
      console.error('❌ esbuild not found. Install it with: npm install --save-dev esbuild')
      process.exit(1)
    }

    const entryPoint = path.join(__dirname, '../lib/workers/core/worker-main.ts')
    const outputFile = path.join(__dirname, '../public/ifcWorker-unified.js')

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'browser',
      target: 'es2017',
      format: 'iife',
      outfile: outputFile,
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      banner: {
        js: `
/* global importScripts */
// Import Pyodide v0.28.0 (optimal compatibility with ifcopenshell-0.8.4 wheel)
importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js");
// Load sql.js (SQLite WASM)
importScripts("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js");
        `.trim(),
      },
      minify: false, // Keep readable for debugging initially
      sourcemap: false,
      logLevel: 'info',
      external: [
        // These are loaded via importScripts, not bundled
        'https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js',
        'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js',
      ],
    })

    console.log(`✅ Unified worker built successfully: ${outputFile}`)
    console.log('📝 Next steps:')
    console.log('   1. Set NEXT_PUBLIC_USE_UNIFIED_WORKER=true to enable')
    console.log('   2. Or update lib/ifc/client/ifc-worker-client.ts to use it by default')
    console.log('   3. Test thoroughly before removing legacy ifcWorker.js')
  } catch (error) {
    console.error('❌ Failed to build worker:', error)
    process.exit(1)
  }
}

buildWorker()

