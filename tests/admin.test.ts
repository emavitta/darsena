import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { callAdmin, serveAdmin } from '../desktop/admin.js'

test('admin socket is owner-only, answers JSON and propagates errors', async (t) => {
  // Unix socket paths are short (~104 bytes on macOS): keep the dir in /tmp.
  const dir = await mkdtemp(path.join('/tmp', 'dsa-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const socket = path.join(dir, 'run', 'admin.sock')
  const server = await serveAdmin(socket, async (body) => {
    const { op } = body as { op: string }
    if (op === 'boom') throw new Error('nope')
    return { echo: op }
  })
  t.after(() => server.close())
  assert.equal((await stat(socket)).mode & 0o777, 0o600)
  assert.equal((await stat(path.dirname(socket))).mode & 0o777, 0o700)
  assert.deepEqual(await callAdmin(socket, { op: 'ping' }), { echo: 'ping' })
  await assert.rejects(callAdmin(socket, { op: 'boom' }), /nope/)
})

test('a missing daemon gives an actionable message', async () => {
  await assert.rejects(
    callAdmin(path.join(os.tmpdir(), 'darsena-missing.sock'), { op: 'status' }),
    /Darsena is not running/,
  )
})
