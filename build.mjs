import { build } from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: ['src/background.ts', 'src/content.ts', 'src/sidepanel.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome138',
})

cpSync('manifest.json', 'dist/manifest.json')
cpSync('sidepanel.html', 'dist/sidepanel.html')
cpSync('icons', 'dist/icons', { recursive: true })
