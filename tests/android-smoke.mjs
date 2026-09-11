import { electron } from './desktop-launch.mjs'
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
else if(process.argv.includes('get-current-user')) console.log('0');
else if(process.argv.includes('packages')) console.log('package:app.darsena.fixture'+(process.argv.includes('-U')?' uid:10001':''));
else if(process.argv.includes('ps')) console.log('10001 42 app.darsena.fixture');
else if(process.argv.includes('logcat')) { console.log('09-11 12:00:00.000 42 42 E App: fixture error');setInterval(()=>console.log('09-11 12:00:01.000 42 42 I App: fixture info'),200); }
else if(process.argv.includes('clear') || process.argv.includes('uninstall')) console.log('Success');
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
  await dialog.getByRole('button', { name: 'Sync Gradle' }).click()
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
  assert.equal(run.androidApplicationId, 'app.darsena.fixture')
  await page.getByRole('button', { name: 'Follow Logcat', exact: true }).click()
  await page.getByLabel('Search Logcat').waitFor()
  await eventually(async () => (await page.evaluate(() => window.darsena.call('runs'))).some(r => r.androidOperation === 'logcat' && r.logcat?.state === 'running'))
  await page.getByLabel('Search Logcat').fill('fixture error')
  await eventually(async () => (await page.locator('.logcat-text').innerText()).includes('fixture error'))
  assert.ok(!(await page.locator('.logcat-text').innerText()).includes('fixture info'))
  await page.screenshot({ path: 'test-results/android-logcat.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Stop Logcat', exact: true }).click()
  await eventually(async () => (await page.evaluate(() => window.darsena.call('runs'))).some(r => r.androidOperation === 'logcat' && r.status === 'stopped'))
  // ADB actions operate on an explicitly selected installed app without a build.
  async function openActions() {
    await group.getByRole('button', { name: 'Run Run on Android in android-app', exact: true }).click()
    await dialog.getByRole('button', { name: 'ADB actions', exact: true }).click()
    const picker = dialog.getByRole('combobox', { name: 'Installed application ID' })
    await eventually(async () => !(await picker.isDisabled()))
    await picker.click()
    await dialog.getByRole('option', { name: 'app.darsena.fixture', exact: true }).click()
  }
  await openActions()
  await dialog.getByRole('button', { name: 'App actions', exact: true }).click()
  await dialog.getByRole('menuitem', { name: 'Restart app', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  await eventually(async () => (await page.evaluate(() => window.darsena.call('runs'))).some(r => r.name.startsWith('ADB · restart') && r.status === 'succeeded'))
  const adbRun = (await page.evaluate(() => window.darsena.call('runs'))).find(r => r.name.startsWith('ADB'))
  assert.equal(adbRun.androidDevice, 'fixture-device')
  assert.match(adbRun.command, /app.darsena.fixture/)
  const adbLogs = await page.evaluate(id => window.darsena.call('logs', { runId: id }), adbRun.id)
  assert.doesNotMatch(adbLogs, /BUILD SUCCESSFUL/)
  await openActions()
  await dialog.getByRole('button', { name: 'App actions', exact: true }).click()
  await dialog.getByRole('menuitem', { name: 'Clear app data…', exact: true }).click()
  const confirmation = dialog.getByRole('group', { name: 'Confirm Android operation' })
  await confirmation.waitFor()
  const before = (await page.evaluate(() => window.darsena.call('runs'))).length
  await confirmation.getByRole('button', { name: 'Cancel action' }).click()
  assert.equal((await page.evaluate(() => window.darsena.call('runs'))).length, before)
  await dialog.getByRole('button', { name: 'App actions', exact: true }).click()
  await dialog.getByRole('menuitem', { name: 'Clear app data…', exact: true }).click()
  await confirmation.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/adb-confirm.png', animations: 'disabled' })
  await confirmation.getByRole('button', { name: 'Clear app data', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  await eventually(async () => (await page.evaluate(() => window.darsena.call('runs'))).some(r => r.name.startsWith('ADB · clear') && r.status === 'succeeded'))
  assert.deepEqual(errors, [])
  console.log('PASS: Android variant/device picker, disabled unauthorized device, modal overlay, managed build/install/launch and terminal history. Only fixture Gradle/ADB were executed.')
} finally { if (desktop) await desktop.close(); await f.cleanup() }
