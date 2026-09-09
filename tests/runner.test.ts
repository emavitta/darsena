import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Runner, active } from '../desktop/runner.js'
import { listWorktrees } from '../desktop/git.js'
import { listeners } from '../desktop/processes.js'
import { eventually, fixture } from './fixture.js'

test('runner preserves cwd, output and failure status for a command', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  const runner = new Runner()
  t.after(() => runner.shutdown())
  const tree = (await listWorktrees(f.root)).find((w) => w.path === f.linked)!
  const run = runner.start(
    f.project,
    tree,
    {
      id: 'test',
      name: 'Test command',
      folder: '.',
      kind: 'custom',
      available: true,
      command: process.execPath,
      args: [
        '-e',
        'console.log(process.cwd());process.stderr.write("expected failure");process.exitCode=7',
      ],
    },
    f.linked,
  )
  await eventually(() => !active(runner.list()[0]!))
  assert.equal(runner.list()[0]!.status, 'failed')
  assert.equal(runner.list()[0]!.exitCode, 7)
  assert.match(runner.logs(run.id), /expected failure/)
  assert.ok(runner.logs(run.id).includes(f.linked))
})
test('stop and shutdown terminate managed server descendants and release listening ports', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  const runner = new Runner()
  t.after(() => runner.shutdown())
  const tree = (await listWorktrees(f.root))[0]!
  await writeFile(
    path.join(f.root, 'parent.mjs'),
    `import {spawn} from 'node:child_process';spawn(process.execPath,['server.mjs'],{stdio:'inherit'});setInterval(()=>{},1000);`,
  )
  const task = {
    id: 'server',
    name: 'Server',
    folder: '.',
    kind: 'custom' as const,
    available: true,
    command: process.execPath,
    args: ['parent.mjs'],
  }
  const run = runner.start(f.project, tree, task, f.root)
  await eventually(() => runner.logs(run.id).includes('Ready at'))
  const port = Number(runner.logs(run.id).match(/127\.0\.0\.1:(\d+)/)?.[1])
  assert.ok((await listeners()).some((l) => l.port === port))
  await runner.stop(run.id)
  assert.equal(runner.list()[0]!.status, 'stopped')
  assert.ok(!(await listeners()).some((l) => l.port === port))
  const next = runner.start(f.project, tree, task, f.root)
  await eventually(() => runner.logs(next.id).includes('Ready at'))
  await runner.shutdown()
  assert.ok(runner.list().every((r) => !active(r)))
  assert.throws(() => runner.start(f.project, tree, task, f.root), /shutting down/)
})
