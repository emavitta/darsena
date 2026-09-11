import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { androidDevices, findAdb } from './android.js'
import { packageUid } from './logcat-worker.js'
import { command } from './io.js'
import { gitAction, gitState } from './git-actions.js'
import type { Methods } from '../shared/types.js'
import { Store } from './store.js'
import { TaskDiscovery } from './tasks.js'
import { Runner, active } from './runner.js'
import { listWorktrees, matchingWorktree, validateWorktree } from './git.js'
import { listeners, processParents, processCwd, isDescendant } from './processes.js'
import { message, resolveFolder } from './io.js'
import type { ListenerReport, StartResult, Run } from '../shared/types.js'

/** One workspace and process owner, shared by the desktop UI and MCP clients. */
export class WorkspaceService {
  readonly discovery = new TaskDiscovery()
  readonly runner = new Runner()
  private startQueue: Promise<unknown> = Promise.resolve()
  constructor(readonly store: Store) {}

  async tree(projectId: string, worktree: string) {
    const project = this.store.project(projectId)
    return { project, worktree: await validateWorktree(project.root, worktree) }
  }

  async gitState(projectId: string, worktree: string) {
    const context = await this.tree(projectId, worktree)
    return gitState(context.worktree.path)
  }

  gitAction(input: Methods['gitAction']['input']) {
    const operation = this.startQueue.then(async () => {
      const context = await this.tree(input.projectId, input.worktree)
      if (input.action === 'pull' && this.runner.list().some(run => active(run) && run.worktree === context.worktree.path)) {
        throw new Error('Stop the tasks running in this worktree before pulling.')
      }
      return gitAction(context.worktree.path, input.action, input.expectedHead, input.expectedBranch)
    })
    this.startQueue = operation.catch(() => {})
    return operation
  }

  startLogcat(runId: string, source: Run['source'] = 'ui', authorize: (run: Run) => void = () => {}) {
    const operation = this.startQueue.then(async () => {
      const origin = this.runner.list().find(r => r.id === runId)
      if (!origin || !origin.androidApplicationId || !origin.androidDevice || active(origin) || origin.androidOperation === 'logcat') throw new Error('Choose a finished Android deployment or app operation with a known application ID.')
      authorize(origin)
      const context = await this.tree(origin.projectId, origin.worktree)
      const folder = path.relative(context.worktree.path, origin.folder) || '.'
      if (!context.project.folders.some(f => f.path === folder)) throw new Error('Android folder shortcut was removed.')
      const cwd = await resolveFolder(context.worktree.path, folder)
      if (!(await androidDevices(cwd)).some(d => d.serial === origin.androidDevice && d.state === 'device')) throw new Error('Device is disconnected or unauthorized.')
      const adb = await findAdb(cwd)
      const user = (await command(adb, ['-s', origin.androidDevice, 'shell', 'am', 'get-current-user'], cwd)).trim()
      if (!/^\d+$/.test(user)) throw new Error('Cannot identify the Android user.')
      const plan = { adb, cwd, serial: origin.androidDevice, applicationId: origin.androidApplicationId, user }
      const uid = await packageUid(plan)
      authorize(origin)
      this.store.project(origin.projectId)
      const duplicate = this.runner.list().find(r => active(r) && r.androidOperation === 'logcat' && r.projectId === origin.projectId && r.androidDevice === plan.serial && r.androidApplicationId === plan.applicationId)
      if (duplicate) return duplicate
      return this.runner.start(context.project, context.worktree, {
        id: JSON.stringify(['logcat', plan.serial, plan.applicationId]), name: 'Logcat · ' + plan.applicationId,
        folder, kind: 'custom', available: true, command: process.execPath,
        args: [fileURLToPath(new URL('./logcat-entry.js', import.meta.url)), JSON.stringify({ ...plan, uid })],
      }, cwd, source, { env: { ELECTRON_RUN_AS_NODE: '1' }, reports: true, androidOperation: 'logcat', androidDevice: plan.serial, androidApplicationId: plan.applicationId, androidVariant: origin.androidVariant, displayCommand: `Logcat · ${plan.applicationId} · ${plan.serial} · user ${user}` })
    })
    this.startQueue = operation.catch(() => {})
    return operation
  }

  async tasks(projectId: string, worktree: string) {
    const context = await this.tree(projectId, worktree)
    return this.discovery.list(context.project, context.worktree.path)
  }

  async scanListeners(): Promise<ListenerReport> {
    try {
      const rows = await listeners()
      const parents = await processParents()
      const trees = await Promise.all(
        this.store.state.projects.map(async (project) => ({
          project,
          trees: await listWorktrees(project.root, false).catch(() => []),
        })),
      )
      const cwdByPid = new Map<number, string | undefined>()
      const pids = [...new Set(rows.map((row) => row.pid))]
      for (let i = 0; i < pids.length; i += 6)
        await Promise.all(
          pids.slice(i, i + 6).map(async (pid) => cwdByPid.set(pid, await processCwd(pid))),
        )
      for (const row of rows) {
        row.cwd = cwdByPid.get(row.pid)
        const run = this.runner
          .list()
          .find((run) => active(run) && run.pid && isDescendant(row.pid, run.pid, parents))
        if (run) {
          Object.assign(row, {
            runId: run.id,
            projectId: run.projectId,
            worktree: run.worktree,
            worktreeName: run.worktreeName,
          })
        } else if (row.cwd) {
          for (const entry of trees) {
            const match = matchingWorktree(entry.trees, row.cwd)
            if (match) {
              Object.assign(row, {
                projectId: entry.project.id,
                worktree: match.path,
                worktreeName: match.name,
              })
              break
            }
          }
        }
      }
      return { listeners: rows, checkedAt: Date.now() }
    } catch (error) {
      return { listeners: [], error: message(error), checkedAt: Date.now() }
    }
  }

  start(
    input: { projectId: string; worktree: string; taskId: string },
    source: Run['source'] = 'ui',
    authorize: () => void = () => {},
  ): Promise<StartResult> {
    const operation = async (): Promise<StartResult> => {
      authorize()
      const context = await this.tree(input.projectId, input.worktree)
      const task = (await this.discovery.list(context.project, context.worktree.path)).tasks.find(
        (task) => task.id === input.taskId,
      )
      if (task?.action === 'android-launch') throw new Error('Choose a variant and device using Run on Android in Darsena.')
      if (!task?.available)
        throw new Error(
          'This task is unavailable in the selected worktree. Reload its source or choose another task.',
        )
      const live = this.runner.list().filter(active)
      const duplicate = live.find(
        (run) =>
          run.projectId === input.projectId &&
          run.worktree === context.worktree.path &&
          run.taskId === task.id,
      )
      if (duplicate)
        return {
          kind: 'conflict',
          message: 'This task is already running in this worktree.',
          runId: duplicate.id,
        }
      if (task.port) {
        const owned = live.find((run) => run.port === task.port)
        if (owned)
          return {
            kind: 'conflict',
            message: `Port ${task.port} is reserved by ${owned.name} in ${owned.worktreeName}.`,
            runId: owned.id,
          }
        const occupied = (await listeners()).find((listener) => listener.port === task.port)
        if (occupied)
          return {
            kind: 'conflict',
            message: `Port ${task.port} is in use by ${occupied.command} (PID ${occupied.pid}). Check Listening ports before starting.`,
          }
      }
      const cwd = await resolveFolder(context.worktree.path, task.folder)
      // Permissions can change while filesystem/process checks or another start are pending.
      authorize()
      this.store.project(input.projectId)
      return {
        kind: 'started',
        run: this.runner.start(context.project, context.worktree, task, cwd, source),
      }
    }
    const result = this.startQueue.then(operation, operation)
    this.startQueue = result.catch(() => {})
    return result
  }
}
