import { _electron as electron } from 'playwright'
import { mkdir, writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'

const f = await fixture()
const data = path.join(f.directory, 'readability-data')
await mkdir(data)
await mkdir('test-results', { recursive: true })
await writeFile(
  path.join(f.root, 'package.json'),
  JSON.stringify({ packageManager: 'pnpm@10.0.0', scripts: { 'dev:web': 'echo fixture' } }),
)
for (const manager of ['npm', 'yarn', 'bun']) {
  const folder = `services/${manager}-example`
  await mkdir(path.join(f.root, folder), { recursive: true })
  await writeFile(
    path.join(f.root, folder, 'package.json'),
    JSON.stringify({ packageManager: `${manager}@1.0.0`, scripts: { dev: 'echo fixture' } }),
  )
  f.project.folders.push({ id: manager, label: `${manager} example`, path: folder })
}
const wrapper = path.join(f.root, 'android-app/gradlew')
await writeFile(
  wrapper,
  '#!/bin/sh\nprintf \'%s\\n\' \'__DARSENA_TASKS__[{"name":":app:assembleDebug"}]\'\n',
)
await chmod(wrapper, 0o755)
f.project.customTasks = [
  { id: 'custom', name: 'check:api', folder: '.', command: 'python3', args: ['-m', 'pytest'] },
  { id: 'other', name: 'check:local', folder: '.', command: './tools/local-check', args: [] },
]
for (const root of [f.root, f.linked]) {
  await mkdir(path.join(root, 'scripts'), { recursive: true })
  await writeFile(
    path.join(root, 'scripts/start server.sh'),
    'printf \'%s\\n\' "$PWD" "$1" "$2" "$3"\n',
  )
}
await writeFile(
  path.join(data, 'settings.json'),
  JSON.stringify({ version: 1, projects: [f.project], selectedProject: f.project.id, apps: {} }),
)
let desktop
try {
  desktop = await electron.launch({
    executablePath: process.env.DARSENA_EXECUTABLE,
    args: process.env.DARSENA_EXECUTABLE ? [] : [process.env.DARSENA_TEST_ASAR || '.'],
    cwd: process.cwd(),
    env: { ...process.env, DARSENA_DATA_DIR: data, DARSENA_DEV_URL: '' },
  })
  assert.equal(await desktop.evaluate(({ app }) => app.getPath('userData')), data)
  const page = await desktop.firstWindow()
  page.setDefaultTimeout(6000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()
  const tasks = page.locator('.tasks-section')
  await tasks.getByRole('button', { name: /All tasks/ }).click()
  await tasks.locator('summary').click()
  await tasks.getByRole('button', { name: 'Sync Gradle in android-app' }).click()
  await tasks.getByRole('button', { name: 'Run :app:assembleDebug in android-app' }).waitFor()
  await tasks.locator('summary').click()
  assert.equal(await tasks.locator('.task-folder-group').count(), 5)
  for (const manager of ['npm', 'yarn', 'bun']) {
    const group = tasks.getByRole('region', { name: 'Tasks in services/' + manager + '-example', exact: true })
    assert.ok(await group.getByRole('button', { name: manager + ' example tasks', exact: true }).isVisible())
    assert.equal(await group.locator('.task-row').count(), 1)
    assert.ok(await group.getByRole('button', { name: 'Run dev in services/' + manager + '-example', exact: true }).isVisible())
  }
  const npmGroup = tasks.getByRole('region', { name: 'Tasks in services/npm-example', exact: true })
  const npmToggle = npmGroup.getByRole('button', { name: 'npm example tasks', exact: true })
  await npmToggle.click()
  await eventually(async () => !(await npmGroup.getByRole('button', { name: 'Run dev in services/npm-example', exact: true }).isVisible()))
  await tasks.getByRole('textbox', { name: 'Search tasks' }).fill('npm-example')
  await npmGroup.getByRole('button', { name: 'Run dev in services/npm-example', exact: true }).waitFor()
  await tasks.getByRole('textbox', { name: 'Search tasks' }).fill('')
  await eventually(async () => await npmToggle.getAttribute('aria-expanded') === 'false')
  await npmToggle.focus()
  await npmToggle.press('Enter')
  await npmGroup.getByRole('button', { name: 'Run dev in services/npm-example', exact: true }).waitFor()
  await tasks.getByRole('button', { name: 'Custom command', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Display name', exact: true }).fill('prepare:local')
  await dialog
    .getByRole('textbox', { name: 'Executable', exact: true })
    .fill('/opt/homebrew/bin/cargo')
  assert.equal(await dialog.locator('.task-tool-badge').innerText(), 'Cargo')
  await dialog.getByRole('radio', { name: 'Shell script', exact: true }).check()
  await dialog.getByRole('textbox', { name: 'Script path', exact: true }).fill('../outside.sh')
  await dialog.getByRole('button', { name: 'Add command', exact: true }).click()
  await dialog
    .getByRole('alert')
    .getByText(/inside the working folder/)
    .waitFor()
  await dialog
    .getByRole('textbox', { name: 'Script path', exact: true })
    .fill('scripts/start server.sh')
  await dialog.getByRole('textbox', { name: /Arguments/ }).fill('a b\n$HOME\n&&')
  assert.equal(await dialog.locator('.task-tool-badge').innerText(), 'Shell')
  await page.emulateMedia({ colorScheme: 'dark' })
  await dialog.getByRole('heading').click()
  await page.mouse.move(40, 40)
  await dialog.screenshot({ path: 'test-results/shell-script-dialog.png', animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Add command', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  const state = await page.evaluate(() => window.darsena.call('state'))
  const saved = state.projects[0].customTasks.find((task) => task.name === 'prepare:local')
  assert.equal(saved.command, 'bash')
  assert.deepEqual(saved.args, ['--', './scripts/start server.sh', 'a b', '$HOME', '&&'])
  assert.ok(state.projects[0].favorites.includes(saved.id))
  assert.equal((await page.evaluate(() => window.darsena.call('runs'))).length, 0)
  await tasks.getByRole('button', { name: 'Configure prepare:local', exact: true }).click()
  const portInput = dialog.getByRole('spinbutton', { name: 'Exclusive TCP port', exact: true })
  await portInput.fill('65536')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  assert.ok(await dialog.isVisible())
  assert.equal(await portInput.evaluate((input) => input.checkValidity()), false)
  await portInput.fill('9000')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(
    (await page.evaluate(() => window.darsena.call('state'))).projects[0].taskPreferences[saved.id]
      .port,
    9000,
  )
  await tasks.getByRole('button', { name: 'Configure prepare:local', exact: true }).click()
  assert.equal(await portInput.inputValue(), '9000')
  await dialog.screenshot({ path: 'test-results/task-port-dialog.png', animations: 'disabled' })
  await portInput.fill('')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(
    (await page.evaluate(() => window.darsena.call('state'))).projects[0].taskPreferences[saved.id]
      ?.port,
    undefined,
  )
  const labels = ['pnpm', 'npm', 'Yarn', 'Bun', 'Gradle', 'Python', 'Shell', 'Custom', 'Android']
  assert.equal(await tasks.locator('.task-tool-badge .tool-icon').count(), labels.length)
  const iconSizes = await tasks.locator('.task-tool-badge .tool-icon').evaluateAll((icons) =>
    icons.map((icon) => ({
      width: icon.getBoundingClientRect().width,
      loaded: icon.tagName === 'IMG' ? icon.complete && icon.naturalWidth > 0 : icon.querySelectorAll('path').length > 0,
    })),
  )
  assert.ok(iconSizes.every((icon) => icon.width === 16 && icon.loaded))
  assert.deepEqual(
    (await tasks.locator('.task-tool-badge').allTextContents()).map((text) => text.trim()).sort(),
    labels.toSorted(),
  )
  const filter = tasks.getByRole('combobox', { name: 'Filter tasks by tool' })
  await filter.selectOption('script:yarn')
  await eventually(async () => (await tasks.locator('.task-row').count()) === 1)
  assert.equal(await tasks.locator('.task-tool-badge').innerText(), 'Yarn')
  await filter.selectOption('gradle')
  assert.equal(await tasks.locator('.task-tool-badge').innerText(), 'Gradle')
  await tasks.getByRole('textbox', { name: 'Search tasks' }).fill('no match')
  await tasks.getByText('No matching tasks.', { exact: true }).waitFor()
  await tasks.getByRole('button', { name: 'Clear filters' }).click()
  await eventually(async () => (await tasks.locator('.task-row').count()) === labels.length)
  await tasks.getByRole('textbox', { name: 'Search tasks' }).fill('Yarn')
  await eventually(async () => (await tasks.locator('.task-row').count()) === 1)
  assert.equal(await tasks.locator('.task-tool-badge').innerText(), 'Yarn')
  await tasks.getByRole('textbox', { name: 'Search tasks' }).fill('')
  await tasks.getByRole('heading', { name: 'Tasks', exact: true }).click()

  function luminance(color) {
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      color = 'rgb(' + [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',') + ')'
    }
    const rgb = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const channel = v / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.waitForTimeout(180)
    const colors = await tasks.locator('.task-tool-badge').evaluateAll((badges) =>
      badges.map((badge) => ({
        label: badge.textContent,
        foreground: getComputedStyle(badge).color,
        background: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      })),
    )
    for (const color of colors) {
      const a = luminance(color.foreground),
        b = luminance(color.background)
      assert.ok(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
        `${theme} ${color.label} must meet text contrast`,
      )
    }
    await tasks.scrollIntoViewIfNeeded()
    await page.mouse.move(40, 40)
    await page.screenshot({
      path: `test-results/task-readability-${theme}.png`,
      animations: 'disabled',
    })
    await tasks.screenshot({ path: `test-results/task-tools-${theme}.png`, animations: 'disabled' })
  }
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 780))
  await tasks.scrollIntoViewIfNeeded()
  const layout = await tasks.locator('.task-row').evaluateAll((rows) =>
    rows.map((row) => {
      const content = row.querySelector('.task-info').getBoundingClientRect()
      const badge = row.querySelector('.task-tool-badge').getBoundingClientRect()
      const actions = row.querySelector('.task-row-actions').getBoundingClientRect()
      return {
        contentRight: content.right,
        badgeLeft: badge.left,
        badgeRight: badge.right,
        actionsLeft: actions.left,
        actionsRight: actions.right,
        rowRight: row.getBoundingClientRect().right,
      }
    }),
  )
  for (const row of layout) {
    assert.ok(row.contentRight <= row.badgeLeft && row.badgeRight <= row.actionsLeft)
    assert.ok(row.actionsRight <= row.rowRight + 1)
  }
  await page.screenshot({
    path: 'test-results/task-readability-narrow.png',
    animations: 'disabled',
  })
  // Exercise the saved preset through the real runner in two different worktrees.
  for (const root of [f.root, f.linked]) {
    if (root === f.linked) {
      await page
        .getByRole('complementary')
        .getByRole('button', { name: 'harbor-project', exact: true })
        .click()
      await page.getByRole('button', { name: /feature worktree/ }).click()
      await page.getByRole('heading', { name: 'feature worktree', exact: true }).waitFor()
    }
    await tasks.getByRole('button', { name: 'Run prepare:local in .', exact: true }).click()
    let run
    await eventually(async () => {
      run = (await page.evaluate(() => window.darsena.call('runs'))).find(
        (entry) => entry.worktree === root,
      )
      return run?.status === 'succeeded'
    })
    const logs = await page.evaluate((runId) => window.darsena.call('logs', { runId }), run.id)
    assert.equal(logs, `${root}\na b\n$HOME\n&&\n`)
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS: tool logos and fallbacks, live custom preview, saved shell preset, literal arguments and selected-worktree execution, filters, contrast in both themes and minimum-width layout. Only fixture commands were invoked.',
  )
} finally {
  if (desktop) await desktop.close()
  await f.cleanup()
}
