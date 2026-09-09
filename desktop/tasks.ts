import { readFile, access, mkdtemp, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { z } from 'zod'
import { command, message, resolveFolder } from './io.js'
import type { Project, Task, TaskCatalog } from '../shared/types.js'

export function taskId(kind: string, folder: string, name: string) {
  return JSON.stringify([kind, folder, name])
}
const exists = (file: string) =>
  access(file)
    .then(() => true)
    .catch(() => false)
async function packageManager(worktree: string, folder: string) {
  let current = folder
  while (true) {
    try {
      const pkg = JSON.parse(await readFile(path.join(current, 'package.json'), 'utf8'))
      const name = typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : ''
      if (['npm', 'pnpm', 'yarn', 'bun'].includes(name)) return name as string
    } catch {
      /* The selected package is validated separately. */
    }
    for (const [lock, name] of [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['bun.lock', 'bun'],
      ['bun.lockb', 'bun'],
      ['npm-shrinkwrap.json', 'npm'],
      ['package-lock.json', 'npm'],
    ]) {
      if (await exists(path.join(current, lock!))) return name!
    }
    if (current === worktree) return 'npm'
    const parent = path.dirname(current)
    if (parent === current) return 'npm'
    current = parent
  }
}
const gradleReportSchema = z.array(
  z.object({
    name: z.string().regex(/^:[\w:.-]+$/),
    description: z.string().nullable().optional(),
  }),
)
export function parseGradleReport(output: string) {
  const line = output.split('\n').find((value) => value.startsWith('__DARSENA_TASKS__'))
  if (!line)
    throw new Error(
      'Gradle did not return a task list. Check the build configuration and Java installation.',
    )
  return gradleReportSchema.parse(JSON.parse(line.slice('__DARSENA_TASKS__'.length)))
}
export class TaskDiscovery {
  private gradle = new Map<string, Task[]>()
  async loadGradle(worktree: string, folder: string) {
    const cwd = await resolveFolder(worktree, folder)
    if (!(await exists(path.join(cwd, 'gradlew'))))
      throw new Error('Add the folder containing the Gradle wrapper (gradlew).')
    const temp = await mkdtemp(path.join(os.tmpdir(), 'darsena-gradle-'))
    const name = `darsenaTaskReport${Date.now()}`
    const script = `gradle.projectsEvaluated {
  rootProject.tasks.register('${name}') {
    doLast {
      def rows = rootProject.allprojects.collectMany { p ->
        p.tasks.findAll { t -> t.name != '${name}' }.collect { t -> [name: t.path, description: t.description] }
      }
      println('__DARSENA_TASKS__' + groovy.json.JsonOutput.toJson(rows))
    }
  }
}`
    try {
      const init = path.join(temp, 'report.gradle')
      await writeFile(init, script)
      const output = await command(
        './gradlew',
        ['--init-script', init, '--console=plain', '--quiet', name],
        cwd,
        120000,
      )
      const tasks: Task[] = parseGradleReport(output).map((t) => ({
        id: taskId('gradle', folder, t.name),
        name: t.name,
        folder,
        kind: 'gradle',
        command: './gradlew',
        args: [t.name],
        available: true,
        description: t.description || undefined,
      }))
      this.gradle.set(JSON.stringify([worktree, folder]), tasks)
    } finally {
      await rm(temp, { recursive: true, force: true })
    }
  }
  async list(project: Project, worktree: string): Promise<TaskCatalog> {
    const result: TaskCatalog = { tasks: [], sources: [], errors: [] }
    for (const folder of project.folders) {
      try {
        const cwd = await resolveFolder(worktree, folder.path)
        if (await exists(path.join(cwd, 'package.json'))) {
          const pkg = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'))
          const scripts = z.record(z.string(), z.string()).parse(pkg.scripts || {})
          const manager = await packageManager(await resolveFolder(worktree, '.'), cwd)
          result.sources.push({
            kind: 'script',
            folder: folder.path,
            label: manager.toUpperCase(),
            loaded: true,
            count: Object.keys(scripts).length,
          })
          for (const [name, script] of Object.entries(scripts)) {
            result.tasks.push({
              id: taskId('script', folder.path, name),
              name,
              folder: folder.path,
              kind: 'script',
              command: manager,
              args: ['run', name],
              description: script,
              available: true,
              manager,
            })
          }
        }
        if (await exists(path.join(cwd, 'gradlew'))) {
          const tasks = this.gradle.get(JSON.stringify([worktree, folder.path]))
          result.sources.push({
            kind: 'gradle',
            folder: folder.path,
            label: 'Gradle',
            loaded: tasks !== undefined,
            count: tasks?.length || 0,
          })
          result.tasks.push(...(tasks || []))
        }
      } catch (error) {
        result.errors.push({ folder: folder.path, message: message(error) })
      }
    }
    for (const custom of project.customTasks) {
      const available = await resolveFolder(worktree, custom.folder)
        .then(() => true)
        .catch(() => false)
      result.tasks.push({ ...custom, kind: 'custom', available })
      const source = result.sources.find((s) => s.kind === 'custom' && s.folder === custom.folder)
      if (source) source.count++
      else
        result.sources.push({
          kind: 'custom',
          folder: custom.folder,
          label: 'Custom commands',
          loaded: true,
          count: 1,
        })
    }
    // Preserve missing favorites so changing branches never silently changes their meaning.
    for (const id of project.favorites) {
      if (result.tasks.some((t) => t.id === id)) continue
      try {
        const [kind, folder, name] = JSON.parse(id)
        if (
          ['script', 'gradle'].includes(kind) &&
          typeof folder === 'string' &&
          typeof name === 'string'
        ) {
          result.tasks.push({ id, kind, folder, name, command: '', args: [], available: false })
        }
      } catch {
        /* Removed custom task. */
      }
    }
    result.tasks = result.tasks.map((t) => ({ ...t, port: project.taskPreferences[t.id]?.port }))
    return result
  }
}
