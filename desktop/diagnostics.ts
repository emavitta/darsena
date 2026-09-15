import { access, stat, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveFolder } from './io.js'
import type { EnvironmentCheck, TaskCatalog } from '../shared/types.js'

export async function executablePath(
  name: string,
  cwd: string,
  searchPath = process.env.PATH || '',
) {
  const candidates = name.includes('/')
    ? [path.resolve(cwd, name)]
    : searchPath
        .split(path.delimiter)
        .filter(Boolean)
        .map((dir) => path.resolve(cwd, dir, name))
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK)
      if ((await stat(candidate)).isFile()) return candidate
    } catch {
      /* Try the next PATH entry. */
    }
  }
}

export async function environmentChecks(
  cwd: string,
  catalog: TaskCatalog,
): Promise<EnvironmentCheck[]> {
  const names = new Set([
    'git',
    ...catalog.tasks.filter((t) => t.command && !t.command.includes('/')).map((t) => t.command),
  ])
  if (catalog.sources.some((s) => s.kind === 'script')) names.add('node')
  if (catalog.sources.some((s) => s.kind === 'gradle')) names.add('java')
  const checks = await Promise.all(
    [...names].sort().map(async (name) => {
      const resolved = await executablePath(name, cwd)
      return {
        name,
        path: resolved,
        hint: resolved
          ? 'Executable found. This does not verify its version or project compatibility.'
          : `Install ${name} or add it to your shell PATH, then restart Darsena.`,
      }
    }),
  )
  for (const source of catalog.sources.filter((s) => s.kind === 'gradle')) {
    const folder = await resolveFolder(cwd, source.folder)
    const local = await readFile(path.join(folder, 'local.properties'), 'utf8').catch(() => '')
    const sdk = local
      .match(/^sdk\.dir\s*=\s*(.+)$/m)?.[1]
      ?.trim()
      .replace(/\\([ :\\])/g, '$1')
    const roots = [
      sdk,
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      path.join(os.homedir(), 'Library/Android/sdk'),
    ].filter(Boolean) as string[]
    let adb: string | undefined
    for (const root of roots) {
      adb = await executablePath(path.join(root, 'platform-tools/adb'), folder)
      if (adb) break
    }
    adb ||= await executablePath('adb', folder)
    checks.push({
      name: 'Android platform-tools · ' + source.folder,
      path: adb,
      hint: adb
        ? 'adb found. Device connection and authorization are checked when selecting a device.'
        : 'Install Android SDK Platform-Tools in Android Studio and configure sdk.dir in this folder’s local.properties.',
    })
  }
  return checks
}
