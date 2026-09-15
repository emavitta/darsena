import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { Store } from '../desktop/store.js'
import { fixture } from './fixture.js'

test('Android launch settings persist per project folder without requiring migration', async t => {
  const f = await fixture()
  t.after(f.cleanup)
  const store = new Store(path.join(f.directory, 'preferences'))
  store.state.projects.push(f.project)
  await store.save()
  await store.load()
  assert.equal(store.project(f.project.id).androidLaunches, undefined)
  const choices = {
    'android-app': { taskId: '["gradle","android-app",":app:assembleReceiverDebug"]', serial: 'tablet' },
    '.': { taskId: '["gradle",".",":app:assembleDebug"]', serial: 'emulator-5554' },
  }
  store.project(f.project.id).androidLaunches = choices
  await store.save()
  const reloaded = new Store(store.directory)
  await reloaded.load()
  assert.deepEqual(reloaded.project(f.project.id).androidLaunches, choices)
})
