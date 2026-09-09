import { _electron as electron } from 'playwright'
import { fixture } from '../tests/fixture.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Screenshot the real desktop renderer with disposable projects and preferences.
const f = await fixture()
const data = path.join(f.directory, 'brand-preview')
await mkdir(data)
await mkdir('design/final', { recursive: true })
await writeFile(
  path.join(data, 'settings.json'),
  JSON.stringify({ version: 1, projects: [f.project], selectedProject: f.project.id, apps: {} }),
)
let desktop
try {
  desktop = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '' },
  })
  const page = await desktop.firstWindow()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page
      .locator('img')
      .evaluateAll((images) => Promise.all(images.map((img) => img.decode())))
    await page.locator('.folder-list').screenshot({
      path: `design/final/folder-shortcuts-${theme}.png`,
      animations: 'disabled',
    })
    await page.screenshot({ path: `design/final/workspace-${theme}.png`, animations: 'disabled' })
    await page.getByRole('button', { name: 'About Darsena' }).click()
    await page.getByRole('dialog').waitFor()
    await page.locator('dialog picture img').evaluate(async (img) => {
      await img.decode()
    })
    await page.screenshot({ path: `design/final/about-${theme}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  }
  await page.evaluate((id) => window.darsena.call('removeProject', { projectId: id }), f.project.id)
  await page.reload()
  await page.getByRole('heading', { name: 'Your worktrees, in one place.' }).waitFor()
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.locator('picture img').evaluate(async (img) => {
      await img.decode()
    })
    await page.screenshot({ path: `design/final/welcome-${theme}.png`, animations: 'disabled' })
  }
  await desktop.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1000, 680)
  })
  await page.emulateMedia({ colorScheme: 'light' })
  const addProject = page.getByRole('button', { name: 'Add your first project' })
  await addProject.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'design/final/welcome-compact.png', animations: 'disabled' })
  const layout = await page.locator('.brand-welcome').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  if (layout.scrollWidth > layout.clientWidth) throw new Error('Welcome overflows horizontally')
  if (layout.scrollHeight > layout.clientHeight) throw new Error('Welcome requires scrolling at minimum window size')
  const broken = await page
    .locator('img')
    .evaluateAll((images) => images.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src))
  console.log(JSON.stringify({ pageErrors: errors, brokenImages: broken }))
  if (errors.length || broken.length) throw new Error('Visual preview failed')
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
