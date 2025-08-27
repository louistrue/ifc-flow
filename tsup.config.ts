import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['workers/ifc/src/index.ts'],
  outDir: 'public',
  format: ['iife'],
  globalName: 'IfcWorkerBundle',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  clean: false,
  shims: false,
  // Ensure deterministic file name for worker bundle
  // The IIFE output will be index.global.js; we'll rename after build in script
});