import { _electron as electron } from 'playwright'
import { mkdir, writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'
const f = await fixture()
const data = path.join(f.directory, 'android-data')
const sdk = path.join(f.directory, 'sdk/platform-tools')
await mkdir(data)
await mkdir(sdk, { recursive: true })
await mkdir('test-results', { recursive: true })
const android = path.join(f.root, 'android-app')
await writeFile(path.join(android, 'local.properties'), 'sdk.dir=' + path.dirname(sdk) + '\n')
await writeFile(path.join(android, 'gradlew'), `#!/usr/bin/env node
const fs = require('node:fs');const path = require('node:path');const build = path.join(process.cwd(), 'app/build');
if(process.argv.includes('--init-script')) console.log('__DARSENA_TASKS__'+JSON.stringify([{name:':app:installDebug',buildDirectory:build}]));
else { const out=path.join(build,'outputs/apk/debug');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'app.apk'),'fixture');fs.writeFileSync(path.join(out,'output-metadata.json'),JSON.stringify({artifactType:{type:'APK'},variantName:'debug',applicationId:'app.darsena.fixture',elements:[{filters:[],outputFile:'app.apk'}]}));console.log('BUILD SUCCESSFUL'); }
`)
await chmod(path.join(android, 'gradlew'), 0o755)
await writeFile(path.join(sdk, 'adb'), `#!/usr/bin/env node
if(process.argv.includes('devices')) console.log('List of devices attached\\nfixture-device device model:Fixture_Pixel\\nlocked-device unauthorized');
else if(process.argv.includes('install')) console.log('Success');
else if(process.argv.includes('shell')) console.log('Status: ok');
else process.exit(1);
`)
await chmod(path.join(sdk, 'adb'), 0o755)
await writeFile(path.join(data, 'settings.json'), JSON.stringify({ version: 1, projects: [f.project], selectedProject: f.project.id, apps: {} }))
let desktop
try {
  desktop = await electron.launch({ executablePath: process.env.DARSENA_EXECUTABLE, args: process.env.DARSENA_EXECUTABLE ? [] : ['.'], cwd: process.cwd(), env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '' } })
  const page = await desktop.firstWindow()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.getByRole('button', { name: /All tasks/ }).click()
  const group = page.getByRole('region', { name: 'Tasks in android-app', exact: true })
  assert.equal(await page.getByRole('button', { name: 'Run on Android…', exact: true }).count(), 0)
  await group.getByRole('button', { name: 'Favorite task Run on Android', exact: true }).click()
  await page.getByRole('button', { name: /Favorites/ }).click()
  await group.getByRole('button', { name: 'Run Run on Android in android-app', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Run on Android', exact: true })
  await dialog.getByRole('button', { name: 'Load Android variants' }).click()
  await eventually(async () => await dialog.getByRole('combobox').nth(0).innerText() === ':app:Debug')
  await eventually(async () => (await dialog.getByRole('combobox').nth(1).innerText()).includes('Fixture Pixel'))
  await dialog.getByRole('combobox').nth(1).click()
  assert.ok(await dialog.getByRole('option', { name: /locked-device/ }).getAttribute('aria-disabled') === 'true')
  await page.keyboard.press('Escape')
  assert.ok(await dialog.isVisible())
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.screenshot({ path: 'test-results/android-launch-' + theme + '.png', animations: 'disabled' })
  }
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 680))
  await dialog.getByRole('button', { name: 'Build, install & launch' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/android-launch-compact.png', animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Build, install & launch' }).click()
  await dialog.waitFor({ state: 'detached' })
  await eventually(async () => (await page.evaluate(() => window.darsena.call('runs'))).some(r => r.name.startsWith('Android') && r.status === 'succeeded'))
  const run = (await page.evaluate(() => window.darsena.call('runs')))[0]
  const logs = await page.evaluate(id => window.darsena.call('logs', { runId: id }), run.id)
  assert.match(logs, /\[1\/3\] Build/)
  assert.match(logs, /\[2\/3\] Install/)
  assert.match(logs, /\[3\/3\] Launch/)
  assert.match(logs, /does not track or stop its lifetime/)
  assert.equal(run.worktree, f.root)
  assert.equal(run.folder, android)
  assert.equal(run.taskId, JSON.stringify(['gradle', 'android-app', 'darsena:android-launch']))
  assert.equal(run.androidDevice, 'fixture-device')
  assert.equal(await page.getByRole('button', { name: 'Activity', exact: true }).getAttribute('aria-expanded'), 'true')
  assert.deepEqual(errors, [])
  console.log('PASS: Android variant/device picker, disabled unauthorized device, modal overlay, managed build/install/launch and terminal history. Only fixture Gradle/ADB were executed.')
} finally { if (desktop) await desktop.close(); await f.cleanup() }
