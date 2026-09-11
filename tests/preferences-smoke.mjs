import { electron } from './desktop-launch.mjs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'

const f = await fixture()
const data = path.join(f.directory, 'preferences-data')
await mkdir(data)
await mkdir('test-results', { recursive: true })
const settingsPath = path.join(data, 'settings.json')
await writeFile(
  settingsPath,
  JSON.stringify({ version: 1, projects: [f.project], selectedProject: f.project.id, apps: {} }),
)
let desktop
try {
  desktop = await electron.launch({
    executablePath: process.env.DARSENA_EXECUTABLE,
    args: process.env.DARSENA_EXECUTABLE ? [] : ['.'],
    cwd: process.cwd(),
    env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '', DARSENA_TEST_PORT: '0' },
  })
  const page = await desktop.firstWindow()
  page.setDefaultTimeout(6000)
  const errors = [],
    externalRequests = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Observe the complete fresh page load too: icons and fonts must work offline.
  page.on('request', (request) => {
    if (/^https?:/u.test(request.url())) externalRequests.push(request.url())
  })
  await page.reload()
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()
  const trigger = page.getByRole('button', { name: /Preferences/ })
  const dialog = page.getByRole('dialog', { name: 'Preferences', exact: true })
  await trigger.click()
  const apps = dialog.getByRole('tab', { name: 'Applications', exact: true })
  const mcp = dialog.getByRole('tab', { name: 'MCP', exact: true })
  assert.equal(await apps.getAttribute('aria-selected'), 'true')
  await apps.focus()
  await apps.press('ArrowRight')
  await eventually(async () => (await mcp.getAttribute('aria-selected')) === 'true')
  await dialog.getByRole('heading', { name: 'Connect your AI tools' }).waitFor()
  await mcp.press('ArrowLeft')
  await eventually(async () => (await apps.getAttribute('aria-selected')) === 'true')

  // Switching panels may resize the centered dialog during pointerdown.
  // Its following click must not be mistaken for a backdrop dismissal.
  await mcp.click()
  await dialog.getByRole('heading', { name: 'Connect your AI tools' }).waitFor()
  await apps.click()
  assert.ok(await dialog.isVisible())

  const choices = [
    ['vscode', 'VS Code'],
    ['terminal', 'Terminal'],
    ['android-studio', 'Android Studio'],
  ]
  for (const [id, label] of choices) {
    const chosen = path.join(f.directory, `${label} Test.app`)
    // Exercise the real chooser IPC and persistence, without opening a system picker.
    await desktop.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
    }, chosen)
    await dialog.getByRole('button', { name: `Choose ${label} application`, exact: true }).click()
    await dialog.getByText(chosen, { exact: true }).waitFor()
    await eventually(
      async () => JSON.parse(await readFile(settingsPath, 'utf8')).apps[id] === chosen,
    )
  }
  const choose = dialog.getByRole('button', { name: 'Choose VS Code application', exact: true })
  await page.mouse.move(10, 10)
  await choose.hover()
  // Reka puts role=tooltip on a visually hidden description; test its visible popup separately.
  const tooltipText =
    'Choose the macOS application used for VS Code folder shortcuts. Saved immediately.'
  const tooltip = page
    .locator('[data-reka-popper-content-wrapper]')
    .filter({ hasText: tooltipText })
  await tooltip.waitFor({ state: 'visible' })
  assert.equal(
    await choose.evaluate(
      (element) => document.getElementById(element.getAttribute('aria-describedby'))?.textContent,
    ),
    tooltipText,
  )
  assert.ok(
    await tooltip.evaluate((element) => Boolean(element.closest('dialog[open]'))),
    'Tooltip must remain in the modal accessible subtree',
  )
  await page.keyboard.press('Escape')
  await tooltip.waitFor({ state: 'hidden' })
  assert.ok(await dialog.isVisible(), 'First Escape dismisses the tooltip, not its dialog')
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.screenshot({ path: `test-results/preferences-${theme}.png`, animations: 'disabled' })
  }
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 680))
  assert.ok(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
  await page.screenshot({ path: 'test-results/preferences-compact.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.ok(
    await trigger.evaluate((element) => element === document.activeElement),
    'Closing Preferences restores focus',
  )
  await page.reload()
  await trigger.click()
  for (const [, label] of choices) {
    await dialog.getByText(path.join(f.directory, `${label} Test.app`), { exact: true }).waitFor()
  }
  // A genuine backdrop click still dismisses the dialog and restores focus.
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  await page.mouse.click(viewport.width - 2, viewport.height - 2)
  await dialog.waitFor({ state: 'hidden' })
  assert.ok(await trigger.evaluate((element) => element === document.activeElement))
  assert.deepEqual(errors, [])
  assert.deepEqual(
    externalRequests,
    [],
    'Preferences must not fetch remote fonts, icons or other resources',
  )
  console.log(
    'PASS: Preferences keyboard tabs, application chooser persistence, modal tooltip, Escape focus, compact/light/dark and offline assets.',
  )
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
