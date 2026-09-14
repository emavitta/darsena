import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { desktopBuildOptions } from '../scripts/desktop-build-options.mjs'
import { fixture } from './fixture.js'

test('packaged ESM dependencies can require Node built-ins without opening Electron', async t => {
  const f = await fixture(); t.after(f.cleanup)
  await mkdir(path.join(f.root,'packages','app'),{recursive:true})
  await writeFile(path.join(f.root,'pnpm-workspace.yaml'),"packages: ['packages/*']\n")
  await writeFile(path.join(f.root,'packages','app','package.json'),'{"name":"example"}')
  const outfile=path.join(f.directory,'workspace-bundle.mjs')
  await build({ ...desktopBuildOptions, entryPoints:['desktop/workspace-folders.ts'], outfile })
  const code=`const m=await import(${JSON.stringify(pathToFileURL(outfile).href)});console.log(JSON.stringify(await m.discoverWorkspaceFolders(${JSON.stringify(f.root)})))`
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',code])
  assert.equal(JSON.parse(stdout).folders[0].name,'example')
})
