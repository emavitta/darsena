import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { command } from './io.js'
import type { AndroidDevice } from '../shared/types.js'

export function parseDevices(output: string): AndroidDevice[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^(\S+)\s+(device|offline|unauthorized)\b(.*)$/)
    return match
      ? [
          {
            serial: match[1]!,
            state: match[2]!,
            label: (match[3]!.match(/model:(\S+)/)?.[1] || match[1]!).replaceAll('_', ' '),
          },
        ]
      : []
  })
}
export async function findAdb(cwd: string) {
  const local = await readFile(path.join(cwd, 'local.properties'), 'utf8').catch(() => '')
  const sdk = local
    .match(/^sdk\.dir\s*=\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/\\([ :\\])/g, '$1')
  const roots = [
    sdk,
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library/Android/sdk'),
  ]
  for (const root of roots) {
    if (!root) continue
    const file = path.join(root, 'platform-tools/adb')
    if (
      await access(file).then(
        () => true,
        () => false,
      )
    )
      return file
  }
  try {
    await command('adb', ['version'])
    return 'adb'
  } catch {
    throw new Error(
      'Android SDK platform-tools not found. Configure sdk.dir in this Android folder’s local.properties, or ANDROID_HOME.',
    )
  }
}
export async function androidDevices(cwd: string) {
  return parseDevices(await command(await findAdb(cwd), ['devices', '-l'], cwd))
}
export function androidVariant(taskName: string) {
  const match = taskName.match(/^(.*:)install([A-Z][A-Za-z0-9_]*)$/)
  if (!match || /AndroidTest$/.test(match[2]!)) return undefined
  const suffix = match[2]!
  return {
    assembleTask: match[1] + 'assemble' + suffix,
    variant: suffix[0]!.toLowerCase() + suffix.slice(1),
  }
}
