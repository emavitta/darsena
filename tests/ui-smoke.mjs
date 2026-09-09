import { _electron as electron } from 'playwright'
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
  await page.getByText(`Ready at http://127.0.0.1:${port}`, { exact: false }).waitFor()
  await page.screenshot({ path: 'test-results/activity.png' })
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
  await page.getByRole('button', { name: 'Run serve in .', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Stop there & start here', exact: true }).click()
  await page.getByText(`Ready at http://127.0.0.1:${port}`, { exact: false }).waitFor()
  const response = await fetch(`http://127.0.0.1:${port}`)
  assert.equal(await response.text(), f.linked)
  await page.getByRole('button', { name: 'Listening ports', exact: true }).click()
  await page.getByText(`:${port}`, { exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/listeners.png' })
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
