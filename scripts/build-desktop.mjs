import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
import './build-windows-host.mjs'
await mkdir('dist-electron', { recursive: true })
await build({
  entryPoints: ['desktop/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: ['electron'],
  outfile: 'dist-electron/main.js',
  sourcemap: true,
})
await copyFile('desktop/preload.cjs', 'dist-electron/preload.cjs')
