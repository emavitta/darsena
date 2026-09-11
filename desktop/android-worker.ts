import { spawn } from 'node:child_process'
import { readFile, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { inside } from './io.js'

export interface AndroidPlan {
  cwd: string
  worktree: string
  buildDirectory: string
  assembleTask: string
  variant: string
  adb: string
  serial: string
}
export async function findApk(plan: AndroidPlan) {
  const root = await realpath(plan.worktree)
  const directory = await realpath(path.join(plan.buildDirectory, 'outputs/apk'))
  if (!inside(root, directory))
    throw new Error('APK output must stay inside the selected worktree.')
  const matches: { file: string; applicationId: string }[] = []
  async function visit(dir: string, depth: number) {
    if (depth > 8) return
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) await visit(file, depth + 1)
      if (entry.isFile() && entry.name === 'output-metadata.json') {
        const metadata = JSON.parse(await readFile(file, 'utf8'))
        if (metadata.variantName !== plan.variant || metadata.artifactType?.type !== 'APK') continue
        if (!/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(metadata.applicationId))
          throw new Error('Invalid Android application ID.')
        const elements = metadata.elements?.filter(
          (e: { filters?: unknown[] }) => !e.filters?.length,
        )
        if (elements?.length !== 1)
          throw new Error(
            'This variant requires split APK selection. Use Android Studio for this variant.',
          )
        const apk = await realpath(path.resolve(dir, elements[0].outputFile))
        if (!inside(directory, apk) || !apk.endsWith('.apk'))
          throw new Error('APK path is outside the selected build output.')
        matches.push({ file: apk, applicationId: metadata.applicationId })
      }
    }
  }
  await visit(directory, 0)
  if (matches.length !== 1)
    throw new Error(
      'Could not identify a unique APK for ' +
        plan.variant +
        '. Use Android Studio to inspect this build’s outputs.',
    )
  return matches[0]!
}
export function execute(file: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
      output = (output + chunk).slice(-1024 * 1024)
    })
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve(output) : reject(new Error(file + ' failed (exit ' + code + ').')),
    )
  })
}
export async function deploy(plan: AndroidPlan, run = execute) {
  console.log('[1/3] Build ' + plan.assembleTask)
  await run('./gradlew', ['--no-daemon', '--console=plain', plan.assembleTask], plan.cwd)
  const apk = await findApk(plan)
  console.log('[2/3] Install ' + apk.applicationId + ' on ' + plan.serial)
  const installed = await run(plan.adb, ['-s', plan.serial, 'install', '-r', apk.file], plan.cwd)
  if (!/Success/.test(installed))
    throw new Error('Android did not confirm installation. The app was not launched.')
  process.send?.({ type: 'installed', applicationId: apk.applicationId })
  console.log('[3/3] Launch ' + apk.applicationId)
  const launched = await run(
    plan.adb,
    [
      '-s',
      plan.serial,
      'shell',
      'am',
      'start',
      '-W',
      '-a',
      'android.intent.action.MAIN',
      '-c',
      'android.intent.category.LAUNCHER',
      '-p',
      apk.applicationId,
    ],
    plan.cwd,
  )
  if (/Error:|Exception|unable to resolve|Status:\s*(?!ok\b)\S+/i.test(launched))
    throw new Error('Android could not launch the application. See the device output above.')
  console.log(
    'Deployment complete. The app is running independently on the device; Darsena does not track or stop its lifetime.',
  )
}
