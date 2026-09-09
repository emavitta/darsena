import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { AppState, Project } from '../shared/types.js'

const folder = z.object({ id: z.string(), path: z.string(), label: z.string() })
const custom = z.object({
  id: z.string(),
  name: z.string(),
  folder: z.string(),
  command: z.string(),
  args: z.array(z.string()),
})
const schema = z.object({
  version: z.literal(1),
  selectedProject: z.string().optional(),
  apps: z.object({
    vscode: z.string().optional(),
    terminal: z.string().optional(),
    'android-studio': z.string().optional(),
  }),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      root: z.string(),
      commonDir: z.string(),
      starred: z.boolean(),
      folders: z.array(folder),
      favorites: z.array(z.string()),
      customTasks: z.array(custom),
      taskPreferences: z.record(
        z.string(),
        z.object({ port: z.number().int().min(1).max(65535).optional() }),
      ),
      lastWorktree: z.string().optional(),
    }),
  ),
})
export class Store {
  state: AppState = { version: 1, projects: [], apps: {} }
  private queue: Promise<void> = Promise.resolve()
  constructor(readonly directory: string) {}
  async load() {
    try {
      this.state = schema.parse(
        JSON.parse(await readFile(path.join(this.directory, 'settings.json'), 'utf8')),
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error(
          `Cannot read Darsena settings. The existing file was preserved. ${String(error)}`,
        )
    }
  }
  project(id: string): Project {
    const project = this.state.projects.find((p) => p.id === id)
    if (!project) throw new Error('Project not found. Refresh Darsena.')
    return project
  }
  async save() {
    const serialized = JSON.stringify(schema.parse(this.state), null, 2)
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        await mkdir(this.directory, { recursive: true })
        const filename = path.join(this.directory, 'settings.json')
        await writeFile(`${filename}.tmp`, serialized, { mode: 0o600 })
        await rename(`${filename}.tmp`, filename)
      })
    await this.queue
    return structuredClone(this.state)
  }
}
