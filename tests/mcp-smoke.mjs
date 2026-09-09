import { _electron as electron } from 'playwright'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fixture, eventually } from './fixture.ts'

async function freePort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}
const f = await fixture()
const data = path.join(f.directory, 'profile')
await mkdir(data)
await mkdir('test-results', { recursive: true })
const mcpPort = await freePort(),
  taskPort = await freePort()
f.project.customTasks.push({
  id: 'preview',
  name: 'preview',
  folder: '.',
  command: process.execPath,
  args: ['server.mjs'],
})
f.project.taskPreferences.preview = { port: taskPort }
await writeFile(
  path.join(data, 'settings.json'),
  JSON.stringify({ version: 1, projects: [f.project], selectedProject: f.project.id, apps: {} }),
)
let desktop, client
try {
  desktop = await electron.launch({
    executablePath: process.env.DARSENA_EXECUTABLE,
    args: process.env.DARSENA_EXECUTABLE ? [] : ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DARSENA_DATA_DIR: data,
      DARSENA_DEV_URL: '',
      DARSENA_TEST_PORT: String(taskPort),
    },
  })
  const page = await desktop.firstWindow()
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text) => {
        window.__mcpCopiedConfig = text
      },
    })
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: 'harbor-project', exact: true }).waitFor()
  await page.getByRole('button', { name: /Preferences/ }).click()
  await page.getByRole('button', { name: 'MCP', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Off', { exact: true }).waitFor()
  await dialog.getByText('Connection settings', { exact: true }).click()
  await dialog.getByLabel('Local port', { exact: true }).fill(String(mcpPort))
  await dialog.getByRole('button', { name: 'Save port', exact: true }).click()
  await eventually(async () => !(await dialog.getByLabel('Enable local MCP').isDisabled()))
  await dialog.getByLabel('Enable local MCP').check()
  await dialog.getByText('Listening', { exact: true }).waitFor()
  await dialog.getByLabel('Share harbor-project with MCP').check()
  await dialog.getByText('Read-only access', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Copy client configuration' }).click()
  await dialog.getByText('Configuration copied, including your private connection token.').waitFor()
  const config = JSON.parse(await page.evaluate(() => window.__mcpCopiedConfig)).mcpServers.darsena
  assert.equal(config.url, `http://127.0.0.1:${mcpPort}/mcp`)
  client = new Client(
    { name: 'desktop-smoke', version: '1' },
    { versionNegotiation: { mode: 'auto' } },
  )
  await client.connect(
    new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers: config.headers },
    }),
  )
  assert.equal(client.getProtocolEra(), 'modern')
  const input = { projectId: f.project.id, worktree: f.linked, taskId: 'preview' }
  assert.equal((await client.callTool({ name: 'start_task', arguments: input })).isError, true)
  await dialog.getByRole('button', { name: 'Task permissions', exact: true }).click()
  const permission = dialog.getByLabel('Allow MCP to run preview in .', { exact: true })
  await permission.waitFor()
  await permission.check()
  await dialog.getByText('1 task authorized', { exact: true }).waitFor()
  await dialog.getByText('Connection settings', { exact: true }).click()
  await page.screenshot({ path: 'test-results/mcp-light.png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: 'test-results/mcp-dark.png' })
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 680))
  assert.ok(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
  await page.screenshot({ path: 'test-results/mcp-compact.png' })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  const started = await client.callTool({ name: 'start_task', arguments: input })
  assert.equal(started.isError, undefined)
  const run = started.structuredContent.run
  assert.equal(run.source, 'mcp')
  await eventually(async () => {
    const result = await client.callTool({ name: 'read_logs', arguments: { runId: run.id } })
    return result.structuredContent?.text.includes('Ready at')
  })
  assert.equal(await (await fetch(`http://127.0.0.1:${taskPort}`)).text(), f.linked)
  assert.equal(
    await page.evaluate(() =>
      window.darsena.call('state').then((state) => state.projects[0].lastWorktree),
    ),
    f.root,
  )
  await page
    .getByRole('complementary')
    .getByRole('button', { name: /Activity/ })
    .click()
  await page.getByText('MCP', { exact: true }).waitFor()
  await page.locator('.run-list').getByRole('button').filter({ hasText: 'preview' }).click()
  await page.getByText('Started from MCP', { exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/mcp-activity.png' })
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  assert.equal(
    (await client.callTool({ name: 'list_runs', arguments: {} })).structuredContent.runs[0].id,
    run.id,
  )
  await client.close()
  client = undefined
  assert.equal(await (await fetch(`http://127.0.0.1:${taskPort}`)).text(), f.linked)
  assert.deepEqual(errors, [])
  const closed = desktop.waitForEvent('close')
  await desktop.evaluate(({ app }) => app.quit()).catch(() => {})
  await closed
  desktop = undefined
  await assert.rejects(fetch(config.url, { headers: config.headers }))
  await assert.rejects(fetch(`http://127.0.0.1:${taskPort}`))
  const saved = JSON.parse(await readFile(path.join(data, 'mcp.json'), 'utf8'))
  assert.equal(saved.enabled, true)
  assert.deepEqual(saved.projects[f.project.id].tasks, ['preview'])
  console.log(
    'PASS: MCP preferences, copied configuration, read-only default, task permissions, real client launch, Activity provenance, compact layout, closed-window access and Quit cleanup.',
  )
} finally {
  await client?.close()
  await desktop?.close()
  await f.cleanup()
}
