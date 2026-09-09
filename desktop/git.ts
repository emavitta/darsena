import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { command, inside, message } from './io.js'
import type { Worktree } from '../shared/types.js'

export function parseWorktrees(output: string): Worktree[] {
  const result: Worktree[] = []
  let current: Worktree | undefined
  for (const field of output.split('\0')) {
    if (field.startsWith('worktree ')) {
      current = {
        path: path.normalize(field.slice(9)),
        name: path.basename(field.slice(9)),
        branch: null,
        head: '',
        main: result.length === 0,
        exists: true,
        bare: false,
      }
      result.push(current)
    } else if (current) {
      if (field.startsWith('HEAD ')) current.head = field.slice(5)
      else if (field.startsWith('branch '))
        current.branch = field.slice(7).replace(/^refs\/heads\//, '')
      else if (field === 'bare') current.bare = true
      else if (field.startsWith('locked')) current.locked = field.slice(7) || 'Locked'
      else if (field.startsWith('prunable')) current.prunable = field.slice(9) || 'Prunable'
    }
  }
  return result
}
export async function listWorktrees(root: string, status = true): Promise<Worktree[]> {
  const worktrees = parseWorktrees(
    await command('git', ['-C', root, 'worktree', 'list', '--porcelain', '-z']),
  )
  // Limit expensive status requests when a repository has many worktrees.
  for (let index = 0; index < worktrees.length; index += 4) {
    await Promise.all(
      worktrees.slice(index, index + 4).map(async (tree) => {
        tree.exists = await stat(tree.path)
          .then((s) => s.isDirectory())
          .catch(() => false)
        if (!tree.exists || tree.bare || !status) return
        try {
          const output = await command('git', [
            '-C',
            tree.path,
            'status',
            '--porcelain=v1',
            '-z',
            '--untracked-files=normal',
          ])
          const fields = output.split('\0').filter(Boolean)
          let count = 0
          for (let i = 0; i < fields.length; i++) {
            count++
            if (/^[RC]|^.[RC]/.test(fields[i]!)) i++
          }
          tree.changed = count
        } catch (error) {
          tree.error = message(error)
        }
      }),
    )
  }
  return worktrees
}
export async function identifyProject(folder: string) {
  const chosen = await realpath(folder)
  const common = (
    await command('git', ['-C', chosen, 'rev-parse', '--path-format=absolute', '--git-common-dir'])
  ).trimEnd()
  const commonDir = await realpath(common)
  const worktrees = await listWorktrees(chosen, false)
  const root = worktrees.find((w) => w.main && w.exists)?.path || chosen
  return { root, commonDir, name: path.basename(root), worktrees }
}
export async function validateWorktree(root: string, requested: string) {
  const worktrees = await listWorktrees(root, false)
  const found = worktrees.find((w) => w.path === requested)
  if (!found || !found.exists || found.bare)
    throw new Error('This worktree is no longer available. Refresh the project.')
  return found
}
export function matchingWorktree(worktrees: Worktree[], cwd: string) {
  return worktrees
    .filter((w) => inside(w.path, cwd))
    .sort((a, b) => b.path.length - a.path.length)[0]
}
