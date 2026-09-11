import { execute } from './android-worker.js'
export const adbOperations = ['start', 'stop', 'restart', 'clear', 'uninstall'] as const
export type AdbOperation = typeof adbOperations[number]
export interface AdbPlan { adb: string; cwd: string; serial: string; applicationId: string; user: string; operation: AdbOperation }
const packagePattern = /^[A-Za-z]\w*(\.[A-Za-z]\w*)+$/
export async function installedApps(adb: string, cwd: string, serial: string, run = execute) {
  const user = (await run(adb, ['-s', serial, 'shell', 'am', 'get-current-user'], cwd)).trim()
  if (!/^\d+$/.test(user)) throw new Error('Could not identify the current Android user.')
  const output = await run(adb, ['-s', serial, 'shell', 'pm', 'list', 'packages', '-3', '--user', user], cwd)
  const packages = output.split(/\r?\n/).filter(line => line.startsWith('package:')).map(line => line.slice(8).trim()).filter(value => packagePattern.test(value)).sort()
  return { user, packages: [...new Set(packages)] }
}
export async function appAction(plan: AdbPlan, run = execute) {
  if (!packagePattern.test(plan.applicationId) || !adbOperations.includes(plan.operation)) throw new Error('Invalid ADB action.')
  const current = await installedApps(plan.adb, plan.cwd, plan.serial, run)
  if (current.user !== plan.user) throw new Error('Android user changed. Refresh apps before trying again.')
  if (!current.packages.includes(plan.applicationId)) throw new Error('This app is no longer installed for the selected Android user.')
  const shell = async (args: string[]) => {
    const output = await run(plan.adb, ['-s', plan.serial, 'shell', ...args], plan.cwd)
    if (/Error:|Exception|Failure|unable to resolve|Status:\s*(?!ok\b)\S+/i.test(output)) throw new Error('Android rejected the operation. See the device output above.')
    return output
  }
  console.log(`${plan.operation}: ${plan.applicationId} · ${plan.serial} · Android user ${plan.user}`)
  if (plan.operation === 'stop' || plan.operation === 'restart') await shell(['am', 'force-stop', '--user', plan.user, plan.applicationId])
  if (plan.operation === 'clear' || plan.operation === 'uninstall') {
    const output = await shell(['pm', plan.operation === 'clear' ? 'clear' : 'uninstall', '--user', plan.user, plan.applicationId])
    if (!/^Success\s*$/m.test(output)) throw new Error('Android did not confirm success.')
  }
  if (plan.operation === 'start' || plan.operation === 'restart') await shell(['am', 'start', '--user', plan.user, '-W', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-p', plan.applicationId])
  console.log('ADB operation completed. This affects the installed app, regardless of which worktree built it.')
}
