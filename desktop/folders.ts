import { readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { inside, resolveFolder } from './io.js'
import type { FolderListing } from '../shared/types.js'

export async function folderShortcut(worktree: string, folder: string) {
  const root = await realpath(worktree)
  if (!inside(root, path.resolve(root, folder)))
    throw new Error('Choose a folder inside the selected worktree.')
  const target = await resolveFolder(root, folder)
  return {
    path: path.relative(root, target).split(path.sep).join('/') || '.',
    label: path.basename(target),
  }
}

export async function browseFolders(worktree: string, folder: string): Promise<FolderListing> {
  const current = await folderShortcut(worktree, folder)
  const root = await realpath(worktree)
  const entries = await readdir(path.resolve(root, current.path), { withFileTypes: true })
  const candidates = entries.filter(
    (entry) => entry.name !== '.git' && (entry.isDirectory() || entry.isSymbolicLink()),
  )
  const folders: FolderListing['folders'] = []
  // Read one level only, with bounded filesystem concurrency even in large monorepos.
  for (let i = 0; i < candidates.length; i += 32) {
    const batch = await Promise.all(
      candidates.slice(i, i + 32).map(async (entry) => {
        try {
          const shortcut = await folderShortcut(root, path.join(current.path, entry.name))
          return { name: entry.name, path: shortcut.path }
        } catch {
          // Omit external/broken symlinks and entries removed while browsing.
          return undefined
        }
      }),
    )
    for (const entry of batch) if (entry) folders.push(entry)
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return { path: current.path, folders }
}
