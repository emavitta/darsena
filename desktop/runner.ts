import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'
import type { Project, Run, Task, Worktree } from '../shared/types.js'

export const active = (run: Run) => ['starting', 'running', 'stopping'].includes(run.status)
type Entry = { run: Run; child: ChildProcess; log: string; stopping?: Promise<void> }
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
function groupAlive(pid: number) {
  try {
    process.kill(-pid, 0)
    return true
  } catch {
    return false
  }
}
export class Runner extends EventEmitter {
  private entries = new Map<string, Entry>()
  shuttingDown = false
  list() {
    return Array.from(this.entries.values(), (e) => structuredClone(e.run)).sort(
      (a, b) => b.startedAt - a.startedAt,
    )
  }
  logs(id: string) {
    return this.entries.get(id)?.log || ''
  }
  append(entry: Entry, text: string) {
    entry.log = (entry.log + text).slice(-512 * 1024)
    const clean = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    for (const url of clean.match(/https?:\/\/[^\s<>\u001b]+/g) || []) {
      const trimmed = url.replace(/[),.;]+$/, '')
      try {
        new URL(trimmed)
        if (!entry.run.urls.includes(trimmed) && entry.run.urls.length < 8)
          entry.run.urls.push(trimmed)
      } catch {}
    }
    this.emit('changed')
  }
  start(
    project: Project,
    tree: Worktree,
    task: Task,
    cwd: string,
    source: Run['source'] = 'ui',
  ): Run {
    if (this.shuttingDown) throw new Error('Darsena is shutting down.')
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' }
    delete env.FORCE_COLOR
    const child = spawn(task.command, task.args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const run: Run = {
      id: randomUUID(),
      source,
      projectId: project.id,
      projectName: project.name,
      worktree: tree.path,
      worktreeName: tree.name,
      taskId: task.id,
      name: task.name,
      folder: cwd,
      command: [task.command, ...task.args]
        .map((s) => (/\s/.test(s) ? JSON.stringify(s) : s))
        .join(' '),
      pid: child.pid,
      status: 'starting',
      startedAt: Date.now(),
      port: task.port,
      urls: [],
    }
    const entry: Entry = { run, child, log: '' }
    this.entries.set(run.id, entry)
    const outDecoder = new StringDecoder('utf8'),
      errDecoder = new StringDecoder('utf8')
    child.stdout?.on('data', (chunk) => this.append(entry, outDecoder.write(chunk)))
    child.stderr?.on('data', (chunk) => this.append(entry, errDecoder.write(chunk)))
    child.once('spawn', () => {
      run.status = 'running'
      this.emit('changed')
    })
    child.once('error', (error) => {
      run.status = 'failed'
      run.endedAt = Date.now()
      run.exitCode = null
      this.append(entry, `\n${error.message}\nCheck the executable and your shell environment.\n`)
    })
    child.once('exit', (code, signal) => {
      run.exitCode = code
      run.signal = signal
      // A script can leave children alive. Keep owning the process group until it ends.
      const finish = () => {
        if (run.pid && groupAlive(run.pid) && !entry.stopping) {
          setTimeout(finish, 500).unref()
          this.appendOnceDetached(entry)
          return
        }
        if (!entry.stopping && run.status !== 'failed') {
          run.status = code === 0 && !signal ? 'succeeded' : 'failed'
          run.endedAt = Date.now()
          this.emit('changed')
          this.prune()
        }
      }
      setTimeout(finish, 30).unref()
    })
    child.once('close', () => {
      this.append(entry, outDecoder.end() + errDecoder.end())
    })
    this.emit('changed')
    return structuredClone(run)
  }
  private appendOnceDetached(entry: Entry) {
    if (entry.log.includes('[Darsena] Child processes remain')) return
    this.append(
      entry,
      '\n[Darsena] Child processes remain active after the command exited. Stop will stop their process group.\n',
    )
  }
  async stop(id: string) {
    const entry = this.entries.get(id)
    if (!entry || !active(entry.run)) return
    if (entry.stopping) return entry.stopping
    entry.stopping = this.stopEntry(entry)
    return entry.stopping
  }
  private async stopEntry(entry: Entry) {
    const { run } = entry
    run.status = 'stopping'
    this.emit('changed')
    if (run.pid) {
      try {
        process.kill(-run.pid, 'SIGTERM')
      } catch {}
      for (let i = 0; i < 40 && groupAlive(run.pid); i++) await delay(100)
      if (groupAlive(run.pid)) {
        try {
          process.kill(-run.pid, 'SIGKILL')
        } catch {}
        for (let i = 0; i < 20 && groupAlive(run.pid); i++) await delay(100)
      }
      if (groupAlive(run.pid)) {
        run.status = 'running'
        entry.stopping = undefined
        this.emit('changed')
        throw new Error(`Could not stop ${run.name} (process group ${run.pid}).`)
      }
    }
    run.status = 'stopped'
    run.endedAt = Date.now()
    this.emit('changed')
    this.prune()
  }
  async shutdown() {
    this.shuttingDown = true
    const results = await Promise.allSettled(
      this.list()
        .filter(active)
        .map((r) => this.stop(r.id)),
    )
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length) {
      this.shuttingDown = false
      throw new Error(
        'Some tasks could not be stopped. Darsena will stay open so you can inspect them.',
      )
    }
  }
  private prune() {
    for (const run of this.list()
      .filter((r) => !active(r))
      .slice(30))
      this.entries.delete(run.id)
  }
}
