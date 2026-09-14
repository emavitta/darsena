import { readFile, realpath, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'
import picomatch from 'picomatch'
import { inside } from './io.js'
import type { WorkspaceFolders } from '../shared/types.js'

export async function discoverWorkspaceFolders(worktree: string): Promise<WorkspaceFolders> {
  const root = await realpath(worktree)
  async function read(relative: string) {
    try {
      const file = await realpath(path.join(root, relative))
      if (!inside(root, file)) throw new Error('Workspace manifests must stay inside the worktree.')
      if ((await stat(file)).size > 1024 * 1024)
        throw new Error('Workspace manifest exceeds 1 MiB.')
      return await readFile(file, 'utf8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw e
    }
  }
  const yaml = await read('pnpm-workspace.yaml')
  let source: string | undefined, patterns: unknown
  if (yaml !== undefined) {
    source = 'pnpm-workspace.yaml'
    patterns = parse(yaml, { maxAliasCount: 0 })?.packages ?? []
  } else {
    const json = await read('package.json')
    const config = json ? JSON.parse(json).workspaces : undefined
    if (config !== undefined) {
      source = 'package.json'
      patterns = Array.isArray(config) ? config : config?.packages
    }
  }
  if (!source) return { folders: [], warnings: [] }
  if (
    !Array.isArray(patterns) ||
    patterns.length > 500 ||
    patterns.some((p) => typeof p !== 'string' || p.length > 1024 || p.includes('\0'))
  )
    throw new Error('Invalid workspace package patterns in ' + source)
  const normalized = (patterns as string[]).map((p) => {
    const exclude = p.startsWith('!')
    const value = (exclude ? p.slice(1) : p).replace(/^\.\//, '').replace(/\/+$/, '')
    if (path.isAbsolute(value) || value.split('/').includes('..'))
      throw new Error('Workspace patterns must stay inside the worktree.')
    return { exclude, value }
  })
  const include = normalized.filter((p) => !p.exclude).map((p) => picomatch(p.value))
  const exclude = normalized.filter((p) => p.exclude).map((p) => picomatch(p.value))
  const result: WorkspaceFolders = { source, folders: [], warnings: [] }
  if (!include.length) return result
  const queue = [{ relative: '', depth: 0 }]
  let visited = 0
  const ignored = new Set([
    'node_modules',
    '.git',
    '.pnpm',
    '.nuxt',
    '.output',
    'build',
    'dist',
    '.gradle',
  ])
  scan: while (queue.length) {
    const next = queue.shift()!
    const entries = await readdir(path.join(root, next.relative), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue // No symlink traversal.
      if (++visited > 5000) {
        result.warnings.push('Scan limited to 5,000 folders. Use Browse for additional folders.')
        break scan
      }
      const relative = next.relative ? next.relative + '/' + entry.name : entry.name
      if (include.some((match) => match(relative)) && !exclude.some((match) => match(relative))) {
        try {
          const json = await read(relative + '/package.json')
          if (json) {
            const pkg = JSON.parse(json)
            result.folders.push({
              path: relative,
              name: typeof pkg.name === 'string' ? pkg.name : entry.name,
              taskCount:
                pkg.scripts && typeof pkg.scripts === 'object'
                  ? Object.values(pkg.scripts).filter((v) => typeof v === 'string').length
                  : 0,
            })
          }
        } catch {
          result.warnings.push('Cannot read package.json in ' + relative)
        }
      }
      if (next.depth < 12) queue.push({ relative, depth: next.depth + 1 })
      else if (!result.warnings.includes('Scan depth limited. Use Browse for deeper folders.'))
        result.warnings.push('Scan depth limited. Use Browse for deeper folders.')
    }
  }
  result.folders.sort((a, b) => a.path.localeCompare(b.path))
  return result
}
