import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
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

await build({ entryPoints: ['desktop/android-entry.ts'], bundle: true, platform: 'node', target: 'node24', format: 'esm', outfile: 'dist-electron/android-entry.js' })

await build({ entryPoints: ['desktop/adb-entry.ts'], bundle: true, platform: 'node', target: 'node24', format: 'esm', outfile: 'dist-electron/adb-entry.js' })

await build({ entryPoints: ['desktop/logcat-entry.ts'], bundle: true, platform: 'node', target: 'node24', format: 'esm', outfile: 'dist-electron/logcat-entry.js' })
