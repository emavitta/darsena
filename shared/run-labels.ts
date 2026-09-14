import type { Run } from './types.js'

/** Keep the folder visible without repeating the full worktree prefix. */
export function runFolderLabel(run: Pick<Run, 'folder' | 'worktree'>): string {
  const folder = run.folder.replace(/\\/g, '/').replace(/\/+$/, '')
  const worktree = run.worktree.replace(/\\/g, '/').replace(/\/+$/, '')
  if (folder === worktree) return 'Worktree root'
  if (folder.startsWith(`${worktree}/`)) return folder.slice(worktree.length + 1)
  return folder || 'Working folder unavailable'
}
