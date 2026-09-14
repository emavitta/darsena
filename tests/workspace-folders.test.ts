import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import path from 'node:path'
import { fixture } from './fixture.js'
import { discoverWorkspaceFolders } from '../desktop/workspace-folders.js'

test('workspace discovery uses pnpm patterns/exclusions, counts scripts and skips symlinks', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  for (const name of ['one', 'two', 'skip']) {
    await mkdir(path.join(f.root, 'packages', name), { recursive: true })
    await writeFile(
      path.join(f.root, 'packages', name, 'package.json'),
      JSON.stringify({ name: '@test/' + name, scripts: { dev: 'node app', bad: 3 } }),
    )
  }
  await symlink(f.linked, path.join(f.root, 'packages', 'external'))
  await writeFile(
    path.join(f.root, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n  - '!packages/skip'\n",
  )
  const report = await discoverWorkspaceFolders(f.root)
  assert.deepEqual(
    report.folders.map((f) => f.path),
    ['packages/one', 'packages/two'],
  )
  assert.equal(report.folders[0]!.taskCount, 1)
  assert.equal(report.source, 'pnpm-workspace.yaml')
  assert.equal((await discoverWorkspaceFolders(f.linked)).source, undefined)
  await writeFile(path.join(f.root, 'pnpm-workspace.yaml'), "packages: ['../*']")
  await assert.rejects(discoverWorkspaceFolders(f.root), /inside/)
  await writeFile(path.join(f.root, 'pnpm-workspace.yaml'), 'packages: wrong')
  await assert.rejects(discoverWorkspaceFolders(f.root), /Invalid/)
})

test('npm/Yarn/Bun workspace formats, missing manifests, malformed config and external manifests', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  await mkdir(path.join(f.root, 'apps', 'web'), { recursive: true })
  await writeFile(path.join(f.root, 'apps', 'web', 'package.json'), '{"name":"web"}')
  for (const workspaces of [['apps/*'], { packages: ['apps/*'] }]) {
    await writeFile(path.join(f.root, 'package.json'), JSON.stringify({ workspaces }))
    assert.deepEqual((await discoverWorkspaceFolders(f.root)).folders, [
      { path: 'apps/web', name: 'web', taskCount: 0 },
    ])
  }
  await writeFile(path.join(f.root, 'pnpm-workspace.yaml'), 'packages: []')
  assert.equal((await discoverWorkspaceFolders(f.root)).folders.length, 0)
  await rm(path.join(f.root, 'pnpm-workspace.yaml'))
  await rm(path.join(f.root, 'apps', 'web', 'package.json'))
  await symlink(
    path.join(f.linked, 'package.json'),
    path.join(f.root, 'apps', 'web', 'package.json'),
  )
  const report = await discoverWorkspaceFolders(f.root)
  assert.equal(report.folders.length, 0)
  assert.equal(report.warnings.length, 1)
})
