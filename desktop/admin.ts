import { createServer, request, type Server } from 'node:http'
import { chmod, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { message } from './io.js'

/**
 * The headless daemon's admin channel: JSON over HTTP on a Unix socket in a
 * 0700 directory, the socket itself 0600. Only the owning user can reach it,
 * and no TCP port is opened. It carries what MCP must not: registering
 * projects and granting MCP access — an agent cannot grant itself access
 * through MCP, it has to be the person at the shell.
 */
export async function serveAdmin(
  socket: string,
  handle: (body: unknown) => Promise<unknown>,
): Promise<Server> {
  await mkdir(path.dirname(socket), { recursive: true, mode: 0o700 })
  await rm(socket, { force: true })
  const server = createServer(async (req, res) => {
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    if (req.method !== 'POST') return reply(405, { error: 'Use POST' })
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 65536) return reply(413, { error: 'Request too large' })
        chunks.push(Buffer.from(chunk))
      }
      reply(200, { result: await handle(JSON.parse(Buffer.concat(chunks).toString('utf8'))) })
    } catch (error) {
      reply(400, { error: message(error) })
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(socket, () => {
      server.off('error', reject)
      resolve()
    })
  })
  await chmod(socket, 0o600)
  return server
}

export function callAdmin(socket: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = request(
      { socketPath: socket, path: '/', method: 'POST', headers: { 'content-type': 'application/json' } },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              result?: unknown
              error?: string
            }
            if (parsed.error) reject(new Error(parsed.error))
            else resolve(parsed.result)
          } catch (error) {
            reject(error)
          }
        })
      },
    )
    req.on('error', (error: NodeJS.ErrnoException) =>
      reject(
        error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
          ? new Error('Darsena is not running. Start it with `darsena serve` (or `systemctl --user start darsena`).')
          : error,
      ),
    )
    req.end(JSON.stringify(body))
  })
}
