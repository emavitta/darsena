import { electron } from './desktop-launch.mjs'
import { mkdir, writeFile, symlink, rename, unlink, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'

const f = await fixture()
const data = path.join(f.directory, 'folder-data')
const relative = 'shells/native module'
for (const root of [f.root, f.linked]) await mkdir(path.join(root, relative), { recursive: true })
await symlink(f.directory, path.join(f.root, 'external'))
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
  await page.getByRole('button', { name: 'Add shortcut', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Browse shells', exact: true }).waitFor()
  assert.equal(
    await dialog.getByRole('button', { name: 'Browse external', exact: true }).count(),
    0,
  )
  assert.equal(await dialog.getByRole('button', { name: 'Browse .git', exact: true }).count(), 0)
  assert.ok(await dialog.getByRole('button', { name: 'Add shortcut', exact: true }).isDisabled())
  await dialog.getByRole('searchbox').fill('no such folder')
  await dialog.getByText('No matching subfolders.').waitFor()
  await dialog.getByRole('searchbox').fill('shell')
  await dialog.getByRole('button', { name: 'Browse shells', exact: true }).press('Enter')
  await dialog.getByRole('button', { name: 'Browse native module', exact: true }).waitFor()
  assert.equal(await dialog.getByRole('searchbox').inputValue(), '')
  await dialog.getByRole('button', { name: 'Browse native module', exact: true }).click()
  await dialog.getByText('No subfolders here.').waitFor()
  assert.equal(await dialog.locator('.picker-selection strong').innerText(), relative)
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.mouse.move(50, 45)
    await page.screenshot({ path: `test-results/folder-picker-${theme}.png` })
  }
  // A folder replaced by an external symlink between browse and save must be rejected.
  const target = path.join(f.root, relative)
  await rename(target, `${target}-backup`)
  await symlink(f.directory, target)
  await dialog.getByRole('button', { name: 'Add shortcut', exact: true }).click()
  await dialog.getByRole('alert').waitFor()
  assert.match(await dialog.getByRole('alert').innerText(), /outside/)
  const saved = () => page.evaluate(() => window.darsena.call('state'))
  assert.equal((await saved()).projects[0].folders.length, 2)
  await unlink(target)
  await rename(`${target}-backup`, target)
  await dialog.getByRole('button', { name: 'Add shortcut', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  await page
    .getByRole('button', { name: 'Open native module in Android Studio', exact: true })
    .waitFor()
  assert.equal((await saved()).projects[0].folders.at(-1).path, relative)
  // The shortcut is shared with another worktree, and discovery reads that worktree's folder.
  await writeFile(
    path.join(f.linked, relative, 'package.json'),
    JSON.stringify({ scripts: { 'native-check': 'echo fixture' } }),
  )
  await page.getByRole('button', { name: /feature worktree/ }).click()
  await page.getByRole('heading', { name: 'feature worktree', exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Open native module in Android Studio', exact: true })
    .waitFor()
  await page.getByRole('button', { name: /All tasks/ }).click()
  await page.getByRole('button', { name: `Run native-check in ${relative}`, exact: true }).waitFor()
  const context = { projectId: f.project.id, worktree: f.linked }
  // Direct bridge calls still enforce the boundary; duplicate saves are idempotent.
  for (const method of ['browseFolders', 'addFolder']) {
    const result = await page.evaluate(
      async ({ method, context }) => {
        try {
          await window.darsena.call(method, { ...context, folder: '..' })
          return ''
        } catch (error) {
          return error.message
        }
      },
      { method, context },
    )
    assert.match(result, /inside|outside/)
  }
  await page.evaluate(
    ({ context, relative }) => window.darsena.call('addFolder', { ...context, folder: relative }),
    { context, relative },
  )
  assert.equal((await saved()).projects[0].folders.length, 3)
  await page.getByRole('button', { name: 'Add shortcut', exact: true }).click()
  await dialog.getByRole('button', { name: 'Browse shells', exact: true }).click()
  await dialog.getByRole('button', { name: 'Browse native module', exact: true }).click()
  await dialog.getByText('Already added to this project').waitFor()
  assert.ok(await dialog.getByRole('button', { name: 'Add shortcut', exact: true }).isDisabled())
  await dialog.getByRole('button', { name: 'Worktree root', exact: true }).click()
  await dialog.getByRole('button', { name: 'Browse android-app', exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  await eventually(
    async () =>
      JSON.parse(await readFile(path.join(data, 'settings.json'), 'utf8')).projects[0].folders
        .length === 3,
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: bounded folder navigation, filtering, save-time symlink validation, shared relative shortcuts, task discovery, duplicate and cancel behavior. No tasks or external apps launched.',
  )
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
