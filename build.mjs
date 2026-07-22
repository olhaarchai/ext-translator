import { build } from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: ['src/background.ts', 'src/content.ts', 'src/sidepanel.ts', 'src/offscreen.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  // Matches manifest minimum_chrome_version: browsers without the built-in translation
  // APIs (116..137, and Chromium forks) are exactly who the offline engine serves.
  target: 'chrome116',
  // Dead code in the browser: bergamot-translator's Node-compat shim imports this behind
  // a window check; leaving it external keeps the bundler from trying to resolve it.
  external: ['node:worker_threads'],
})

cpSync('manifest.json', 'dist/manifest.json')
cpSync('sidepanel.html', 'dist/sidepanel.html')
cpSync('offscreen.html', 'dist/offscreen.html')
cpSync('icons', 'dist/icons', { recursive: true })
// The engine worker and WASM binary ship inside the package; only model data is ever
// downloaded at run time.
cpSync('node_modules/@browsermt/bergamot-translator/worker', 'dist/worker', { recursive: true })
