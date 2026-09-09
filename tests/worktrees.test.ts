import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, symlink } from 'node:fs/promises'
import path from 'node:path'
import { identifyProject, listWorktrees, matchingWorktree } from '../desktop/git.js'
import { resolveFolder } from '../desktop/io.js'
import { fixture } from './fixture.js'

test('Git discovers linked worktrees regardless of location, with branch and changed state', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  const nested = path.join(f.root, '.agent/worktrees/nested')
  const unusual = path.join(
    f.directory,
    process.platform === 'win32' ? 'with spaces & unicode é' : 'with a\nnewline',
  )
  await f.git(['worktree', 'add', '-b', 'feat/nested', nested])
  await f.git(['worktree', 'add', '--detach', unusual])
  await writeFile(path.join(f.linked, 'a new file.txt'), 'change')
  const trees = await listWorktrees(f.root)
  assert.equal(trees.length, 4)
  assert.equal(trees.find((w) => w.path === f.linked)?.changed, 1)
  assert.equal(trees.find((w) => w.path === unusual)?.branch, null)
  assert.equal(matchingWorktree(trees, path.join(nested, 'android-app'))?.path, nested)
  assert.equal(
    (await identifyProject(path.join(f.linked, 'android-app'))).commonDir,
    f.project.commonDir,
  )
})
test('folder shortcuts resolve in each worktree and cannot escape through traversal or symlinks', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  assert.equal(await resolveFolder(f.linked, 'android-app'), path.join(f.linked, 'android-app'))
  await symlink(f.directory, path.join(f.root, 'outside'), 'junction')
  await assert.rejects(resolveFolder(f.root, '../feature worktree'), /outside/)
  await assert.rejects(resolveFolder(f.root, 'outside'), /outside/)
  await assert.rejects(resolveFolder(f.root, '/tmp'), /inside/)
})
