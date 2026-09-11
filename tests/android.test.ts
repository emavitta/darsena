import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { androidVariant, parseDevices } from '../desktop/android.js'
import { deploy, findApk, type AndroidPlan } from '../desktop/android-worker.js'

test('Android variants exclude tests, and devices retain authorization state', () => {
  assert.deepEqual(androidVariant(':mobile:installDemoDebug'), {
    assembleTask: ':mobile:assembleDemoDebug',
    variant: 'demoDebug',
  })
  assert.equal(androidVariant(':app:installDebugAndroidTest'), undefined)
  assert.equal(androidVariant(':app:assembleDebug'), undefined)
  assert.deepEqual(
    parseDevices(
      'List of devices attached\nemulator-5554 device product:sdk model:Pixel_9\nabc unauthorized\nxyz offline\n',
    ),
    [
      { serial: 'emulator-5554', state: 'device', label: 'Pixel 9' },
      { serial: 'abc', state: 'unauthorized', label: 'abc' },
      { serial: 'xyz', state: 'offline', label: 'xyz' },
    ],
  )
})

test('Android deployment targets one device, respects build failure and rejects unsafe/ambiguous APKs', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'darsena-android-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const buildDirectory = path.join(root, 'custom-build')
  const out = path.join(buildDirectory, 'outputs/apk/demo/debug')
  await mkdir(out, { recursive: true })
  const metadata = {
    artifactType: { type: 'APK' },
    variantName: 'demoDebug',
    applicationId: 'app.darsena.fixture',
    elements: [{ filters: [], outputFile: 'app.apk' }],
  }
  const save = () => writeFile(path.join(out, 'output-metadata.json'), JSON.stringify(metadata))
  await save()
  await writeFile(path.join(out, 'app.apk'), 'fixture')
  const plan: AndroidPlan = {
    cwd: root,
    worktree: root,
    buildDirectory,
    assembleTask: ':mobile:assembleDemoDebug',
    variant: 'demoDebug',
    adb: '/sdk/adb',
    serial: 'device:123',
  }
  const calls: string[][] = []
  await deploy(plan, async (command, args) => {
    calls.push([command, ...args])
    return args.includes('install') ? 'Success' : 'Status: ok'
  })
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[0], [
    './gradlew',
    '--no-daemon',
    '--console=plain',
    ':mobile:assembleDemoDebug',
  ])
  assert.deepEqual(calls[1]?.slice(0, 5), ['/sdk/adb', '-s', 'device:123', 'install', '-r'])
  assert.equal(calls[2]?.at(-1), 'app.darsena.fixture')
  let count = 0
  await assert.rejects(
    deploy(plan, async () => {
      count++
      throw new Error('Build failed')
    }),
    /Build failed/,
  )
  assert.equal(count, 1)
  await assert.rejects(
    deploy(plan, async (_, args) =>
      args.includes('install')
        ? 'Success'
        : args.includes('shell')
          ? 'Error: Activity not found'
          : '',
    ),
    /could not launch/,
  )
  await rm(path.join(out, 'app.apk'))
  const outside = path.join(root, 'elsewhere.apk')
  await writeFile(outside, 'outside')
  await symlink(outside, path.join(out, 'app.apk'))
  await assert.rejects(findApk(plan), /outside/)
  metadata.elements.push({ filters: [], outputFile: 'second.apk' })
  await save()
  await assert.rejects(findApk(plan), /split APK/)
})
