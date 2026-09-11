import { electron } from './desktop-launch.mjs'
import { mkdir, writeFile, chmod, access } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'

const f = await fixture()
const data = path.join(f.directory, 'task-sources-data')
const folder = 'android-app'
// A tiny fixture wrapper supplies Gradle's report protocol, without a Gradle build or download.
async function wrapper(root, tasks) {
  const file = path.join(root, folder, 'gradlew')
  await writeFile(
    file,
    `#!/bin/sh\nprintf '%s\\n' '__DARSENA_TASKS__${JSON.stringify(tasks)}'\ntouch .source-loaded\n`,
  )
  await chmod(file, 0o755)
}
for (const root of [f.root, f.linked]) await wrapper(root, [{ name: ':app:assembleDebug' }])
f.project.customTasks = [
  { id: 'custom-check', name: 'custom-check', folder: '.', command: 'echo', args: ['fixture'] },
]
await mkdir(data)
await mkdir('test-results', { recursive: true })
await writeFile(
  path.join(data, 'settings.json'),
  JSON.stringify({
    version: 1,
    projects: [f.project],
    selectedProject: f.project.id,
    apps: {},
  }),
)
let desktop
try {
  desktop = await electron.launch({
    args: [process.env.DARSENA_TEST_ASAR || '.'],
    cwd: process.cwd(),
    env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '' },
  })
  assert.equal(await desktop.evaluate(({ app }) => app.getPath('userData')), data)
  const page = await desktop.firstWindow()
  page.setDefaultTimeout(6000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()
  const tasks = page.locator('.tasks-section')
  const sources = tasks.locator('details')
  await tasks.getByText('1 to load', { exact: true }).waitFor()
  assert.equal(await sources.getAttribute('open'), null)
  // Discovering the project and opening Sources must never evaluate a Gradle build automatically.
  await assert.rejects(access(path.join(f.root, folder, '.source-loaded')))
  await tasks.getByRole('button', { name: /All tasks/ }).click()
  await tasks.getByRole('button', { name: 'Run check in .', exact: true }).waitFor()
  await tasks.getByRole('button', { name: 'Run custom-check in .', exact: true }).waitFor()
  await sources.locator('summary').click()
  await sources.getByText('NPM', { exact: true }).waitFor()
  await sources.getByText('Gradle', { exact: true }).waitFor()
  await sources.getByText('Custom commands', { exact: true }).waitFor()
  await assert.rejects(access(path.join(f.root, folder, '.source-loaded')))
  await sources.getByRole('button', { name: `Sync Gradle in ${folder}`, exact: true }).click()
  const gradleRun = tasks.getByRole('button', {
    name: `Run :app:assembleDebug in ${folder}`,
    exact: true,
  })
  await gradleRun.waitFor()
  await eventually(() => gradleRun.isEnabled())
  await access(path.join(f.root, folder, '.source-loaded'))
  assert.equal(await tasks.getByText('1 to load', { exact: true }).count(), 0)
  for (const name of ['check', ':app:assembleDebug', 'custom-check'])
    await tasks.getByRole('button', { name: `Favorite task ${name}`, exact: true }).click()
  await tasks.getByRole('button', { name: 'Favorites 3', exact: true }).click()
  assert.equal(await tasks.locator('.task-row').count(), 3)
  await sources.locator('summary').click()
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.waitForTimeout(180)
    await page.mouse.move(40, 40)
    await page.screenshot({
      path: `test-results/unified-tasks-${theme}.png`,
      animations: 'disabled',
    })
  }
  await page.getByRole('button', { name: /feature worktree/ }).click()
  await page.getByRole('heading', { name: 'feature worktree', exact: true }).waitFor()
  await tasks.getByText('1 to load', { exact: true }).waitFor()
  assert.equal(await tasks.locator('.task-row').count(), 3)
  assert.ok(await gradleRun.isDisabled())
  await tasks.getByText('Load this task’s source in Sources.').waitFor()
  await sources.locator('summary').click()
  await sources.getByRole('button', { name: `Sync Gradle in ${folder}`, exact: true }).click()
  await eventually(() => gradleRun.isEnabled())
  // An explicitly loaded empty report is ready, and a removed favorite is unavailable, not un-loaded.
  await wrapper(f.linked, [])
  await sources
    .getByRole('button', { name: `Sync Gradle in ${folder}`, exact: true })
    .click()
  await sources.getByText('0 tasks', { exact: true }).waitFor()
  assert.ok(await gradleRun.isDisabled())
  await tasks.getByText('Unavailable in this worktree', { exact: true }).waitFor()
  assert.equal(await tasks.getByText('1 to load', { exact: true }).count(), 0)
  await sources.locator('summary').click()
  await tasks.getByRole('button', { name: /All tasks/ }).click()
  await tasks.getByRole('textbox', { name: 'Search tasks' }).fill('assembleDebug')
  assert.equal(await tasks.locator('.task-row').count(), 1)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: one task list and favorites across npm, Gradle and custom commands; explicit source loading; per-worktree availability; empty-report and missing-favorite states. Only a fixture wrapper was invoked.',
  )
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
