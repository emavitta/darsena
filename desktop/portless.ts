import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import type { Listener } from '../shared/types.js'

/**
 * portless (0.10.x, the proxy mago-app's dev CLI uses) keeps its state per user
 * in ~/.portless (PORTLESS_STATE_DIR overrides): routes.json is an array of
 * { hostname, port, pid }; proxy.port / proxy.pid / proxy.tls describe the
 * proxy. The same folder holds the CA and host certificates — never read them.
 */
const routesSchema = z.array(
  z.object({
    hostname: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    pid: z.number().int().optional(),
  }),
)

export interface PortlessState {
  routes: z.infer<typeof routesSchema>
  proxyPort?: number
  proxyPid?: number
  tls: boolean
}

export function portlessDirectory(env: NodeJS.ProcessEnv = process.env) {
  return env.PORTLESS_STATE_DIR || path.join(os.homedir(), '.portless')
}

async function text(file: string) {
  return (await readFile(file, 'utf8').catch(() => '')).trim()
}

/** undefined when portless has never run for this user (or its state is unreadable). */
export async function readPortless(directory = portlessDirectory()): Promise<PortlessState | undefined> {
  const raw = await text(path.join(directory, 'routes.json'))
  if (!raw) return undefined
  let routes: PortlessState['routes']
  try {
    routes = routesSchema.parse(JSON.parse(raw))
  } catch {
    return undefined
  }
  const number = (value: string) => (/^\d+$/.test(value) ? Number(value) : undefined)
  const tls = await text(path.join(directory, 'proxy.tls'))
  return {
    routes,
    proxyPort: number(await text(path.join(directory, 'proxy.port'))),
    proxyPid: number(await text(path.join(directory, 'proxy.pid'))),
    tls: tls !== '' && tls !== '0' && tls !== 'false',
  }
}

/**
 * Joins portless routes onto listener rows by port. A route is served only
 * when this user's proxy is the one listening on the proxy port: on a shared
 * server another user's routes.json can name hostnames nobody serves for
 * them, and those must not look like working URLs.
 */
export function withPortless(rows: Listener[], state: PortlessState | undefined): Listener[] {
  if (!state?.routes.length) return rows
  const served =
    state.proxyPort !== undefined &&
    state.proxyPid !== undefined &&
    rows.some((row) => row.port === state.proxyPort && row.pid === state.proxyPid)
  const scheme = state.tls ? 'https' : 'http'
  return rows.map((row) => {
    const hostnames = [
      ...new Set(state.routes.filter((route) => route.port === row.port).map((r) => r.hostname)),
    ]
    if (!hostnames.length) return row
    return {
      ...row,
      portless: {
        hostnames,
        served,
        ...(served ? { url: `${scheme}://${hostnames[0]}:${state.proxyPort}` } : {}),
      },
    }
  })
}
