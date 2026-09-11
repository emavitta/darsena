import { electron } from './desktop-launch.mjs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { eventually } from './fixture.ts'
const data = await mkdtemp(path.join(os.tmpdir(), 'darsena-story-'))
let desktop
try {
  desktop = await electron.launch({ executablePath: process.env.DARSENA_EXECUTABLE, args: process.env.DARSENA_EXECUTABLE ? [] : ['.'], cwd: process.cwd(), env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '' } })
  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Read the story of Darsena' }).click()
  const dialog = page.getByRole('dialog', { name: 'The story of Darsena' })
  await dialog.waitFor()
  for (const size of [[1360, 880], [1000, 680], [1500, 1100]]) {
    await desktop.evaluate(({ BrowserWindow }, [width, height]) => BrowserWindow.getAllWindows()[0].setSize(width, height), size)
    const sections = dialog.locator('.story-section')
    await eventually(async () => {
      const geometry = await dialog.evaluate(el => {
        const last = el.querySelector('.story-section:last-child')
        return { available: el.scrollHeight - el.clientHeight, required: el.scrollTop + last.getBoundingClientRect().top - el.getBoundingClientRect().top - Math.min(150, el.clientHeight / 3) }
      })
      return geometry.available >= geometry.required - 1
    })
    // Scroll without clicking: each section, including 03, must have its own active interval.
    for (const index of [0, 1, 2, 3, 2, 1, 0]) {
      await sections.nth(index).evaluate(section => {
        const el = section.closest('dialog')
        el.scrollTop += section.getBoundingClientRect().top - el.getBoundingClientRect().top - Math.min(150, el.clientHeight / 3)
      })
      await eventually(() => sections.nth(index).evaluate(el => el.classList.contains('story-section-active')))
    }
    for (const index of [2, 3, 2]) {
      await sections.nth(index).getByRole('button').click()
      await eventually(() => sections.nth(index).getByRole('button').getAttribute('aria-pressed').then(value => value === 'true'))
      assert.equal(await dialog.locator('.story-section-active').count(), 1)
    }
  }
  console.log('PASS: all story sections activate by scroll in both directions and remain selected after clicks across window sizes.')
} finally { if (desktop) await desktop.close(); await rm(data, { recursive: true, force: true }) }
