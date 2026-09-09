import { _electron as electron } from 'playwright'
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'
import { taskId } from '../desktop/tasks.ts'

const f = await fixture()
const other = await fixture()
other.project.id = 'other-project'
other.project.name = 'companion-project'
other.project.starred = false
f.project.favorites = [taskId('script', '.', 'serve')]
const data = path.join(f.directory, 'removal-data')
await mkdir(data)
await mkdir('test-results', { recursive: true })
const settingsPath = path.join(data, 'settings.json')
await writeFile(
  settingsPath,
  JSON.stringify({
    version: 1,
    projects: [f.project, other.project],
    selectedProject: f.project.id,
    apps: {},
  }),
)
let desktop
try {
  desktop = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '', DARSENA_TEST_PORT: '0' },
  })
  assert.equal(await desktop.evaluate(({ app }) => app.getPath('userData')), data)
  const page = await desktop.firstWindow()
  page.setDefaultTimeout(6000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const saved = async () => JSON.parse(await readFile(settingsPath, 'utf8'))
  const sidebar = page.getByRole('complementary')
  const menu = page.getByRole('menu')
  const dialog = page.getByRole('dialog', { name: 'Remove project?' })
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()

  await page.getByRole('button', { name: 'Preferences 0.1' }).click()
  assert.equal(await page.getByRole('dialog').getByText('Remove from Darsena').count(), 0)
  await page.getByRole('button', { name: 'Close dialog' }).click()

  // Keyboard navigation and dismissal return focus to the project action button.
  const trigger = sidebar.getByRole('button', { name: 'Actions for companion-project' })
  await trigger.focus()
  await trigger.press('ArrowDown')
  await menu.waitFor()
  assert.ok(
    await menu
      .getByRole('menuitem', { name: 'Show in Finder' })
      .evaluate((el) => el === document.activeElement),
  )
  await page.keyboard.press('End')
  assert.ok(
    await menu
      .getByRole('menuitem', { name: 'Remove from Darsena…' })
      .evaluate((el) => el === document.activeElement),
  )
  await page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
  assert.ok(await trigger.evaluate((el) => el === document.activeElement))

  // Right click on an unselected project does not change the current worktree.
  await sidebar
    .getByRole('button', { name: 'companion-project', exact: true })
    .click({ button: 'right' })
  await menu.waitFor()
  assert.equal((await saved()).selectedProject, f.project.id)
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.screenshot({
      path: `test-results/project-menu-${theme}.png`,
      animations: 'disabled',
    })
  }
  await menu.getByRole('menuitem', { name: 'Remove from Darsena…' }).click()
  await dialog.waitFor()
  assert.ok(await dialog.getByText(other.root, { exact: true }).isVisible())
  assert.equal((await saved()).projects.length, 2)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  assert.equal((await saved()).projects.length, 2)

  await trigger.click()
  await menu.getByRole('menuitem', { name: 'Remove from Darsena…' }).click()
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.screenshot({
      path: `test-results/project-removal-${theme}.png`,
      animations: 'disabled',
    })
  }
  await dialog.getByRole('button', { name: 'Remove from Darsena', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal((await saved()).selectedProject, f.project.id)
  assert.deepEqual(
    (await saved()).projects.map((p) => p.id),
    [f.project.id],
  )
  await access(path.join(other.root, 'README.md'))
  await access(path.join(other.linked, 'README.md'))
  assert.match((await other.git(['worktree', 'list', '--porcelain'])).stdout, /feature worktree/)

  // Running tasks are preserved; the dialog leads to Activity instead of removing.
  await page.getByRole('button', { name: 'Run serve in .', exact: true }).click()
  await page.getByText('Ready at http://127.0.0.1:', { exact: false }).waitFor()
  await sidebar.getByRole('button', { name: 'Actions for harbor-project' }).click()
  await menu.getByRole('menuitem', { name: 'Remove from Darsena…' }).click()
  await dialog.getByText('1 task is still running').waitFor()
  assert.equal(
    await dialog.getByRole('button', { name: 'Remove from Darsena', exact: true }).count(),
    0,
  )
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 680))
  await page.screenshot({
    path: 'test-results/project-removal-running.png',
    animations: 'disabled',
  })
  await dialog.getByRole('button', { name: 'View Activity' }).click()
  assert.equal((await saved()).projects.length, 1)
  await page.getByRole('button', { name: 'Stop task', exact: true }).click()
  await eventually(async () => {
    const runs = await page.evaluate(() => window.darsena.call('runs'))
    return runs.every((run) => !['starting', 'running', 'stopping'].includes(run.status))
  })
  await sidebar.getByRole('button', { name: 'harbor-project', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Actions for harbor-project' }).click()
  await menu.getByRole('menuitem', { name: 'Remove from Darsena…' }).click()
  await dialog.getByRole('button', { name: 'Remove from Darsena', exact: true }).click()
  await page.getByRole('heading', { name: 'Your worktrees, in one place.' }).waitFor()
  assert.equal((await saved()).projects.length, 0)
  await access(path.join(f.root, 'README.md'))
  await access(path.join(f.linked, 'README.md'))
  assert.deepEqual(errors, [])
  await page.reload()
  await page.getByRole('heading', { name: 'Your worktrees, in one place.' }).waitFor()
  console.log(
    'PASS: project menu, keyboard, correct removal target, cancel, preserved repositories/worktrees, active task protection, last project and persistence.',
  )
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
  await other.cleanup()
}
