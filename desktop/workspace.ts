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
