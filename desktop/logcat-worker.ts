import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { setTimeout as delay } from 'node:timers/promises'
import { command } from './io.js'

export interface LogcatPlan {
  adb: string
  cwd: string
  serial: string
  applicationId: string
  user: string
  uid: string
}
export async function packageUid(
  plan: Pick<LogcatPlan, 'adb' | 'cwd' | 'serial' | 'applicationId' | 'user'>,
  run = command,
) {
  const current = (
    await run(plan.adb, ['-s', plan.serial, 'shell', 'am', 'get-current-user'], plan.cwd)
  ).trim()
  if (current !== plan.user) throw new Error('Android user changed. Start a new Logcat session.')
  const output = await run(
    plan.adb,
    ['-s', plan.serial, 'shell', 'pm', 'list', 'packages', '-U', '--user', plan.user],
    plan.cwd,
  )
  const entries = output.split(/\r?\n/).flatMap((line) => {
    const m = line.trim().match(/^package:(\S+)\s+uid:(\d+)$/)
    return m ? [{ name: m[1]!, uid: m[2]! }] : []
  })
  const target = entries.find((e) => e.name === plan.applicationId)
  if (!target) throw new Error('App is not installed for this Android user.')
  if (entries.some((e) => e.uid === target.uid && e.name !== target.name))
    throw new Error(
      'This app shares its Android UID with another package. Package-isolated Logcat is unavailable.',
    )
  return target.uid
}
export function appPids(output: string, uid: string) {
  return output
    .split(/\r?\n/)
    .flatMap((line) => {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+/)
      return m && m[1] === uid ? [Number(m[2])] : []
    })
    .sort((a, b) => a - b)
}
export async function collectLogcat(plan: LogcatPlan) {
  if ((await packageUid(plan)) !== plan.uid)
    throw new Error('App UID changed. Start a new Logcat session.')
  const child = spawn(
    plan.adb,
    [
      '-s',
      plan.serial,
      'logcat',
      '--uid=' + plan.uid,
      '-b',
      'main',
      '-b',
      'system',
      '-b',
      'crash',
      '-v',
      'threadtime',
      '-T',
      '200',
      '*:V',
    ],
    { cwd: plan.cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const abort = new AbortController()
  const report = (data: Record<string, unknown>) => {
    if (process.connected) process.send?.({ type: 'logcat', ...data })
  }
  let lastPids = 'unobserved',
    lastCrashAt: number | undefined
  const decoder = new StringDecoder('utf8')
  let pending = ''
  const line = (line: string) => {
    // Keep each line and the Runner buffer bounded even for malformed app output.
    console.log(line.slice(0, 32768))
    if (/\sF\s|FATAL EXCEPTION|Fatal signal \d+/.test(line)) {
      lastCrashAt = Date.now()
      report({ lastCrashAt })
    }
  }
  child.stdout.on('data', (chunk) => {
    const pieces = (pending + decoder.write(chunk)).split('\n')
    pending = pieces.pop()!.slice(-32768)
    for (const piece of pieces) line(piece)
  })
  child.stdout.on('end', () => {
    if (pending) line(pending + decoder.end())
  })
  child.stderr.on('data', (data) => process.stderr.write(data))
  const exited = new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Logcat disconnected or failed (exit ' + code + ').')),
    )
  })
  // Attach immediately so a disconnect cannot produce an unhandled rejection.
  void exited.catch(() => {}).finally(() => abort.abort())
  try {
    console.log(
      '[Darsena] Following ' +
        plan.applicationId +
        ' on ' +
        plan.serial +
        '. Includes up to 200 recent records; crash evidence may predate this session.',
    )
    while (!abort.signal.aborted) {
      if ((await packageUid(plan)) !== plan.uid)
        throw new Error('App UID changed. Start a new Logcat session.')
      const pids = appPids(
        await command(
          plan.adb,
          ['-s', plan.serial, 'shell', 'ps', '-A', '-n', '-o', 'UID,PID,NAME'],
          plan.cwd,
        ),
        plan.uid,
      )
      const state = pids.length ? 'running' : 'not-running'
      if (pids.join(',') !== lastPids)
        console.log(
          '[Darsena] App process: ' + state + (pids.length ? ' · PID ' + pids.join(', ') : ''),
        )
      lastPids = pids.join(',')
      report({ state, pids, checkedAt: Date.now(), ...(lastCrashAt ? { lastCrashAt } : {}) })
      await delay(2000, undefined, { signal: abort.signal }).catch(() => {})
    }
    await exited
  } finally {
    report({ state: 'unknown', checkedAt: Date.now(), pids: [] })
    child.kill()
  }
}
