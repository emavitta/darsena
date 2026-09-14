import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Project, Run } from '../shared/types.js'
import { active } from './runner.js'
const text = z
  .string()
  .min(1)
  .max(8192)
  .refine((v) => !v.includes('\0'))
export const preparationSchema = z
  .object({
    projectId: text,
    command: z
      .string()
      .max(8192)
      .refine((v) => !v.includes('\0')),
    args: z
      .array(
        z
          .string()
          .max(8192)
          .refine((v) => !v.includes('\0')),
      )
      .max(100),
  })
  .strict()
export function configurePreparation(
  project: Project,
  command: string,
  args: string[],
  runs: Run[],
) {
  const old = project.preparationTaskId
  if (old && runs.some((r) => r.projectId === project.id && r.taskId === old && active(r)))
    throw new Error('Stop the running preparation before changing its command.')
  project.customTasks = project.customTasks.filter((t) => t.id !== old)
  project.favorites = project.favorites.filter((id) => id !== old)
  if (old) delete project.taskPreferences[old]
  project.preparationTaskId = undefined
  if (command.trim()) {
    // A changed command gets a new identity, so old MCP execution grants cannot authorize it.
    const id = randomUUID()
    project.customTasks.push({
      id,
      name: 'Prepare worktree',
      folder: '.',
      command: command.trim(),
      args,
    })
    project.preparationTaskId = id
  }
}
