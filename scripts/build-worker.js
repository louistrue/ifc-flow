/**
 * Build script for unified TypeScript worker
 * Uses tsc to compile worker TypeScript files
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

async function buildWorker() {
  try {
    console.log('Building unified TypeScript worker...')

    // Create output directory
    const outputDir = path.join(__dirname, 'public')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Create a temporary tsconfig for worker compilation
    const workerTsConfig = {
      compilerOptions: {
        target: 'ES2017',
        module: 'ESNext',
        lib: ['ES2017'],
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: './public',
        rootDir: './lib/workers',
        declaration: false,
        sourceMap: false,
      },
      include: ['lib/workers/**/*.ts'],
      exclude: ['node_modules'],
    }

    const tsConfigPath = path.join(__dirname, 'tsconfig.worker.json')
    fs.writeFileSync(tsConfigPath, JSON.stringify(workerTsConfig, null, 2))

    // For now, we'll create a simple bundler that concatenates the files
    // In production, you'd use a proper bundler like esbuild or webpack
    console.log('⚠️  Worker build script created. Manual bundling required.')
    console.log('📝 Next steps:')
    console.log('   1. Install esbuild: npm install --save-dev esbuild')
    console.log('   2. Use scripts/build-worker-esbuild.js for automated builds')
    console.log('   3. Or manually bundle using: npx esbuild lib/workers/core/worker-main.ts --bundle --platform=browser --format=iife --outfile=public/ifcWorker-unified.js')

    // Clean up temp config
    fs.unlinkSync(tsConfigPath)

    console.log('✅ Build script ready')
  } catch (error) {
    console.error('❌ Failed to setup build:', error)
    process.exit(1)
  }
}

buildWorker()
