import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { request as httpRequest } from 'node:http'
import { readFile, stat, writeFile, symlink } from 'node:fs/promises'
import path from 'node:path'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { Store } from '../desktop/store.js'
import { WorkspaceService } from '../desktop/workspace.js'
import { McpController } from '../desktop/mcp.js'
import { fixture, eventually } from './fixture.js'

async function freePort() {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}
async function setup(t: { after: (fn: () => Promise<unknown>) => void }) {
  const f = await fixture()
  const store = new Store(path.join(f.directory, 'profile'))
  store.state.projects = [f.project]
  const workspace = new WorkspaceService(store)
  const mcp = new McpController(workspace, '0.1.0')
  t.after(async () => {
    await mcp.stop()
    await workspace.runner.shutdown()
    await f.cleanup()
  })
  await mcp.initialize()
  assert.equal(mcp.status().listening, false)
  await mcp.configure({ enabled: true, port: await freePort() })
  const configuration = () =>
    JSON.parse(mcp.configuration()).mcpServers.darsena as {
      url: string
      headers: Record<string, string>
    }
  async function connect(mode: 'legacy' | 'auto' = 'legacy') {
    const config = configuration()
    const client = new Client(
      { name: 'fixture-client', version: '1' },
      { versionNegotiation: { mode } },
    )
    await client.connect(
      new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: { headers: config.headers },
      }),
    )
    t.after(() => client.close())
    return client
  }
  return { f, store, workspace, mcp, configuration, connect }
}
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  assert.equal(result.isError, undefined, JSON.stringify(result.content))
  return result.structuredContent as Record<string, any>
}

test('MCP authenticates HTTP, supports legacy/modern clients and defaults to no project access', async (t) => {
  const { f, mcp, configuration, connect } = await setup(t)
  const config = configuration()
  assert.equal((await fetch(config.url)).status, 401)
  assert.equal(
    (await fetch(config.url, { headers: { Authorization: 'Bearer wrong' } })).status,
    401,
  )
  for (const origin of ['https://evil.example', 'null', 'http://127.0.0.1'])
    assert.equal(
      (await fetch(config.url, { headers: { ...config.headers, Origin: origin } })).status,
      403,
    )
  const invalidHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(
      config.url,
      { headers: { ...config.headers, Host: 'evil.example' } },
      (response) => {
        response.resume()
        resolve(response.statusCode)
      },
    )
    request.on('error', reject)
    request.end()
  })
  assert.equal(invalidHostStatus, 403)
  assert.equal(
    (
      await fetch(config.url, {
        method: 'POST',
        headers: { ...config.headers, 'Content-Type': 'application/json' },
        body: 'broken',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await fetch(config.url, {
        method: 'POST',
        headers: { ...config.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ padding: 'x'.repeat(270000) }),
      })
    ).status,
    413,
  )
  for (const mode of ['legacy', 'auto'] as const) {
    const client = await connect(mode)
    assert.equal(client.getServerVersion()?.name, 'darsena')
    assert.equal(client.getProtocolEra(), mode === 'auto' ? 'modern' : 'legacy')
    assert.equal((await client.listTools()).tools.length, 13)
    assert.deepEqual((await call(client, 'list_projects')).projects, [])
    assert.equal(
      (await client.callTool({ name: 'list_worktrees', arguments: { projectId: f.project.id } }))
        .isError,
      true,
    )
    await assert.rejects(
      client.callTool({ name: 'stopExternal', arguments: { pid: process.pid } }),
      /not found/,
    )
  }
  assert.equal((await stat(path.join(f.directory, 'profile/mcp.json'))).mode & 0o777, 0o600)
  assert.ok(!JSON.stringify(mcp.status()).includes(config.headers.Authorization!))
})

test('shared engine runs authorized tasks in explicit worktrees, exposes bounded logs and prevents concurrent duplicates', async (t) => {
  const { f, mcp, workspace, connect } = await setup(t)
  const port = await freePort()
  f.project.customTasks.push({
    id: 'server',
    name: 'Fixture server',
    folder: '.',
    command: process.execPath,
    args: [
      '-e',
      `const http=require('node:http');http.createServer((q,s)=>s.end(process.cwd())).listen(${port},'127.0.0.1',()=>{console.log(process.cwd());console.log('x'.repeat(40000));console.log('Ready');});`,
    ],
  })
  f.project.taskPreferences.server = { port }
  await mcp.allowProject(f.project.id, true)
  const client = await connect()
  const other = await connect('auto')
  const input = { projectId: f.project.id, worktree: f.linked, taskId: 'server' }
  assert.equal(
    (await call(client, 'list_worktrees', { projectId: f.project.id })).worktrees.length,
    2,
  )
  assert.equal(
    (await call(client, 'list_tasks', { projectId: f.project.id, worktree: f.linked })).tasks.find(
      (task: any) => task.id === 'server',
    ).mcpAllowed,
    false,
  )
  assert.equal((await client.callTool({ name: 'start_task', arguments: input })).isError, true)
  assert.equal(workspace.runner.list().length, 0)
  await mcp.allowTask({ ...input, allowed: true })
  assert.deepEqual(f.project.favorites, [])
  const results = await Promise.all([
    call(client, 'start_task', input),
    call(other, 'start_task', input),
  ])
  assert.deepEqual(results.map((result) => result.kind).sort(), ['conflict', 'started'])
  const run = results.find((result) => result.kind === 'started')!.run
  assert.equal(run.source, 'mcp')
  assert.equal(run.worktree, f.linked)
  await eventually(() => workspace.runner.logs(run.id).includes('Ready'))
  assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), f.linked)
  assert.equal(f.project.lastWorktree, f.root)
  const uiConflict = await workspace.start({ ...input, worktree: f.root })
  assert.equal(uiConflict.kind, 'conflict')
  assert.equal(workspace.runner.list().length, 1)
  assert.ok(
    (await call(client, 'list_listeners')).listeners.some(
      (listener: any) => listener.port === port && listener.runId === run.id,
    ),
  )
  const logs = await call(client, 'read_logs', { runId: run.id, lines: 500 })
  assert.ok(logs.text.length <= 32768)
  assert.equal(logs.truncated, true)
  assert.equal(
    (await client.callTool({ name: 'read_logs', arguments: { runId: run.id, lines: 501 } }))
      .isError,
    true,
  )
  await other.close()
  assert.equal(workspace.runner.list()[0]!.status, 'running')
  await call(client, 'stop_run', { runId: run.id })
  assert.equal(workspace.runner.list()[0]!.status, 'stopped')
  await call(client, 'stop_run', { runId: run.id })
})

test('project/task revocation, token rotation and disabling take effect for existing clients without killing runs', async (t) => {
  const { f, mcp, workspace, connect, configuration } = await setup(t)
  f.project.customTasks.push({
    id: 'wait',
    name: 'Wait',
    folder: '.',
    command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'],
  })
  const input = { projectId: f.project.id, worktree: f.project.root, taskId: 'wait' }
  await mcp.allowProject(f.project.id, true)
  await mcp.allowTask({ ...input, allowed: true })
  const client = await connect()
  const result = await call(client, 'start_task', input)
  await mcp.allowTask({ ...input, allowed: false })
  assert.equal(
    (await client.callTool({ name: 'stop_run', arguments: { runId: result.run.id } })).isError,
    true,
  )
  await mcp.allowProject(f.project.id, false)
  assert.deepEqual((await call(client, 'list_runs')).runs, [])
  assert.equal(
    (await client.callTool({ name: 'read_logs', arguments: { runId: result.run.id } })).isError,
    true,
  )
  const old = configuration()
  await mcp.rotateToken()
  assert.equal((await fetch(old.url, { headers: old.headers })).status, 401)
  assert.notEqual(configuration().headers.Authorization, old.headers.Authorization)
  await mcp.configure({ enabled: false, port: mcp.status().port })
  assert.equal(mcp.status().listening, false)
  assert.equal(workspace.runner.list()[0]!.status, 'running')
  await assert.rejects(fetch(old.url))
  await workspace.runner.stop(result.run.id)
  const persisted = JSON.parse(await readFile(path.join(f.directory, 'profile/mcp.json'), 'utf8'))
  assert.equal(persisted.enabled, false)
  assert.deepEqual(persisted.projects, {})
})

test('MCP cannot run unknown tasks, escape a registered worktree, or implicitly evaluate Gradle', async (t) => {
  const { f, mcp, workspace, connect } = await setup(t)
  await mcp.allowProject(f.project.id, true)
  await writeFile(
    path.join(f.root, 'android-app/gradlew'),
    '#!/bin/sh\necho should-not-run > marker\n',
  )
  const client = await connect()
  const catalog = await call(client, 'list_tasks', { projectId: f.project.id, worktree: f.root })
  assert.equal(catalog.sources.find((source: any) => source.kind === 'gradle').loaded, false)
  await assert.rejects(stat(path.join(f.root, 'android-app/marker')))
  assert.equal(
    (
      await client.callTool({
        name: 'list_tasks',
        arguments: { projectId: f.project.id, worktree: f.directory },
      })
    ).isError,
    true,
  )
  await symlink(f.directory, path.join(f.root, 'outside'))
  f.project.customTasks.push({
    id: 'escape',
    name: 'Escape',
    folder: 'outside',
    command: process.execPath,
    args: ['-e', 'process.exit(0)'],
  })
  await assert.rejects(
    mcp.allowTask({ projectId: f.project.id, worktree: f.project.root, taskId: 'escape', allowed: true }),
    /available/,
  )
  assert.equal(
    (
      await client.callTool({
        name: 'start_task',
        arguments: { projectId: f.project.id, worktree: f.project.root, taskId: 'invented' },
      })
    ).isError,
    true,
  )
  assert.equal(workspace.runner.list().length, 0)
})

test('a pending start rechecks authorization after the shared queue and filesystem discovery', async (t) => {
  const { f, mcp, workspace, connect } = await setup(t)
  f.project.customTasks.push({
    id: 'wait',
    name: 'Wait',
    folder: '.',
    command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'],
  })
  const input = { projectId: f.project.id, worktree: f.project.root, taskId: 'wait' }
  await mcp.allowProject(f.project.id, true)
  await mcp.allowTask({ ...input, allowed: true })
  const original = workspace.discovery.list.bind(workspace.discovery)
  let entered = false,
    release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  workspace.discovery.list = async (...args) => {
    entered = true
    await gate
    return original(...args)
  }
  const client = await connect()
  const pending = client.callTool({ name: 'start_task', arguments: input })
  await eventually(() => entered)
  await mcp.allowProject(f.project.id, false)
  release()
  assert.equal((await pending).isError, true)
  assert.equal(workspace.runner.list().length, 0)
})

test('unshared projects never appear in runs, logs, listeners or cross-project port conflicts', async (t) => {
  const { f, mcp, workspace, connect } = await setup(t)
  const hidden = await fixture()
  t.after(hidden.cleanup)
  hidden.project.id = 'private-project'
  hidden.project.name = 'Private project'
  workspace.store.state.projects.push(hidden.project)
  const port = await freePort()
  const task = {
    id: 'server',
    name: 'Private server name',
    folder: '.',
    command: process.execPath,
    args: [
      '-e',
      `require('node:http').createServer((q,s)=>s.end('private')).listen(${port},'127.0.0.1',()=>console.log('private ready'))`,
    ],
  }
  hidden.project.customTasks.push(task)
  hidden.project.taskPreferences.server = { port }
  f.project.customTasks.push({ ...task, name: 'Shared server' })
  f.project.taskPreferences.server = { port }
  await mcp.allowProject(f.project.id, true)
  await mcp.allowTask({
    projectId: f.project.id,
    worktree: f.root,
    taskId: 'server',
    allowed: true,
  })
  const started = await workspace.start({
    projectId: hidden.project.id,
    worktree: hidden.root,
    taskId: 'server',
  })
  assert.equal(started.kind, 'started')
  if (started.kind !== 'started') throw new Error('Expected fixture server to start')
  await eventually(() => workspace.runner.logs(started.run.id).includes('ready'))
  const client = await connect()
  assert.deepEqual(
    (await call(client, 'list_projects')).projects.map((project: any) => project.id),
    [f.project.id],
  )
  assert.deepEqual((await call(client, 'list_runs')).runs, [])
  assert.deepEqual((await call(client, 'list_listeners')).listeners, [])
  assert.equal(
    (await client.callTool({ name: 'read_logs', arguments: { runId: started.run.id } })).isError,
    true,
  )
  assert.equal(
    (await client.callTool({ name: 'stop_run', arguments: { runId: started.run.id } })).isError,
    true,
  )
  const conflict = await call(client, 'start_task', {
    projectId: f.project.id,
    worktree: f.root,
    taskId: 'server',
  })
  assert.equal(conflict.kind, 'conflict')
  assert.equal(conflict.runId, undefined)
  assert.ok(!JSON.stringify(conflict).includes('Private'))
  await workspace.runner.stop(started.run.id)
})

test('connection failures can be corrected and persisted permissions survive a restart', async (t) => {
  const { f, mcp, workspace, configuration } = await setup(t)
  await mcp.allowProject(f.project.id, true)
  const original = configuration()
  await mcp.stop()
  const occupied = createServer()
  await new Promise<void>((resolve) => occupied.listen(mcp.status().port, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise<void>((resolve) => occupied.close(() => resolve()))
  })
  await mcp.configure({ enabled: true, port: mcp.status().port })
  assert.equal(mcp.status().listening, false)
  assert.match(mcp.status().error!, /already in use/)
  await mcp.configure({ enabled: true, port: await freePort() })
  assert.equal(mcp.status().listening, true)
  assert.equal(mcp.status().error, undefined)
  const savedPort = mcp.status().port
  await mcp.shutdown()
  await assert.rejects(mcp.configure({ enabled: true, port: savedPort }), /shutting down/)
  const restarted = new McpController(workspace, '0.1.0')
  t.after(() => restarted.shutdown())
  await restarted.initialize()
  assert.equal(restarted.status().listening, true)
  assert.equal(restarted.status().port, savedPort)
  assert.deepEqual(restarted.status().projects[f.project.id], { tasks: [] })
  assert.equal(
    JSON.parse(restarted.configuration()).mcpServers.darsena.headers.Authorization,
    original.headers.Authorization,
  )
})

test('run inspection and bounded waiting distinguish outcomes and recheck sharing', async (t) => {
  const { f, mcp, workspace, connect } = await setup(t)
  await mcp.allowProject(f.project.id, true)
  const client = await connect()
  f.project.customTasks.push({
    id: 'finish',
    name: 'finish',
    folder: '.',
    command: process.execPath,
    args: ['-e', 'setTimeout(()=>process.exit(0), 700)'],
  })
  const input = { projectId: f.project.id, worktree: f.project.root, taskId: 'finish' }
  await mcp.allowTask({ ...input, allowed: true })
  const { run } = await call(client, 'start_task', input)
  const pending = await call(client, 'wait_for_run', { runId: run.id, timeoutMs: 0 })
  assert.equal(pending.timedOut, true)
  assert.equal(pending.outcome, 'pending')
  const done = await call(client, 'wait_for_run', { runId: run.id, timeoutMs: 5000 })
  assert.equal(done.timedOut, false)
  assert.equal(done.outcome, 'succeeded')
  assert.equal(done.run.exitCode, 0)
  assert.ok(done.durationMs >= 0)
  assert.equal((await call(client, 'get_run', { runId: run.id })).completed, true)
  assert.equal(
    (await client.callTool({ name: 'get_run', arguments: { runId: 'missing' } })).isError,
    true,
  )
  const task = f.project.customTasks.find((task) => task.id === 'finish')!
  task.args = ['-e', 'process.exit(7)']
  const failed = await call(client, 'start_task', input)
  const failure = await call(client, 'wait_for_run', { runId: failed.run.id, timeoutMs: 5000 })
  assert.equal(failure.outcome, 'failed')
  assert.equal(failure.run.exitCode, 7)
  task.args = ['-e', 'setInterval(()=>{},1000)']
  const live = await call(client, 'start_task', input)
  const waiting = client.callTool({
    name: 'wait_for_run',
    arguments: { runId: live.run.id, timeoutMs: 5000 },
  })
  await new Promise((resolve) => setTimeout(resolve, 100))
  await mcp.allowProject(f.project.id, false)
  assert.equal((await waiting).isError, true)
  assert.equal(
    (await client.callTool({ name: 'get_run', arguments: { runId: live.run.id } })).isError,
    true,
  )
  await workspace.runner.stop(live.run.id)
  await mcp.allowProject(f.project.id, true)
  assert.equal((await call(client, 'wait_for_run', { runId: live.run.id })).outcome, 'stopped')
})

test('MCP Logcat reads only shared sessions and stopping logs does not require command execution grants', async (t) => {
  const { f, workspace, mcp, connect } = await setup(t)
  const client = await connect()
  const { worktree } = await workspace.tree(f.project.id, f.root)
  const session = workspace.runner.start(
    f.project,
    worktree,
    {
      id: 'logcat-test',
      name: 'Logcat',
      folder: '.',
      kind: 'custom',
      available: true,
      command: process.execPath,
      args: [
        '-e',
        "console.log('09-11 12:00:00.000 1 1 I App: hello');console.log('09-11 12:00:00.000 1 1 E App: broken');setInterval(()=>{},1000)",
      ],
    },
    f.root,
    'ui',
    {
      androidDevice: 'fixture-device',
      androidOperation: 'logcat',
      androidApplicationId: 'app.fixture',
    },
  )
  await eventually(() => workspace.runner.logs(session.id).includes('broken'))
  for (const name of ['read_logcat', 'stop_logcat', 'start_logcat']) {
    assert.equal((await client.callTool({ name, arguments: { runId: session.id } })).isError, true)
  }
  await mcp.allowProject(f.project.id, true)
  const logs = await call(client, 'read_logcat', { runId: session.id, level: 'E' })
  assert.equal(logs.collecting, true)
  assert.ok(logs.text.includes('broken'))
  assert.ok(!logs.text.includes('hello'))
  assert.equal(
    (await client.callTool({ name: 'start_logcat', arguments: { runId: session.id } })).isError,
    true,
  )
  assert.equal((await call(client, 'stop_logcat', { runId: session.id })).run.status, 'stopped')
  assert.equal((await call(client, 'read_logcat', { runId: session.id })).collecting, false)
  await mcp.allowProject(f.project.id, false)
  assert.equal(
    (await client.callTool({ name: 'read_logcat', arguments: { runId: session.id } })).isError,
    true,
  )
})


test('favorites grant MCP execution only in shared projects and revocation preserves other grants', async (t) => {
  const { f, mcp, connect } = await setup(t)
  f.project.customTasks.push({ id: 'favorite', name: 'Favorite', folder: '.', command: process.execPath, args: ['-e', 'console.log("done")'] })
  f.project.customTasks.push({ id: 'explicit', name: 'Explicit', folder: '.', command: process.execPath, args: ['-e', 'console.log("done")'] })
  f.project.favorites.push('favorite')
  const client = await connect()
  const input = { projectId: f.project.id, worktree: f.project.root, taskId: 'favorite' }
  assert.equal((await client.callTool({ name: 'start_task', arguments: input })).isError, true)
  await mcp.allowProject(f.project.id, true)
  assert.ok(mcp.status().projects[f.project.id]!.tasks.includes('favorite'))
  const taskInput = { ...input, worktree: f.project.root }
  const catalog = await call(client, 'list_tasks', { projectId: taskInput.projectId, worktree: taskInput.worktree })
  assert.equal(catalog.tasks.find((task: any) => task.id === 'favorite').mcpAllowed, true)
  await call(client, 'start_task', taskInput)
  await mcp.allowTask({ ...taskInput, allowed: true })
  await mcp.allowTask({ ...taskInput, taskId: 'explicit', allowed: true })
  await mcp.removeFavoriteGrant(f.project.id, 'favorite')
  f.project.favorites = []
  assert.equal(mcp.status().projects[f.project.id]!.tasks.includes('favorite'), false)
  assert.equal(mcp.status().projects[f.project.id]!.tasks.includes('explicit'), true)
  assert.equal((await client.callTool({ name: 'start_task', arguments: taskInput })).isError, true)
  await mcp.allowProject(f.project.id, false)
  f.project.favorites.push('favorite')
  assert.equal((await client.callTool({ name: 'start_task', arguments: taskInput })).isError, true)
})
