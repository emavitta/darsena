import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UpdateInstaller } from '../desktop/update-installer.js'

test('installation is explicit, rejects active tasks and never follows download automatically', async () => {
  let installs = 0,
    downloads = 0
  const installer = new UpdateInstaller({
    prepare: async () => {},
    download: async () => {
      downloads++
    },
    install: () => {
      installs++
    },
  })
  assert.throws(() => installer.install(0), /Download/)
  await Promise.all([installer.download(), installer.download()])
  assert.equal(downloads, 1)
  assert.equal(installs, 0)
  assert.equal(installer.status.phase, 'ready')
  assert.throws(() => installer.install(1), /Stop running/)
  assert.equal(installer.status.phase, 'ready')
  installer.install(0)
  assert.equal(installs, 1)
  assert.equal(installer.status.phase, 'installing')
})
test('failed download can be retried without installing an incomplete update', async () => {
  let attempts = 0
  const installer = new UpdateInstaller({
    prepare: async () => {},
    download: async () => {
      if (!attempts++) throw Error('Network unavailable')
    },
    install: () => {},
  })
  await installer.download()
  assert.equal(installer.status.phase, 'error')
  assert.throws(() => installer.install(0), /Download/)
  await installer.download()
  assert.equal(installer.status.phase, 'ready')
  assert.equal(installer.status.error, undefined)
})
