import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fixture, eventually } from './fixture.js'
import { configurePreparation } from '../desktop/preparation.js'
import { Store } from '../desktop/store.js'
import { WorkspaceService } from '../desktop/workspace.js'

test('preparation is persisted, runs explicitly in the selected worktree and edits get fresh permissions', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  const store = new Store(path.join(f.directory, 'data'))
  store.state.projects = [f.project]
  const workspace = new WorkspaceService(store)
  t.after(() => workspace.runner.shutdown())
  configurePreparation(f.project, process.execPath, ['-e', 'console.log(process.cwd())'], [])
  const id = f.project.preparationTaskId!
  assert.equal(workspace.runner.list().length, 0)
  await store.save()
  const loaded = new Store(store.directory)
  await loaded.load()
  assert.equal(loaded.project(f.project.id).preparationTaskId, id)
  for (const worktree of [f.root, f.linked]) {
    const started = await workspace.start({ projectId: f.project.id, worktree, taskId: id })
    assert.equal(started.kind, 'started')
    if (started.kind !== 'started') throw new Error('Expected run')
    await eventually(
      () => workspace.runner.list().find((r) => r.id === started.run.id)?.status === 'succeeded',
    )
    assert.ok(workspace.runner.logs(started.run.id).includes(worktree))
  }
  configurePreparation(
    f.project,
    process.execPath,
    ['-e', 'setInterval(()=>{},1000)'],
    workspace.runner.list(),
  )
  assert.notEqual(f.project.preparationTaskId, id)
  assert.ok(!f.project.customTasks.some((t) => t.id === id))
  const current = f.project.preparationTaskId!
  const running = await workspace.start({
    projectId: f.project.id,
    worktree: f.linked,
    taskId: current,
  })
  assert.equal(running.kind, 'started')
  assert.throws(() => configurePreparation(f.project, '', [], workspace.runner.list()), /Stop/)
  assert.equal(
    (await workspace.start({ projectId: f.project.id, worktree: f.linked, taskId: current })).kind,
    'conflict',
  )
  if (running.kind === 'started') await workspace.runner.stop(running.run.id)
  configurePreparation(f.project, '', [], workspace.runner.list())
  assert.equal(f.project.preparationTaskId, undefined)
})
