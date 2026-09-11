import test from 'node:test'
import assert from 'node:assert/strict'
import { appAction, type AdbPlan } from '../desktop/adb-actions.js'
const plan: AdbPlan = { adb: 'adb', cwd: '/tmp', serial: 'device-1', user: '10', applicationId: 'app.test.demo', operation: 'restart' }
function fake(response = 'Status: ok') {
  const calls: string[][] = []
  const run = async (_file: string, args: string[]) => {
    calls.push(args)
    if (args.includes('get-current-user')) return '10'
    if (args.includes('packages')) return 'package:app.test.demo\n'
    return response
  }
  return { calls, run }
}
test('ADB restart targets device/user/package and never invokes Gradle', async () => {
  const f = fake()
  await appAction(plan, f.run)
  assert.equal(f.calls.length, 4)
  assert.deepEqual(f.calls[2], ['-s', 'device-1', 'shell', 'am', 'force-stop', '--user', '10', 'app.test.demo'])
  assert.ok(f.calls[3]!.includes('start'))
  assert.ok(f.calls.every(args => args[1] === 'device-1'))
})
test('ADB clear/uninstall require confirmed device success and target only the current user', async () => {
  for (const operation of ['clear', 'uninstall'] as const) {
    const f = fake('Success\n')
    await appAction({ ...plan, operation }, f.run)
    assert.deepEqual(f.calls[2], ['-s', 'device-1', 'shell', 'pm', operation, '--user', '10', 'app.test.demo'])
    await assert.rejects(appAction({ ...plan, operation }, fake('Failure [DENIED]').run), /rejected/)
    await assert.rejects(appAction({ ...plan, operation }, fake('').run), /confirm success/)
  }
})
test('ADB rejects changed user, unknown package and failed launch', async () => {
  await assert.rejects(appAction({ ...plan, user: '0' }, fake().run), /user changed/)
  await assert.rejects(appAction({ ...plan, applicationId: 'app.not.installed' }, fake().run), /no longer installed/)
  await assert.rejects(appAction({ ...plan, operation: 'start' }, fake('Error: unable to resolve Intent').run), /rejected/)
  await assert.rejects(appAction({ ...plan, applicationId: 'a;reboot' }, fake().run), /Invalid/)
})
