import { command } from './io.js'
import type { Listener } from '../shared/types.js'
import { isWindows } from './platform.js'
import { windowsListeners, windowsParents } from './windows-system.js'

export function parseListeners(output: string): Listener[] {
  const rows: Listener[] = []
  let pid = 0,
    name = ''
  for (const line of output.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1))
    else if (line.startsWith('c')) name = line.slice(1)
    else if (line.startsWith('n')) {
      const address = line.slice(1)
      const port = Number(address.match(/:(\d+)$/)?.[1])
      if (pid > 0 && port > 0 && !rows.some((r) => r.pid === pid && r.port === port))
        rows.push({ pid, command: name, port, address })
    }
  }
  return rows
}
export async function listeners(): Promise<Listener[]> {
  if (isWindows) return windowsListeners()
  try {
    return parseListeners(
      await command('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'], undefined, 5000),
    )
  } catch (error) {
    if (
      (error as { code?: number; stdout?: string }).code === 1 &&
      !(error as { stdout?: string }).stdout
    )
      return []
    throw error
  }
}
export async function processCwd(pid: number) {
  if (isWindows) return undefined // No supported API for an arbitrary process's working directory.
  try {
    const out = await command(
      '/usr/sbin/lsof',
      ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
      undefined,
      3000,
    )
    return out
      .split('\n')
      .find((line) => line.startsWith('n'))
      ?.slice(1)
  } catch {
    return undefined
  }
}
export async function processParents() {
  if (isWindows) return windowsParents()
  const rows = (await command('/bin/ps', ['-axo', 'pid=,ppid='], undefined, 4000))
    .trim()
    .split('\n')
  return new Map(rows.map((line) => line.trim().split(/\s+/).map(Number) as [number, number]))
}
export function isDescendant(pid: number, ancestor: number, parents: Map<number, number>) {
  const seen = new Set<number>()
  while (pid > 1 && !seen.has(pid)) {
    if (pid === ancestor) return true
    seen.add(pid)
    pid = parents.get(pid) || 0
  }
  return false
}
