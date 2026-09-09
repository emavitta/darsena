import { spawn } from 'node:child_process'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { command } from './io.js'
import { isWindows } from './platform.js'
import { windowsExecutable } from './windows-command.js'
import { powershell, powershellArgs } from './windows-system.js'
import type { AppId } from '../shared/types.js'

const macApps = {
  vscode: 'Visual Studio Code',
  terminal: 'Terminal',
  'android-studio': 'Android Studio',
}
export function windowsApp(target: Exclude<AppId, 'finder'>, selected?: string) {
  if (selected) return windowsExecutable(selected)
  const local = process.env.LOCALAPPDATA || ''
  const programs = process.env.ProgramFiles || 'C:\\Program Files'
  const candidates =
    target === 'vscode'
      ? [
          path.join(local, 'Programs/Microsoft VS Code/Code.exe'),
          path.join(programs, 'Microsoft VS Code/Code.exe'),
        ]
      : target === 'android-studio'
        ? [path.join(programs, 'Android/Android Studio/bin/studio64.exe')]
        : [path.join(local, 'Microsoft/WindowsApps/wt.exe'), powershell]
  const found = candidates.find((file) => existsSync(file))
  if (!found) throw new Error(`Choose the ${macApps[target]} executable in Preferences.`)
  return found
}
export function windowsOpenArgs(
  target: Exclude<AppId, 'finder'>,
  executable: string,
  folder: string,
) {
  if (target !== 'terminal') return [folder]
  const name = path.basename(executable).toLowerCase()
  if (name === 'wt.exe') return ['-d', folder]
  if (['powershell.exe', 'pwsh.exe'].includes(name))
    return [
      '-NoExit',
      ...powershellArgs(`Set-Location -LiteralPath '${folder.replace(/'/g, "''")}'`).filter(
        (arg) => arg !== '-NonInteractive',
      ),
    ]
  if (name === 'cmd.exe') return ['/d', '/k'] // cwd is passed as a process option.
  throw new Error(
    'Choose Windows Terminal (wt.exe), PowerShell (powershell.exe or pwsh.exe), or cmd.exe.',
  )
}
export async function openApplication(
  target: Exclude<AppId, 'finder'>,
  folder: string,
  selected?: string,
) {
  if (!isWindows) {
    await command('/usr/bin/open', ['-a', selected || macApps[target], folder])
    return
  }
  const file = windowsApp(target, selected)
  const child = spawn(file, windowsOpenArgs(target, file, folder), {
    cwd: folder,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', reject)
  })
  child.unref()
}
