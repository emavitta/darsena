import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error Policy is shared with executable MJS smoke scripts.
import { assertDesktopLaunchAllowed } from './desktop-launch-policy.mjs'
test('desktop tests block local launches unless explicitly opted in', () => {
  assert.throws(() => assertDesktopLaunchAllowed({}), /keyboard focus/)
  assert.throws(() => assertDesktopLaunchAllowed({ CI: 'true' }), /keyboard focus/)
  assert.doesNotThrow(() => assertDesktopLaunchAllowed({ GITHUB_ACTIONS: 'true' }))
  assert.doesNotThrow(() => assertDesktopLaunchAllowed({ DARSENA_ALLOW_INTERACTIVE_TESTS: '1' }))
})
