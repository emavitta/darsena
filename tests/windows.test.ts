import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fixture, eventually } from './fixture.js'
import { command } from '../desktop/io.js'
import { Runner, active } from '../desktop/runner.js'
import { listWorktrees } from '../desktop/git.js'
import { windowsInvocation } from '../desktop/windows-command.js'
import { taskHost } from '../desktop/platform.js'
import { TaskDiscovery } from '../desktop/tasks.js'
import { windowsOpenArgs } from '../desktop/launchers.js'
import { powershell } from '../desktop/windows-system.js'

const windows = process.platform === 'win32'
test(
  'Windows terminal opens the exact folder, including apostrophes and spaces',
  { skip: !windows },
  async (t) => {
    const f = await fixture()
    t.after(f.cleanup)
    assert.deepEqual(windowsOpenArgs('vscode', 'Code.exe', f.root), [f.root])
    assert.deepEqual(windowsOpenArgs('android-studio', 'studio64.exe', f.root), [f.root])
    assert.deepEqual(windowsOpenArgs('terminal', 'wt.exe', f.root), ['-d', f.root])
    const args = windowsOpenArgs('terminal', powershell, f.root).filter((arg) => arg !== '-NoExit')
    const script = Buffer.from(args.at(-1)!, 'base64').toString('utf16le') + '; (Get-Location).Path'
    args[args.length - 1] = Buffer.from(script, 'utf16le').toString('base64')
    assert.equal((await command(powershell, args)).trim(), f.root)
  },
)
test(
  'Windows native and batch arguments stay literal, including spaces, Unicode and shell metacharacters',
  { skip: !windows },
  async (t) => {
    const f = await fixture()
    t.after(f.cleanup)
    const values = [
      'hello world',
      'é Milano',
      '',
      'a&b',
      'x|y',
      '%PATH%',
      '!bang!',
      'a"b',
      'trailing\\',
      '(test)',
      'semi;colon',
    ]
    await writeFile(
      path.join(f.root, 'args.mjs'),
      'console.log(JSON.stringify(process.argv.slice(2)))',
    )
    assert.deepEqual(JSON.parse(await command('node', ['args.mjs', ...values], f.root)), values)
    await writeFile(path.join(f.root, 'run check.cmd'), '@echo off\r\nnode "%~dp0args.mjs" %*\r\n')
    assert.deepEqual(JSON.parse(await command('./run check.cmd', values, f.root)), values)
    await writeFile(path.join(f.root, 'run check.bat'), '@echo off\r\nnode "%~dp0args.mjs" %*\r\n')
    assert.deepEqual(JSON.parse(await command('./run check.bat', ['two words', 'a&b'], f.root)), [
      'two words',
      'a&b',
    ])
    await assert.rejects(
      command('./run check.cmd', ['safe\r\necho unwanted'], f.root),
      /single lines/,
    )
    assert.match(await command('npm', ['run', 'check'], f.root), /Check completed/)
    assert.match(await command('pnpm', ['run', 'check'], f.root), /Check completed/)
  },
)

test(
  'Windows Gradle discovery uses the batch wrapper and does not leave a new daemon',
  { skip: !windows },
  async (t) => {
    const f = await fixture()
    t.after(f.cleanup)
    await writeFile(
      path.join(f.root, 'gradlew.bat'),
      '@echo off\r\necho %* > wrapper-args.txt\r\necho __DARSENA_TASKS__[{"name":":build","description":"Build fixture"}]\r\n',
    )
    const discovery = new TaskDiscovery()
    assert.ok(
      (await discovery.list(f.project, f.root)).sources.some((source) => source.kind === 'gradle'),
    )
    await discovery.loadGradle(f.root, '.')
    const task = (await discovery.list(f.project, f.root)).tasks.find(
      (entry) => entry.kind === 'gradle',
    )!
    assert.equal(task.command, '.\\gradlew.bat')
    assert.deepEqual(task.args, ['--no-daemon', ':build'])
    assert.match(await readFile(path.join(f.root, 'wrapper-args.txt'), 'utf8'), /--no-daemon/)
  },
)

test(
  'Windows jobs retain orphaned descendants and kill them on Stop or loss of the control pipe',
  { skip: !windows },
  async (t) => {
    const f = await fixture()
    t.after(f.cleanup)
    const runner = new Runner()
    t.after(() => runner.shutdown())
    await writeFile(
      path.join(f.root, 'orphan.mjs'),
      `import {spawn} from 'node:child_process'; const c=spawn(process.execPath,['server.mjs'],{stdio:'inherit'}); c.unref();`,
    )
    const tree = (await listWorktrees(f.root))[0]!
    const task = {
      id: 'orphan',
      name: 'Orphan server',
      folder: '.',
      kind: 'custom' as const,
      available: true,
      command: process.execPath,
      args: ['orphan.mjs'],
    }
    const run = runner.start(f.project, tree, task, f.root)
    await eventually(() => runner.logs(run.id).includes('Child processes remain active'))
    assert.ok(active(runner.list()[0]!))
    const port = Number(runner.logs(run.id).match(/127\.0\.0\.1:(\d+)/)?.[1])
    assert.ok((await runner.ownedProcesses()).size > 0)
    await runner.stop(run.id)
    await assert.rejects(fetch(`http://127.0.0.1:${port}`))
    const invocation = windowsInvocation('node', ['server.mjs'], f.root)
    const host = spawn(
      taskHost,
      ['darsena-test-loss-' + Date.now(), invocation.file, invocation.line],
      { cwd: f.root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    )
    t.after(() => {
      if (host.exitCode === null) host.kill()
    })
    let output = ''
    host.stdout.on('data', (value) => {
      output += value
    })
    await eventually(() => output.includes('Ready at'))
    const nextPort = Number(output.match(/127\.0\.0\.1:(\d+)/)?.[1])
    host.stdin.end() // What happens when the supervising app disappears.
    await eventually(() => host.exitCode !== null)
    await assert.rejects(fetch(`http://127.0.0.1:${nextPort}`))
  },
)
