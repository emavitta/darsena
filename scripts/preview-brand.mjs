import { electron } from '../tests/desktop-launch.mjs'
import { fixture, eventually } from '../tests/fixture.ts'
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
    await page.getByRole('button', { name: 'The story behind the name & icon' }).click()
    const storyHeading = page.getByRole('heading', { name: 'A harbor for things being built.' })
    await storyHeading.waitFor()
    if (!(await storyHeading.evaluate((element) => element === document.activeElement))) {
      throw new Error('The story heading must receive focus when opening the reading view')
    }
    if ((await page.locator('dialog[open]').count()) !== 1)
      throw new Error('About must use one dialog')
    await page.screenshot({ path: `design/final/story-${theme}.png`, animations: 'disabled' })
    await page.getByRole('dialog').screenshot({
      path: `design/final/story-panel-${theme}.png`,
      animations: 'disabled',
      scale: 'css',
    })
    const mapTram = page.getByRole('button', { name: 'Read about The Milanese tram', exact: true })
    await mapTram.click()
    await eventually(async () => (await mapTram.getAttribute('aria-pressed')) === 'true')
    await page.getByRole('button', { name: 'Read about Porta Ticinese', exact: true }).focus()
    await page.keyboard.press('Enter')
    await eventually(
      async () =>
        await page
          .locator('[data-story="gate"]')
          .getAttribute('class')
          .then((c) => c.includes('story-section-active')),
    )
    await page.getByRole('dialog').evaluate((el) => el.scrollTo({ top: 0 }))
    await eventually(
      async () =>
        (await page
          .getByRole('button', { name: 'Read about Darsena & Navigli', exact: true })
          .getAttribute('aria-pressed')) === 'true',
    )
    await page.getByRole('heading', { name: 'The tram, Milan in motion' }).scrollIntoViewIfNeeded()
    await page.getByRole('dialog').evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
    await eventually(async () => (await mapTram.getAttribute('aria-pressed')) === 'true')
    await page.screenshot({
      path: `design/final/story-details-${theme}.png`,
      animations: 'disabled',
    })
    // Intercept the OS opener to check the real source-link bridge without opening six browser tabs.
    await desktop.evaluate(({ shell }) => {
      globalThis.__brandOpenedUrls = []
      globalThis.__brandOriginalOpenExternal = shell.openExternal
      shell.openExternal = async (url) => {
        globalThis.__brandOpenedUrls.push(url)
      }
    })
    try {
      const sourceLinks = page.locator('.story-sources a')
      for (const link of await sourceLinks.all()) {
        const url = await link.getAttribute('href')
        await link.click()
        await eventually(async () =>
          (await desktop.evaluate(() => globalThis.__brandOpenedUrls)).includes(url),
        )
      }
    } finally {
      await desktop.evaluate(({ shell }) => {
        shell.openExternal = globalThis.__brandOriginalOpenExternal
      })
    }
    await page.getByRole('button', { name: 'Back to About' }).click()
    const storyLink = page.getByRole('button', { name: 'The story behind the name & icon' })
    if (!(await storyLink.evaluate((element) => element === document.activeElement))) {
      throw new Error('Returning to About must restore keyboard focus')
    }
    await page.getByRole('button', { name: 'Read the story of Darsena' }).click()
    await storyHeading.waitFor()
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
  if (layout.scrollHeight > layout.clientHeight)
    throw new Error('Welcome requires scrolling at minimum window size')
  await page.getByRole('button', { name: 'Read the story of Darsena' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: 'A harbor for things being built.' }).waitFor()
  await page.screenshot({ path: 'design/final/story-compact.png', animations: 'disabled' })
  const storyLayout = await page.getByRole('dialog').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  if (storyLayout.scrollWidth > storyLayout.clientWidth)
    throw new Error('Story overflows horizontally')
  await page.getByRole('heading', { name: 'The tram, Milan in motion' }).scrollIntoViewIfNeeded()
  const closeBox = await page.getByRole('button', { name: 'Close dialog' }).boundingBox()
  if (!closeBox || closeBox.y < 0 || closeBox.y + closeBox.height > 680) {
    throw new Error('The story close button must stay available while reading')
  }
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  if (
    !(await page
      .getByRole('button', { name: 'Read the story of Darsena' })
      .evaluate((element) => element === document.activeElement))
  ) {
    throw new Error('Closing the story must restore focus to the welcome icon')
  }
  const broken = await page
    .locator('img')
    .evaluateAll((images) => images.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src))
  console.log(JSON.stringify({ pageErrors: errors, brokenImages: broken }))
  if (errors.length || broken.length) throw new Error('Visual preview failed')
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
