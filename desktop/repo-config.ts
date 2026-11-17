import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

/**
 * darsena.json — per-project config committed at the repository root, read
 * from the worktree like package.json. Darsena stays generic: a repo tells
 * it which ports belong together and what they serve. Example (mago-app):
 *
 *   { "ports": [ { "name": "call service", "range": [5174, 5183] },
 *                { "name": "WTC UI", "ports": [5190, 5191] },
 *                { "name": "Admin Console", "port": 8080 } ] }
 *
 * Unknown top-level keys are ignored, so an older Darsena reads a newer file.
 */
export const REPO_CONFIG = 'darsena.json'

export interface PortPool {
  name: string
  ports: number[]
}

export interface RepoConfig {
  pools: PortPool[]
  error?: string
}

const portNumber = z.number().int().min(1).max(65535)
const fileSchema = z.object({ ports: z.array(z.unknown()).default([]) })
const entrySchema = z
  .object({
    name: z.string().trim().min(1),
    port: portNumber.optional(),
    ports: z.array(portNumber).min(1).optional(),
    range: z.tuple([portNumber, portNumber]).optional(),
  })
  .strict()
/** A range wider than this is a typo, not a pool. */
const MAX_RANGE = 1000

/**
 * One entry of `ports`, validated and expanded to the ports it covers.
 * Exactly one of: "port": 8080 · "ports": [5190, 5191] (explicit list) ·
 * "range": [5174, 5183] (inclusive). "pool" is refused: [5174, 5183] would
 * read as a range to one person and as two ports to another.
 */
export function toPool(entry: unknown): PortPool {
  if (entry && typeof entry === 'object' && 'pool' in entry)
    throw new Error(
      `"pool" is ambiguous: use "range": [first, last] (inclusive) or "ports": [an explicit list].`,
    )
  const parsed = entrySchema.safeParse(entry)
  if (!parsed.success) throw new Error(`port entry ${JSON.stringify(entry)}: ${z.prettifyError(parsed.error)}`)
  const { name, port, ports, range } = parsed.data
  const kinds = [port, ports, range].filter((value) => value !== undefined).length
  if (kinds !== 1)
    throw new Error(`port entry "${name}" needs exactly one of "port", "ports" or "range".`)
  if (range) {
    const [first, last] = range
    if (first > last) throw new Error(`port entry "${name}": range [${first}, ${last}] runs backwards.`)
    if (last - first >= MAX_RANGE)
      throw new Error(`port entry "${name}": range [${first}, ${last}] spans more than ${MAX_RANGE} ports.`)
    return { name, ports: Array.from({ length: last - first + 1 }, (_, i) => first + i) }
  }
  return { name, ports: port !== undefined ? [port] : [...new Set(ports)] }
}

/** No file → no pools. A broken file → no pools plus the reason, never a throw. */
export async function readRepoConfig(worktree: string): Promise<RepoConfig> {
  let raw: string
  try {
    raw = await readFile(path.join(worktree, REPO_CONFIG), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { pools: [] }
    return { pools: [], error: `${REPO_CONFIG}: ${(error as Error).message}` }
  }
  try {
    const file = fileSchema.parse(JSON.parse(raw))
    return { pools: file.ports.map(toPool) }
  } catch (error) {
    return { pools: [], error: `${REPO_CONFIG}: ${(error as Error).message}` }
  }
}

export function poolOf(port: number, pools: readonly PortPool[]): string | undefined {
  return pools.find((pool) => pool.ports.includes(port))?.name
}
