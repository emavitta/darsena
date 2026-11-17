import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readPortless, withPortless } from '../desktop/portless.js'
import type { Listener } from '../shared/types.js'

async function state(files: Record<string, string>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'darsena-portless-'))
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(dir, name), content)
  return dir
}

const rows: Listener[] = [
  { pid: 100, command: 'node', port: 1355, address: '*' },
  { pid: 200, command: 'node', port: 4657, address: '127.0.0.1' },
  { pid: 300, command: 'node', port: 5174, address: '127.0.0.1' },
]

test('reads routes and proxy state; joins served routes with an https URL', async (t) => {
  const dir = await state({
    'routes.json': JSON.stringify([{ hostname: 'call.localhost', port: 4657, pid: 200 }]),
    'proxy.port': '1355\n',
    'proxy.pid': '100\n',
    'proxy.tls': '1\n',
  })
  t.after(() => rm(dir, { recursive: true, force: true }))
  const portless = await readPortless(dir)
  assert.ok(portless)
  const joined = withPortless(rows, portless)
  assert.deepEqual(joined.find((r) => r.port === 4657)?.portless, {
    hostnames: ['call.localhost'],
    served: true,
    url: 'https://call.localhost:1355',
  })
  assert.equal(joined.find((r) => r.port === 5174)?.portless, undefined)
})

test('routes are «registered, no proxy for this user» when another process holds the proxy port', async (t) => {
  const dir = await state({
    'routes.json': JSON.stringify([{ hostname: 'call.localhost', port: 4657, pid: 200 }]),
    'proxy.port': '1355',
    'proxy.pid': '999',
  })
  t.after(() => rm(dir, { recursive: true, force: true }))
  const row = withPortless(rows, await readPortless(dir)).find((r) => r.port === 4657)
  assert.deepEqual(row?.portless, { hostnames: ['call.localhost'], served: false })
})

test('no state, or unreadable state, leaves rows untouched', async (t) => {
  const dir = await state({ 'routes.json': '{not json' })
  t.after(() => rm(dir, { recursive: true, force: true }))
  assert.equal(await readPortless(dir), undefined)
  assert.equal(await readPortless(path.join(dir, 'missing')), undefined)
  assert.deepEqual(withPortless(rows, undefined), rows)
})
