import type { Worktree } from '../../shared/types'

export function worktreeStatusHint(tree: Worktree) {
  if (!tree.exists) return 'This folder no longer exists. Refresh to check the worktree list.'
  if (tree.bare) return 'A bare repository has no working folder to open or run tasks in.'
  if (tree.error) return `Git could not read the working tree status.\n${tree.error}`
  if (tree.changed === undefined) return 'The working tree status has not been read yet.'
  if (!tree.changed) return 'Git reports no uncommitted changes or untracked files.'
  return 'Uncommitted changes reported by Git, including staged, unstaged and untracked entries.'
}

export function worktreeSelectionHint(tree: Worktree) {
  if (!tree.exists || tree.bare) return `${worktreeStatusHint(tree)}\n${tree.path}`
  return `Select this worktree to open its folders and run its tasks.\n${tree.path}`
}
