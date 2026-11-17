import { readFile, readlink } from 'node:fs/promises'
import { command } from './io.js'
import type { Listener } from '../shared/types.js'

const linux = process.platform === 'linux'

/**
 * Parses `ss -H -ltnpe` (adapted from mago-app `tools/magolab/core/dev-ports.ts`). A line:
 * `LISTEN 0 511 *:5190 *:* users:(("MainThread",pid=2286747,fd=26)) uid:1001 ino:… sk:… <->`
 * `users:(…)` is missing for other users' processes: the caller sees the socket
 * and its uid, never the process — those rows keep pid 0 and an empty command.
 * IPv4 and IPv6 sockets of one holder on one port merge into a single row.
 */
export function parseSsListeners(output: string): Listener[] {
  const rows: Listener[] = []
  for (const line of output.split('\n')) {
    const fields = line.trim().split(/\s+/)
    if (fields[0] !== 'LISTEN' || fields.length < 5) continue
    const local = fields[3]!
    const colon = local.lastIndexOf(':')
    const port = Number(local.slice(colon + 1))
    if (colon < 0 || !Number.isInteger(port) || port <= 0) continue
    const address = local.slice(0, colon).replace(/^\[(.*)\]$/, '$1')
    const rest = fields.slice(5).join(' ')
    const uidText = /(?:^|\s)uid:(\d+)/.exec(rest)?.[1]
    const uid = uidText === undefined ? undefined : Number(uidText)
    const holder = /\("((?:[^"\\]|\\.)*)",pid=(\d+),fd=\d+\)/.exec(rest)
    const pid = holder ? Number(holder[2]) : 0
    const name = holder ? holder[1]!.replace(/\\(.)/g, '$1') : ''
    const existing = rows.find(
      (row) => row.port === port && row.pid === pid && row.uid === uid,
    )
    if (existing) {
      const addresses = existing.address.split(', ')
      if (!addresses.includes(address)) existing.address += `, ${address}`
      existing.ipv6Only = existing.address.split(', ').every((a) => a === '::1') || undefined
      continue
    }
    rows.push({
      pid,
      command: name,
      port,
      address,
      ...(uid === undefined ? {} : { uid }),
      ...(address === '::1' ? { ipv6Only: true } : {}),
    })
  }
  return rows
}

async function userNames(): Promise<Map<number, string>> {
  try {
    const passwd = await readFile('/etc/passwd', 'utf8')
    return new Map(
      passwd
        .split('\n')
        .map((line) => line.split(':'))
        .filter((f) => f.length > 3 && /^\d+$/.test(f[2]!))
        .map((f) => [Number(f[2]), f[0]!] as [number, string]),
    )
  } catch {
    return new Map()
  }
}

async function linuxListeners(): Promise<Listener[]> {
  const rows = parseSsListeners(await command('/usr/bin/ss', ['-H', '-ltnpe'], undefined, 5000))
  const names = await userNames()
  for (const row of rows) {
    if (row.uid !== undefined && names.has(row.uid)) row.user = names.get(row.uid)
  }
  return rows
}

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
  if (linux) return linuxListeners()
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
  if (linux) {
    // Readable only for the user's own processes: EACCES elsewhere — never guess.
    if (pid <= 0) return undefined
    try {
      return await readlink(`/proc/${pid}/cwd`)
    } catch {
      return undefined
    }
  }
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
  // -axo is BSD syntax (macOS); procps on Linux wants UNIX -eo for the same table.
  const rows = (await command('/bin/ps', linux ? ['-eo', 'pid=,ppid='] : ['-axo', 'pid=,ppid='], undefined, 4000))
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
