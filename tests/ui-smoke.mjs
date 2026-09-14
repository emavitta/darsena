import { electron } from './desktop-launch.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'
import { taskId } from '../desktop/tasks.ts'
import { listeners } from '../desktop/processes.ts'

const f = await fixture()
await mkdir('test-results', { recursive: true })
const data = path.join(f.directory, 'app-data')
await mkdir(data)
const reservation = net.createServer()
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve))
const port = reservation.address().port
await new Promise((resolve) => reservation.close(resolve))
const serveId = taskId('script', '.', 'serve')
f.project.favorites = [serveId, taskId('script', '.', 'check')]
f.project.taskPreferences[serveId] = { port }
await writeFile(
  path.join(data, 'settings.json'),
  JSON.stringify({ version: 1, projects: [f.project], selectedProject: f.project.id, apps: {} }),
)
let desktop
try {
  desktop = await electron.launch({
    executablePath: process.env.DARSENA_EXECUTABLE,
    args: process.env.DARSENA_EXECUTABLE ? [] : ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DARSENA_DATA_DIR: data,
      DARSENA_TEST_PORT: String(port),
      DARSENA_DEV_URL: '',
    },
  })
  const page = await desktop.firstWindow()
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'Open Android app in Android Studio', exact: true })
      .count(),
    1,
  )
  await page.screenshot({ path: 'test-results/workspace-light.png', animations: 'disabled' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: 'test-results/workspace-dark.png', animations: 'disabled' })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.getByRole('button', { name: 'Run check in .', exact: true }).click()
  await page.getByText('Check completed in', { exact: false }).waitFor()
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'harbor-project', exact: true })
    .click()
  await page.getByRole('button', { name: 'Run serve in .', exact: true }).click()
  await page.locator('.log-output').filter({ hasText: `Ready at http://127.0.0.1:${port}` }).waitFor()
  const activityToggle = page.getByRole('button', { name: 'Activity', exact: true })
  assert.equal(await activityToggle.getAttribute('aria-expanded'), 'true')
  assert.ok(await page.getByRole('heading', { name: 'harbor-project', exact: true }).isVisible())
  assert.ok(await page.locator('.worktree-column').isVisible())
  const selectedBeforeCollapse = await page.evaluate(() => window.darsena.call('state'))
  await activityToggle.click()
  assert.equal(await activityToggle.getAttribute('aria-expanded'), 'false')
  assert.ok(await page.getByRole('region', { name: 'Activity dock', exact: true }).isVisible())
  assert.ok((await listeners()).some((listener) => listener.port === port))
  await activityToggle.click()
  assert.deepEqual(await page.evaluate(() => window.darsena.call('state')), selectedBeforeCollapse)
  await page.getByRole('button', { name: 'Collapse projects sidebar', exact: true }).click()
  assert.equal(await page.getByRole('complementary').isVisible(), true)
  assert.equal((await page.getByRole('complementary').boundingBox()).width, 64)
  assert.ok(await page.getByRole('complementary').getByRole('button', { name: 'harbor-project', exact: true }).isVisible())
  assert.equal(await activityToggle.getAttribute('aria-expanded'), 'true')
  assert.deepEqual(await page.evaluate(() => window.darsena.call('state')), selectedBeforeCollapse)
  await page.screenshot({ path: 'test-results/activity-sidebar-hidden.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Expand projects sidebar', exact: true }).click()
  assert.ok(await page.getByRole('complementary').isVisible())
  const dockBounds = await page.getByRole('region', { name: 'Activity dock', exact: true }).boundingBox()
  const sidebarBounds = await page.getByRole('complementary').boundingBox()
  assert.ok(dockBounds.x < sidebarBounds.x + sidebarBounds.width)
  await page.getByRole('button', { name: 'Collapse Activity panel', exact: true }).click()
  await page.screenshot({ path: 'test-results/activity-detached-collapsed.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Open Activity panel', exact: true }).click()
  await page.screenshot({ path: 'test-results/activity.png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: 'test-results/activity-detached-dark.png', animations: 'disabled' })
  await page.emulateMedia({ colorScheme: 'light' })
  // Closing the native window must preserve the managed task.
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  assert.equal(
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
    false,
  )
  assert.ok((await listeners()).some((l) => l.port === port))
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show())
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'harbor-project', exact: true })
    .click()
  await page.getByRole('button', { name: /feature worktree/ }).click()
  await page.getByRole('heading', { name: 'feature worktree', exact: true }).waitFor()
  assert.equal(await activityToggle.getAttribute('aria-expanded'), 'true')
  assert.match(await page.locator('.log-output').innerText(), /Ready at/)
  await page.screenshot({ path: 'test-results/activity-worktree-context.png' })
  await page.getByRole('button', { name: 'Run serve in .', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Stop there & start here', exact: true }).click()
  await page.locator('.inspector-worktree').filter({ hasText: 'feat/harbor-view' }).waitFor()
  await page.locator('.run-state').getByText('Running', { exact: true }).waitFor()
  await page.locator('.log-output').filter({ hasText: `Ready at http://127.0.0.1:${port}` }).waitFor()
  const runningTasks = page.getByRole('region', { name: 'Running tasks', exact: true })
  const taskHistory = page.getByRole('region', { name: 'Task history', exact: true })
  await runningTasks.getByRole('button').filter({ hasText: 'feat/harbor-view' }).waitFor()
  assert.equal(await runningTasks.getByRole('button').count(), 1)
  await page.getByRole('tab', { name: /^History / }).click()
  await taskHistory.getByRole('button').filter({ hasText: 'serve' }).waitFor()
  assert.match(
    await taskHistory.getByRole('button').filter({ hasText: 'serve' }).innerText(),
    /Stopped/,
  )
  const response = await fetch(`http://127.0.0.1:${port}`)
  assert.equal(await response.text(), f.linked)
  await page.getByRole('tab', { name: 'Listening ports', exact: true }).click()
  await page.getByText(`:${port}`, { exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/listeners.png' })
  await page.getByRole('tab', { name: /^Running /  }).click()
  await page.getByRole('button', { name: /^Stop all/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Stop 1 tasks', exact: true }).click()
  await page.locator('.run-state').getByText('Stopped', { exact: true }).waitFor()
  await eventually(async () => (await runningTasks.getByRole('button').count()) === 0)
  assert.match(await page.locator('.log-output').innerText(), /Ready at/)
  await page.screenshot({ path: 'test-results/activity-stopped-light.png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: 'test-results/activity-stopped-dark.png' })
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 680))
  const logBox = await page.locator('.log-output').boundingBox()
  const viewportHeight = await page.evaluate(() => innerHeight)
  assert.ok(
    logBox && logBox.height >= 64 && logBox.y + logBox.height <= viewportHeight + 1,
    'Logs remain visible in the compact dock',
  )
  await page.screenshot({ path: 'test-results/activity-stopped-compact.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'harbor-project', exact: true })
    .click()
  await page.getByRole('button', { name: 'Run serve in .', exact: true }).click()
  await page.locator('.log-output').filter({ hasText: `Ready at http://127.0.0.1:${port}` }).waitFor()
  assert.deepEqual(browserErrors, [])
  // Real app quit performs managed shutdown; it must release the server port.
  const exited = desktop.waitForEvent('close')
  await desktop.evaluate(({ app }) => app.quit()).catch(() => {})
  await exited
  desktop = undefined
  await eventually(async () => !(await listeners()).some((l) => l.port === port))
  console.log(
    'PASS: UI, task execution, cross-worktree favorite, port conflict, transfer, close-window persistence, and quit cleanup.',
  )
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
