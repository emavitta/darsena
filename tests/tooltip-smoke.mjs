import { electron } from './desktop-launch.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'
import { taskId } from '../desktop/tasks.ts'

const f = await fixture()
const data = path.join(f.directory, 'tooltip-data')
f.project.favorites = [taskId('script', '.', 'missing-script')]
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
  const tip = page.getByRole('tooltip')
  async function hint(trigger, text) {
    await page.bringToFront()
    await trigger.hover()
    await eventually(async () => (await tip.count()) === 1 && text.test(await tip.innerText()))
    assert.match(await tip.innerText(), text)
    const rect = await tip.boundingBox()
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    assert.ok(rect.x >= 0 && rect.y >= 0)
    assert.ok(rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height)
  }
  const launcher = page.getByRole('button', { name: 'Open Android app in Android Studio' })
  await hint(launcher, /selected worktree in Android Studio/)
  // The tooltip remains readable when moving the pointer onto its text.
  await tip.hover()
  await page.waitForTimeout(220)
  assert.ok(await tip.isVisible())
  await page.keyboard.press('Escape')
  await tip.waitFor({ state: 'hidden' })

  // A disabled action explains why it cannot be used.
  const disabled = page.getByRole('button', { name: 'Run missing-script in .' })
  assert.ok(await disabled.isDisabled())
  await hint(disabled, /not available in the selected worktree/)
  await page.keyboard.press('Escape')

  // Keyboard hints keep focus on the trigger and preserve its accessible name.
  await page.keyboard.press('Tab')
  const copy = page.getByRole('button', { name: 'Worktree actions' })
  await copy.focus()
  await tip.waitFor()
  assert.match(await tip.innerText(), /copy its path/)
  assert.equal(await copy.getAttribute('aria-describedby'), await tip.getAttribute('id'))
  assert.ok(await copy.evaluate((el) => el === document.activeElement))
  await page.keyboard.press('Escape')
  await tip.waitFor({ state: 'hidden' })
  assert.equal(await copy.getAttribute('aria-describedby'), null)

  // A tooltip is above a modal, and Escape dismisses the hint before the dialog.
  await page.getByRole('button', { name: 'Preferences 0.1' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await hint(dialog.getByRole('button', { name: 'Close dialog', exact: true }), /Close this dialog/)
  assert.ok(await tip.evaluate((el) => el.closest('dialog')?.open))
  assert.ok(
    await tip.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el
    }),
  )
  await page.keyboard.press('Escape')
  await tip.waitFor({ state: 'hidden' })
  assert.ok(await dialog.isVisible())
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })

  // Explain both directions of a toggle after the saved state changes.
  await page.getByRole('button', { name: /All tasks/ }).click()
  const favorite = page.getByRole('button', { name: 'Favorite task check', exact: true })
  await hint(favorite, /every worktree/)
  await favorite.click()
  await page.mouse.move(450, 40)
  await hint(
    page.getByRole('button', { name: 'Unfavorite task check', exact: true }),
    /Remove this task/,
  )
  await page.keyboard.press('Escape')

  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.mouse.move(450, 40)
    await hint(launcher, /Android Studio/)
    await page.screenshot({ path: `test-results/tooltip-${theme}.png` })
    await page.keyboard.press('Escape')
  }
  // Removing the trigger through a state change must remove its open hint.
  await page.getByRole('button', { name: /Favorites/ }).click()
  const unstar = page.getByRole('button', { name: 'Unfavorite task check', exact: true })
  await hint(unstar, /Remove this task/)
  await unstar.press('Enter')
  await unstar.waitFor({ state: 'detached' })
  await tip.waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [])
  console.log(
    'PASS: hover, hoverable content, keyboard focus, Escape, disabled actions, modal layering, dynamic copy and cleanup. No tasks launched.',
  )
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
