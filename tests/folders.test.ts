import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, symlink } from 'node:fs/promises'
import path from 'node:path'
import { browseFolders, folderShortcut } from '../desktop/folders.js'
import { resolveFolder } from '../desktop/io.js'
import { fixture } from './fixture.js'

test('folder browsing stays in the worktree, excludes files and external links, and keeps hidden code folders', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  await mkdir(path.join(f.root, '.config'))
  await mkdir(path.join(f.root, 'shells/native module'), { recursive: true })
  await symlink(f.directory, path.join(f.root, 'external'))
  await symlink('missing', path.join(f.root, 'broken'))
  await symlink('android-app', path.join(f.root, 'android-alias'))
  await symlink('README.md', path.join(f.root, 'file-alias'))
  const listing = await browseFolders(f.root, '.')
  assert.equal(listing.path, '.')
  assert.deepEqual(
    listing.folders.map((entry) => entry.name),
    ['.config', 'android-alias', 'android-app', 'shells'],
  )
  assert.equal(listing.folders.find((entry) => entry.name === 'android-alias')?.path, 'android-app')
  assert.deepEqual(await browseFolders(f.root, 'shells'), {
    path: 'shells',
    folders: [{ name: 'native module', path: 'shells/native module' }],
  })
  assert.deepEqual(await browseFolders(f.root, 'shells/native module'), {
    path: 'shells/native module',
    folders: [],
  })
})

test('browse and save both validate paths, including traversal, prefix siblings, symlinks, files and missing folders', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  const sibling = `${f.root}-other`
  await mkdir(sibling)
  await symlink(sibling, path.join(f.root, 'external'))
  for (const operation of [browseFolders, folderShortcut]) {
    for (const folder of [
      '../harbor-project-other',
      'external',
      f.root,
      'missing',
      'README.md',
      '\0',
    ])
      await assert.rejects(operation(f.root, folder))
  }
  const shortcut = await folderShortcut(f.root, './android-app/../android-app')
  assert.deepEqual(shortcut, { path: 'android-app', label: 'android-app' })
  assert.equal(await resolveFolder(f.linked, shortcut.path), path.join(f.linked, 'android-app'))
})
