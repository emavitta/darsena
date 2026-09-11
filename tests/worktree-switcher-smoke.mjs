import { _electron as electron } from 'playwright'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'
import { taskId } from '../desktop/tasks.ts'

const f = await fixture()
const other = await fixture()
other.project.id = 'companion'
other.project.name = 'companion-project'
const data = path.join(f.directory, 'switcher-data')
await mkdir(data)
await mkdir('test-results', { recursive: true })
f.project.favorites = [taskId('script', '.', 'serve')]
const settings = path.join(data, 'settings.json')
await writeFile(settings, JSON.stringify({ version: 1, projects: [f.project, other.project], selectedProject: f.project.id, apps: {} }))
let desktop
try {
  desktop = await electron.launch({
    executablePath: process.env.DARSENA_EXECUTABLE,
    args: process.env.DARSENA_EXECUTABLE ? [] : ['.'],
    cwd: process.cwd(),
    env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '', DARSENA_TEST_PORT: '0' },
  })
  const page = await desktop.firstWindow()
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const requests = []
  page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()) })
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()
  const before = await readFile(settings, 'utf8')
  const trigger = page.getByRole('button', { name: 'Switch worktree', exact: true })
  await trigger.focus()
  await page.keyboard.press('Meta+k')
  const dialog = page.getByRole('dialog', { name: 'Switch worktree' })
  const search = dialog.getByRole('textbox', { name: 'Search projects and worktrees' })
  await dialog.waitFor()
  await eventually(async () => await dialog.getByRole('option').count() === 4)
  assert.equal(await readFile(settings, 'utf8'), before)
  await search.fill('companion-project')
  await eventually(async () => await dialog.getByRole('option').count() === 2)
  await search.fill(other.linked)
  await eventually(async () => await dialog.getByRole('option').count() === 1)
  await search.fill('does-not-exist-anywhere')
  await dialog.getByText('No matching worktrees.').waitFor()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert.ok(await trigger.evaluate(el => el === document.activeElement))
  // Do not stack the switcher on top of another native dialog.
  await page.getByRole('button', { name: 'Preferences 0.1' }).click()
  await page.keyboard.press('Meta+k')
  assert.equal(await dialog.count(), 0)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Run serve in .', exact: true }).click()
  await page.getByText('Ready at http://127.0.0.1:', { exact: false }).waitFor()
  await trigger.click()
  await dialog.getByText('1 active', { exact: true }).waitFor()
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.screenshot({ path: 'test-results/worktree-switcher-' + theme + '.png' })
  }
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 680))
  await page.screenshot({ path: 'test-results/worktree-switcher-compact.png' })
  const bounds = await dialog.boundingBox()
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 680)
  await search.fill(other.linked)
  await eventually(async () => await dialog.getByRole('option').count() === 1)
  await search.press('ArrowDown')
  await search.press('Enter')
  await dialog.waitFor({ state: 'detached' })
  await eventually(async () => {
    const saved = JSON.parse(await readFile(settings, 'utf8'))
    return saved.selectedProject === other.project.id && saved.projects.find(p => p.id === other.project.id).lastWorktree === other.linked
  })
  assert.ok(await page.getByRole('button', { name: 'Activity', exact: true }).getAttribute('aria-expanded') === 'true')
  assert.match(await page.locator('.log-output').innerText(), /Ready at/)
  const runs = await page.evaluate(() => window.darsena.call('runs'))
  assert.equal(runs.filter(r => r.status === 'running' && r.worktree === f.root).length, 1)
  assert.equal((await other.git(['branch', '--show-current'], other.linked)).stdout.trim(), 'feat/harbor-view')
  assert.equal((await f.git(['branch', '--show-current'])).stdout.trim(), 'main')
  await page.getByRole('button', { name: 'Stop task', exact: true }).click()
  assert.deepEqual(errors, [])
  assert.deepEqual(requests, [])
  console.log('PASS: global worktree search, project/path filters, keyboard selection, focus, modal guard, active counts, preserved task/dock and Git branches, compact/light/dark/offline.')
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
  await other.cleanup()
}
