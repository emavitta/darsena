// Bundles the Linux headless spike into one self-contained file: scp it to a
// server with Node >= 22 and run it there, no install. See docs/linux-feasibility.md.
import { desktopBuildOptions } from './desktop-build-options.mjs'
import { build } from 'esbuild'

await build({
  entryPoints: ['desktop/headless-spike.ts'],
  ...desktopBuildOptions,
  // The lab server runs Node 22 (the app itself bundles for Electron's 24).
  target: 'node22',
  outfile: 'dist-spike/darsena-spike.mjs',
})
console.log('dist-spike/darsena-spike.mjs')
