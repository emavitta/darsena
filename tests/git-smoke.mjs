import { electron } from './desktop-launch.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'

const f = await fixture()
let desktop
try {
  const remote = path.join(f.directory, 'remote.git')
  const publisher = path.join(f.directory, 'publisher')
  await f.git(['init', '--bare', remote])
  await f.git(['remote', 'add', 'origin', remote])
  await f.git(['push', '-u', 'origin', 'main', 'feat/harbor-view'])
  await f.git(['clone', '--branch', 'main', remote, publisher])
  await f.git(['config', 'user.name', 'Publisher'], publisher)
  await f.git(['config', 'user.email', 'publisher@example.invalid'], publisher)
  await f.git(['config', 'core.hooksPath', '/dev/null'], publisher)
  await writeFile(path.join(publisher, 'new.txt'), 'new remote commit')
  await f.git(['add', '.'], publisher)
  await f.git(['commit', '-m', 'new remote commit'], publisher)
  await f.git(['push'], publisher)
  const data = path.join(f.directory, 'git-data')
  await mkdir(data)
  await mkdir('test-results', { recursive: true })
  await writeFile(path.join(data, 'settings.json'), JSON.stringify({ version: 1, projects: [f.project], selectedProject: f.project.id, apps: {} }))
  desktop = await electron.launch({ executablePath: process.env.DARSENA_EXECUTABLE, args: process.env.DARSENA_EXECUTABLE ? [] : ['.'], cwd: process.cwd(), env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '', DARSENA_TEST_PORT: '0' } })
  const page = await desktop.firstWindow()
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const git = page.getByRole('region', { name: 'Git actions' })
  await git.getByText('origin/main', { exact: true }).waitFor()
  await git.getByRole('button', { name: 'Fetch', exact: true }).click()
  await git.getByText('↑ 0 ahead · ↓ 1 behind', { exact: true }).waitFor()
  await git.getByRole('button', { name: 'Branches', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Branches', exact: true })
  await dialog.waitFor()
  await dialog.getByRole('textbox').fill('feat/harbor-view')
  await dialog.getByRole('button', { name: 'View worktree for feat/harbor-view', exact: true }).click()
  await git.getByText('origin/feat/harbor-view', { exact: true }).waitFor()
  assert.equal((await f.git(['branch', '--show-current'], f.linked)).stdout.trim(), 'feat/harbor-view')
  await git.getByRole('button', { name: 'Branches', exact: true }).click()
  await dialog.getByRole('button', { name: 'View worktree for main', exact: true }).click()
  await git.getByText('origin/main', { exact: true }).waitFor()
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.screenshot({ path: `test-results/git-actions-${theme}.png`, animations: 'disabled' })
  }
  await git.getByRole('button', { name: 'Pull (ff-only)', exact: true }).click()
  await eventually(async () => (await f.git(['rev-parse', 'HEAD'])).stdout === (await f.git(['rev-parse', 'HEAD'], publisher)).stdout)
  await git.getByText('↑ 0 ahead · ↓ 0 behind', { exact: true }).waitFor()
  await writeFile(path.join(f.root, 'dirty.txt'), 'local')
  await git.getByRole('button', { name: 'Refresh Git status' }).click()
  await eventually(() => git.getByRole('button', { name: 'Pull (ff-only)' }).isDisabled())
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 680))
  await git.getByRole('button', { name: 'Branches', exact: true }).click()
  await dialog.waitFor()
  await page.screenshot({ path: 'test-results/git-branches-compact.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log('PASS: Git status, fetch, branch/worktree navigation, fast-forward pull, dirty guard and branch dialog.')
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
