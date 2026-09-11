import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixture } from './fixture.js'
import { gitState, gitAction } from '../desktop/git-actions.js'
import { WorkspaceService } from '../desktop/workspace.js'
import { Store } from '../desktop/store.js'

async function setup() {
  const f = await fixture()
  const remote = path.join(f.directory, 'remote.git')
  const publisher = path.join(f.directory, 'publisher')
  await f.git(['init', '--bare', remote])
  await f.git(['remote', 'add', 'origin', remote])
  await f.git(['push', '-u', 'origin', 'main', 'feat/harbor-view'])
  await f.git(['clone', '--branch', 'main', remote, publisher])
  await f.git(['config', 'user.name', 'Publisher'], publisher)
  await f.git(['config', 'user.email', 'publisher@example.invalid'], publisher)
  await f.git(['config', 'core.hooksPath', '/dev/null'], publisher)
  async function publish(branch = 'main') {
    await f.git(['checkout', branch], publisher)
    await writeFile(path.join(publisher, 'remote-change.txt'), `${branch}\n`)
    await f.git(['add', '.'], publisher)
    await f.git(['commit', '-m', 'remote update'], publisher)
    await f.git(['push'], publisher)
  }
  const act = async (worktree: string, action: 'fetch' | 'pull') => {
    const state = await gitState(worktree)
    return gitAction(worktree, action, state.head, state.branch)
  }
  return { ...f, publish, act }
}

test('Git overview associates branches with worktrees; fetch changes refs, pull changes only selected checkout', async () => {
  const f = await setup()
  try {
    const initial = await gitState(f.root)
    assert.equal(initial.upstream, 'origin/main')
    assert.equal(initial.behind, 0)
    assert.deepEqual(initial.branches.find(b => b.name === 'feat/harbor-view' && b.local)?.worktrees, [f.linked])
    await f.publish()
    const fetched = await f.act(f.linked, 'fetch')
    assert.equal(fetched.state.head, initial.head)
    assert.equal((await gitState(f.root)).behind, 1)
    await f.act(f.root, 'pull')
    assert.notEqual((await gitState(f.root)).head, initial.head)
    assert.equal((await gitState(f.linked)).head, initial.head)
    await f.publish('feat/harbor-view')
    await f.act(f.linked, 'pull')
    assert.equal((await gitState(f.linked)).behind, 0)
    assert.equal((await gitState(f.linked)).branch, 'feat/harbor-view')
  } finally { await f.cleanup() }
})

test('Pull refuses dirty, stale, detached and in-progress checkouts without stashing or changing HEAD', async () => {
  const f = await setup()
  try {
    const initial = await gitState(f.root)
    await f.publish()
    await writeFile(path.join(f.root, 'untracked.txt'), 'local')
    await assert.rejects(f.act(f.root, 'pull'), /local changes/)
    assert.equal((await gitState(f.root)).head, initial.head)
    await f.git(['clean', '-f'])
    await assert.rejects(gitAction(f.root, 'pull', '0'.repeat(40), initial.branch), /changed/)
    await writeFile(path.join(f.root, '.git/MERGE_HEAD'), initial.head)
    await assert.rejects(f.act(f.root, 'pull'), /operation is in progress/)
    await f.git(['merge', '--abort'])
    await f.git(['checkout', '--detach'])
    await assert.rejects(f.act(f.root, 'pull'), /detached/)
    assert.equal((await f.git(['stash', 'list'])).stdout, '')
  } finally { await f.cleanup() }
})

test('Pull never merges diverged branches, even with auto-stash and rebase preferences', async () => {
  const f = await setup()
  try {
    await f.git(['config', 'pull.rebase', 'true'])
    await f.git(['config', 'merge.autoStash', 'true'])
    await f.publish()
    await writeFile(path.join(f.root, 'local.txt'), 'local commit')
    await f.git(['add', '.'])
    await f.git(['commit', '-m', 'local update'])
    const before = await gitState(f.root)
    await assert.rejects(f.act(f.root, 'pull'), /fast-forward|diverg/i)
    const after = await gitState(f.root)
    assert.equal(after.head, before.head)
    assert.equal(after.ahead, 1)
    assert.equal(after.behind, 1)
    assert.equal(after.operation, undefined)
  } finally { await f.cleanup() }
})

test('Git service validates worktree membership and prevents pull with managed tasks', async () => {
  const f = await setup()
  try {
    const store = new Store(path.join(f.directory, 'data'))
    store.state.projects = [f.project]
    const service = new WorkspaceService(store)
    await assert.rejects(service.gitState(f.project.id, f.directory), /no longer available/)
    const state = await service.gitState(f.project.id, f.root)
    service.runner.list = () => [{ worktree: f.root, status: 'running' }] as any
    await assert.rejects(service.gitAction({ projectId: f.project.id, worktree: f.root, action: 'pull', expectedHead: state.head, expectedBranch: state.branch }), /Stop the tasks/)
  } finally { await f.cleanup() }
})
