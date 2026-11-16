import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { poolOf, readRepoConfig, toPool } from '../desktop/repo-config.js'

test('range, ports and port expand to the ports they cover', () => {
  assert.deepEqual(toPool({ name: 'call service', range: [5174, 5177] }), {
    name: 'call service',
    ports: [5174, 5175, 5176, 5177],
  })
  assert.deepEqual(toPool({ name: 'WTC UI', ports: [5190, 5191, 5190] }), {
    name: 'WTC UI',
    ports: [5190, 5191],
  })
  assert.deepEqual(toPool({ name: 'Admin Console', port: 8080 }), {
    name: 'Admin Console',
    ports: [8080],
  })
})

test('ambiguous or malformed entries are refused with the reason', () => {
  assert.throws(() => toPool({ name: 'x', pool: [5174, 5183] }), /ambiguous.*range.*ports/)
  assert.throws(() => toPool({ name: 'x', port: 1, ports: [2] }), /exactly one/)
  assert.throws(() => toPool({ name: 'x' }), /exactly one/)
  assert.throws(() => toPool({ name: 'x', range: [5183, 5174] }), /backwards/)
  assert.throws(() => toPool({ name: 'x', range: [1, 5000] }), /more than/)
  assert.throws(() => toPool({ name: 'x', port: 70000 }), /port entry/)
  assert.throws(() => toPool({ name: '', port: 80 }), /port entry/)
  assert.throws(() => toPool({ name: 'x', port: 80, extra: true }), /port entry/)
})

test('readRepoConfig: no file, a valid file, a broken file', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'darsena-repo-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  assert.deepEqual(await readRepoConfig(dir), { pools: [] })

  await writeFile(
    path.join(dir, 'darsena.json'),
    JSON.stringify({
      ports: [
        { name: 'call service', range: [5174, 5183] },
        { name: 'WTC UI', ports: [5190, 5191] },
        { name: 'Admin Console', port: 8080 },
      ],
      future: { ignored: true },
    }),
  )
  const config = await readRepoConfig(dir)
  assert.equal(config.error, undefined)
  assert.equal(poolOf(5183, config.pools), 'call service')
  assert.equal(poolOf(5191, config.pools), 'WTC UI')
  assert.equal(poolOf(8080, config.pools), 'Admin Console')
  assert.equal(poolOf(5184, config.pools), undefined)

  await writeFile(path.join(dir, 'darsena.json'), '{"ports": [{"name": "x", "pool": [1, 2]}]}')
  const broken = await readRepoConfig(dir)
  assert.deepEqual(broken.pools, [])
  assert.match(broken.error ?? '', /darsena\.json.*ambiguous/)
})
