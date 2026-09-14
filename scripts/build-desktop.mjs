import { desktopBuildOptions } from './desktop-build-options.mjs'
import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
await mkdir('dist-electron', { recursive: true })
await build({
  entryPoints: ['desktop/main.ts'],
  ...desktopBuildOptions,
  external: ['electron'],
  outfile: 'dist-electron/main.js',
  sourcemap: true,
})
await copyFile('desktop/preload.cjs', 'dist-electron/preload.cjs')

await build({ entryPoints: ['desktop/android-entry.ts'], ...desktopBuildOptions, outfile: 'dist-electron/android-entry.js' })

await build({ entryPoints: ['desktop/adb-entry.ts'], ...desktopBuildOptions, outfile: 'dist-electron/adb-entry.js' })

await build({ entryPoints: ['desktop/logcat-entry.ts'], ...desktopBuildOptions, outfile: 'dist-electron/logcat-entry.js' })
