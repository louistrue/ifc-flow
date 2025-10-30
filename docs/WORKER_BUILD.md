# Unified Worker Build Instructions

## Overview

The unified TypeScript worker (`lib/workers/core/worker-main.ts`) consolidates all worker functionality into a modular, maintainable architecture.

## Building the Worker

### Prerequisites

Install esbuild:
```bash
npm install --save-dev esbuild
```

### Build Command

```bash
npm run build:worker
```

This will create `public/ifcWorker-unified.js`

### Manual Build

If you prefer to build manually:

```bash
npx esbuild lib/workers/core/worker-main.ts \
  --bundle \
  --platform=browser \
  --target=es2017 \
  --format=iife \
  --outfile=public/ifcWorker-unified.js \
  --banner:js='/* global importScripts */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js");
importScripts("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js");'
```

## Enabling the Unified Worker

### Option 1: Environment Variable

Set the environment variable before running:
```bash
NEXT_PUBLIC_USE_UNIFIED_WORKER=true npm run dev
```

### Option 2: Update Default Path

Edit `lib/ifc/client/ifc-worker-client.ts`:
```typescript
const defaultPath = '/ifcWorker-unified.js' // Change from '/ifcWorker.js'
```

## Architecture

- **Core**: Router, state management, main entry point
- **Handlers**: Modular handlers for each operation
- **Shared**: Managers for Pyodide, SQLite, IndexedDB
- **Types**: Type-safe message protocol

## Testing

After building, test the unified worker:
1. Build: `npm run build:worker`
2. Enable: Set `NEXT_PUBLIC_USE_UNIFIED_WORKER=true`
3. Run: `npm run dev`
4. Test: Load IFC files and verify all operations work
5. Verify: Check browser console for any errors

## Troubleshooting

### Build Fails
- Ensure esbuild is installed: `npm install --save-dev esbuild`
- Check TypeScript errors: `npm run build`
- Verify all imports resolve correctly

### Worker Not Loading
- Check browser console for errors
- Verify `public/ifcWorker-unified.js` exists
- Check network tab for 404 errors
- Ensure worker path is correct

### Runtime Errors
- Check browser console for detailed error messages
- Verify all handlers are registered correctly
- Check that Pyodide and sql.js load correctly
- Review handler-specific error messages

## Migration Checklist

- [ ] Build unified worker
- [ ] Test with development environment
- [ ] Verify all operations work
- [ ] Test with production build
- [ ] Update default worker path
- [ ] Remove legacy worker code
- [ ] Update documentation

