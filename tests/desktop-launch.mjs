import { _electron } from 'playwright'
import { assertDesktopLaunchAllowed } from './desktop-launch-policy.mjs'
// Fail at import time, before fixtures or Electron are started.
assertDesktopLaunchAllowed(process.env)
export const electron = {
  launch(options) {
    assertDesktopLaunchAllowed(process.env)
    return _electron.launch(options)
  },
}
