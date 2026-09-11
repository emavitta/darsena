import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { packageUid, appPids } from '../desktop/logcat-worker.js'
import { filterLogcat } from '../shared/logcat.js'
import { eventually } from './fixture.js'

test('Logcat resolves exact package and user, rejects shared UIDs and follows UID across PIDs', async () => {
  const plan = { adb: 'adb', cwd: '.', serial: 'device', applicationId: 'app.target', user: '10' }
  const run = async (_: string, args: string[]) =>
    args.includes('get-current-user')
      ? '10'
      : 'package:app.target uid:1012345\npackage:app.other uid:1012346'
  assert.equal(await packageUid(plan, run), '1012345')
  await assert.rejects(packageUid({ ...plan, user: '0' }, run), /user changed/)
  await assert.rejects(packageUid({ ...plan, applicationId: 'app.missing' }, run), /not installed/)
  await assert.rejects(
    packageUid(plan, async (_, args) =>
      args.includes('get-current-user')
        ? '10'
        : 'package:app.target uid:1\npackage:app.other uid:1',
    ),
    /shares/,
  )
  assert.deepEqual(
    appPids(
      ' UID PID NAME\n1012345 44 app.target\n1012346 45 app.other\n1012345 46 app.target:service',
      '1012345',
    ),
    [44, 46],
  )
  assert.deepEqual(appPids('1012345 55 app.target', '1012345'), [55])
  const logs = '09-11 12:00:00.000 44 44 I App: ready\n09-11 12:00:01.000 44 44 E App: broken\n'
  assert.ok(!filterLogcat(logs, '', 'E').includes('ready'))
  assert.ok(filterLogcat(logs, 'BROKEN', 'W').includes('broken'))
})

test('Logcat worker streams bounded app output, observes restarts and fails on disconnect', async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'darsena-logcat-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  const adb = path.join(cwd, 'adb')
  await writeFile(path.join(cwd, 'pids'), '10001 40 app.target')
  await writeFile(
    adb,
    `#!${process.execPath}
const fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(path.join(cwd, 'calls'))},JSON.stringify(a)+'\\n');
if(a.includes('get-current-user')) console.log('0');
else if(a.includes('packages')) console.log('package:app.target uid:10001');
else if(a.includes('ps')) { if(fs.existsSync(${JSON.stringify(path.join(cwd, 'offline'))}))process.exit(1);console.log(fs.readFileSync(${JSON.stringify(path.join(cwd, 'pids'))},'utf8')); }
else if(a.includes('logcat')) { console.log('09-11 12:00:00.000 40 40 F AndroidRuntime: FATAL EXCEPTION: main');setInterval(()=>console.log('09-11 12:00:01.000 40 40 I App: alive'),100); }
else process.exit(1);
`,
    { mode: 0o755 },
  )
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      'desktop/logcat-entry.ts',
      JSON.stringify({
        adb,
        cwd,
        serial: 'device',
        applicationId: 'app.target',
        user: '0',
        uid: '10001',
      }),
    ],
    { cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
  )
  t.after(() => {
    try {
      process.kill(-child.pid!, 'SIGKILL')
    } catch {}
  })
  let output = ''
  const reports: any[] = []
  child.stdout!.on('data', (x) => {
    output += x
  })
  child.stderr!.on('data', (x) => {
    output += x
  })
  child.on('message', (m) => reports.push(m))
  const exit = new Promise<number | null>((resolve) => child.once('exit', resolve))
  await eventually(() => reports.some((r) => r.pids?.includes(40)), 10000)
  assert.ok(reports.some((r) => r.lastCrashAt))
  await writeFile(path.join(cwd, 'pids'), '')
  await eventually(() => reports.some((r) => r.state === 'not-running'), 10000)
  await writeFile(path.join(cwd, 'pids'), '10001 80 app.target')
  await eventually(() => reports.some((r) => r.pids?.includes(80)), 10000)
  await writeFile(path.join(cwd, 'offline'), '')
  assert.equal(await exit, 1)
  assert.equal(reports.at(-1).state, 'unknown')
  const calls = (await readFile(path.join(cwd, 'calls'), 'utf8'))
    .trim()
    .split('\n')
    .map((x) => JSON.parse(x))
  const stream = calls.find((a) => a.includes('logcat'))
  assert.ok(stream.includes('--uid=10001'))
  assert.ok(
    !calls.some((a) => a.includes('force-stop') || a.includes('clear') || a.includes('install')),
  )
  assert.ok(output.includes('FATAL EXCEPTION'))
})
