/**
 * Darsena headless: the same core as the desktop app (Store, Runner,
 * WorkspaceService, McpController) behind a daemon and a CLI, no Electron.
 * Built for the Mago lab server (Linux, several users); see docs/linux.md.
 *
 *   darsena serve                         the daemon (a user systemd unit runs this)
 *
 * Agent verbs — through MCP, so the per-project/per-task grants hold:
 *   darsena projects | worktrees <project> | tasks <project> <worktree>
 *   darsena runs | logs <run> [-n N] | ports
 *   darsena start <project> <worktree> <task> | stop <run>
 *
 * Person verbs — through the daemon's admin socket (Unix socket, 0600):
 *   darsena status | add <path> [--workspace] | remove <project>
 *   darsena share <project> [--off] | allow <project> <worktree> <task> [--off]
 *
 * Claude Code wiring, token never in argv or in Claude's config:
 *   claude mcp add-json --scope user darsena "$(darsena mcp-json)"
 *   (registers `darsena mcp-header` as the headersHelper)
 *
 * Every verb takes --json. <project> is a name, id or path; <worktree> a
 * path, worktree name or branch; <task> an id, a name, or folder:name.
 */
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { Store } from './store.js'
import { WorkspaceService } from './workspace.js'
import { McpController } from './mcp.js'
import { identifyProject, listWorktrees, matchingWorktree } from './git.js'
import { discoverWorkspaceFolders } from './workspace-folders.js'
import { folderShortcut } from './folders.js'
import { importShellEnvironment, message } from './io.js'
import { active } from './runner.js'
import { callAdmin, serveAdmin } from './admin.js'
import type { Listener, Run, Task, Worktree } from '../shared/types.js'

declare const __DARSENA_VERSION__: string
const version = typeof __DARSENA_VERSION__ === 'string' ? __DARSENA_VERSION__ : 'dev'

// ── Paths: XDG, per user ──
const home = os.homedir()
const configDir =
  process.env.DARSENA_DATA_DIR ||
  path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'darsena')
const runtimeDir = process.env.XDG_RUNTIME_DIR
  ? path.join(process.env.XDG_RUNTIME_DIR, 'darsena')
  : path.join(configDir, 'run')
const adminSocket = path.join(runtimeDir, 'admin.sock')
const mcpFile = path.join(configDir, 'mcp.json')
const uid = typeof process.getuid === 'function' ? process.getuid() : 0
/** One MCP port per user on a shared server; mcp.json can override it. */
const defaultPort = 20000 + (uid % 20000)

const mcpFileSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  projects: z.record(z.string(), z.object({ tasks: z.array(z.string()) })),
})
type McpFile = z.infer<typeof mcpFileSchema>

async function readMcpFile(): Promise<McpFile> {
  try {
    return mcpFileSchema.parse(JSON.parse(await readFile(mcpFile, 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error(`Darsena has no MCP settings yet (${mcpFile}). Run \`darsena serve\` once.`)
    throw error
  }
}

/** First start: MCP on, per-user port, fresh token, nothing shared. */
async function ensureMcpFile() {
  await mkdir(configDir, { recursive: true, mode: 0o700 })
  try {
    await readFile(mcpFile)
  } catch {
    const initial: McpFile = {
      enabled: true,
      port: defaultPort,
      token: randomBytes(32).toString('hex'),
      projects: {},
    }
    await writeFile(mcpFile, JSON.stringify(initial, null, 2), { mode: 0o600, flag: 'wx' }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error
      },
    )
  }
}

// ── The daemon ──
const adminSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('status') }),
  z.object({ op: z.literal('add'), path: z.string().min(1), workspace: z.boolean().default(false) }),
  z.object({ op: z.literal('remove'), project: z.string().min(1) }),
  z.object({ op: z.literal('share'), project: z.string().min(1), on: z.boolean() }),
  z.object({
    op: z.literal('allow'),
    project: z.string().min(1),
    worktree: z.string().min(1),
    task: z.string().min(1),
    on: z.boolean(),
  }),
])

function taskLabel(id: string) {
  try {
    const parsed = JSON.parse(id)
    if (Array.isArray(parsed) && parsed.length === 3)
      return parsed[1] === '.' ? String(parsed[2]) : `${parsed[1]}:${parsed[2]}`
  } catch {}
  return id
}

async function serve() {
  process.env.SHELL ||= os.userInfo().shell || '/bin/sh'
  await importShellEnvironment()
  await ensureMcpFile()
  const store = new Store(configDir)
  await store.load()
  const workspace = new WorkspaceService(store)
  const mcp = new McpController(workspace, version)
  await mcp.initialize()
  const mcpStatus = mcp.status()
  if (!mcpStatus.listening)
    throw new Error(`MCP could not start: ${mcpStatus.error || 'check the port in ' + mcpFile}`)

  const findProject = (arg: string) => {
    const lower = arg.toLowerCase()
    const matches = store.state.projects.filter(
      (p) => p.id === arg || p.root === path.resolve(arg) || p.name.toLowerCase() === lower,
    )
    if (matches.length !== 1)
      throw new Error(
        matches.length
          ? `"${arg}" matches ${matches.length} projects; use its id (darsena status).`
          : `No project "${arg}". Add it with \`darsena add <path>\`.`,
      )
    return matches[0]!
  }

  const admin = await serveAdmin(adminSocket, async (body) => {
    const request = adminSchema.parse(body)
    switch (request.op) {
      case 'status': {
        const grants = mcp.status().projects
        return {
          version,
          pid: process.pid,
          mcp: mcp.status().url,
          dataDir: configDir,
          adminSocket,
          activeRuns: workspace.runner.list().filter(active).length,
          projects: store.state.projects.map((p) => ({
            id: p.id,
            name: p.name,
            root: p.root,
            shared: Object.hasOwn(grants, p.id),
            allowedTasks: (grants[p.id]?.tasks ?? []).map(taskLabel),
          })),
        }
      }
      case 'add': {
        const chosen = await realpath(request.path)
        const repo = await identifyProject(chosen)
        let project = store.state.projects.find((p) => p.commonDir === repo.commonDir)
        if (!project) {
          project = {
            id: randomUUID(),
            name: repo.name,
            root: repo.root,
            commonDir: repo.commonDir,
            starred: false,
            folders: [{ id: 'root', label: 'Repository', path: '.' }],
            favorites: [],
            customTasks: [],
            taskPreferences: {},
          }
          store.state.projects.push(project)
        }
        project.lastWorktree = matchingWorktree(repo.worktrees, chosen)?.path || repo.root
        if (request.workspace) {
          const detected = await discoverWorkspaceFolders(repo.root)
          for (const folder of detected.folders) {
            const shortcut = await folderShortcut(repo.root, folder.path)
            if (!project.folders.some((f) => f.path === shortcut.path))
              project.folders.push({ id: randomUUID(), ...shortcut })
          }
        }
        await store.save()
        return {
          id: project.id,
          name: project.name,
          root: project.root,
          worktrees: repo.worktrees.length,
          folders: project.folders.map((f) => f.path),
        }
      }
      case 'remove': {
        const project = findProject(request.project)
        if (workspace.runner.list().some((r) => r.projectId === project.id && active(r)))
          throw new Error('Stop this project’s runs before removing it.')
        if (Object.hasOwn(mcp.status().projects, project.id))
          await mcp.allowProject(project.id, false)
        store.state.projects = store.state.projects.filter((p) => p.id !== project.id)
        await store.save()
        return { removed: project.id }
      }
      case 'share': {
        const project = findProject(request.project)
        await mcp.allowProject(project.id, request.on)
        return { project: project.id, shared: request.on }
      }
      case 'allow': {
        const project = findProject(request.project)
        const trees = await listWorktrees(project.root, false)
        const tree = pickWorktree(trees, request.worktree)
        const catalog = await workspace.tasks(project.id, tree.path)
        const task = pickTask(catalog.tasks, request.task)
        await mcp.allowTask({
          projectId: project.id,
          worktree: tree.path,
          taskId: task.id,
          allowed: request.on,
        })
        return { project: project.id, task: taskLabel(task.id), allowed: request.on }
      }
    }
  })

  console.log(
    `darsena ${version} — MCP ${mcpStatus.url} · admin ${adminSocket} · data ${configDir} · ${store.state.projects.length} projects`,
  )
  let quitting = false
  const quit = async (signal: string) => {
    if (quitting) return
    quitting = true
    console.log(`${signal}: stopping runs`)
    let code = 0
    try {
      await workspace.runner.shutdown()
    } catch (error) {
      console.error(message(error))
      code = 1
    }
    await mcp.shutdown().catch(() => {})
    admin.close()
    process.exit(code)
  }
  process.on('SIGTERM', () => void quit('SIGTERM'))
  process.on('SIGINT', () => void quit('SIGINT'))
}

// ── Argument resolution, shared by both channels ──
function pickWorktree(trees: Worktree[], arg: string): Worktree {
  const resolved = path.resolve(arg)
  const matches = trees.filter(
    (t) => t.exists && (t.path === resolved || t.name === arg || t.branch === arg),
  )
  if (matches.length === 1) return matches[0]!
  throw new Error(
    matches.length
      ? `"${arg}" matches ${matches.length} worktrees; use the path.`
      : `No worktree "${arg}" (path, worktree name or branch). darsena worktrees <project> lists them.`,
  )
}

function pickTask<T extends Pick<Task, 'id' | 'name' | 'folder'>>(tasks: T[], arg: string): T {
  const byId = tasks.find((t) => t.id === arg)
  if (byId) return byId
  const qualified = tasks.filter((t) => `${t.folder}:${t.name}` === arg)
  if (qualified.length === 1) return qualified[0]!
  const named = tasks.filter((t) => t.name === arg)
  if (named.length === 1) return named[0]!
  throw new Error(
    named.length
      ? `"${arg}" exists in ${named.length} folders: ${named.map((t) => `${t.folder}:${t.name}`).join(', ')}.`
      : `No task "${arg}". darsena tasks <project> <worktree> lists them.`,
  )
}

// ── Minimal MCP client (streamable HTTP; JSON or SSE answers) ──
type Json = Record<string, any>
async function rpc(settings: McpFile, session: string | undefined, body: Json) {
  const response = await fetch(`http://127.0.0.1:${settings.port}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${settings.token}`,
      ...(session ? { 'mcp-session-id': session } : {}),
    },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error(
      'Darsena is not running. Start it with `darsena serve` (or `systemctl --user start darsena`).',
    )
  })
  if (!response.ok && response.status !== 202)
    throw new Error(`MCP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const nextSession = response.headers.get('mcp-session-id') || session
  const text = await response.text()
  if (!text) return { session: nextSession, result: undefined as Json | undefined }
  const payloads = (response.headers.get('content-type') || '').includes('text/event-stream')
    ? text
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
    : [text]
  const answer = payloads
    .map((payload) => JSON.parse(payload) as Json)
    .find((m) => 'result' in m || 'error' in m)
  if (answer && 'error' in answer) throw new Error(JSON.stringify(answer.error))
  return { session: nextSession, result: answer?.result as Json | undefined }
}

let mcpSession: { settings: McpFile; id?: string } | undefined
async function tool(name: string, args: Json = {}): Promise<Json> {
  if (!mcpSession) {
    const settings = await readMcpFile()
    const init = await rpc(settings, undefined, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'darsena-cli', version },
      },
    })
    await rpc(settings, init.session, { jsonrpc: '2.0', method: 'notifications/initialized' })
    mcpSession = { settings, id: init.session }
  }
  const { result } = await rpc(mcpSession.settings, mcpSession.id, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name, arguments: args },
  })
  if (result?.isError) throw new Error(result.content?.[0]?.text || `${name} failed`)
  return (result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? 'null')) as Json
}

async function project(arg: string) {
  const { projects } = await tool('list_projects')
  const lower = arg.toLowerCase()
  const matches = (projects as { id: string; name: string; root: string }[]).filter(
    (p) => p.id === arg || p.root === path.resolve(arg) || p.name.toLowerCase() === lower,
  )
  if (matches.length === 1) return matches[0]!
  throw new Error(
    matches.length
      ? `"${arg}" matches ${matches.length} projects; use its id.`
      : `No shared project "${arg}". The person running Darsena shares it with \`darsena share <project>\`.`,
  )
}

async function worktree(projectId: string, arg: string) {
  const { worktrees } = await tool('list_worktrees', { projectId })
  return pickWorktree(worktrees as Worktree[], arg)
}

async function run(arg: string): Promise<Run> {
  const { runs } = await tool('list_runs')
  const matches = (runs as Run[]).filter((r) => r.id === arg || r.id.startsWith(arg))
  if (matches.length === 1) return matches[0]!
  throw new Error(matches.length ? `"${arg}" matches ${matches.length} runs.` : `No run "${arg}".`)
}

// ── Human-readable output ──
function portRow(row: Listener) {
  const owner = row.user ?? (row.uid !== undefined ? `uid ${row.uid}` : row.pid > 0 ? 'me' : 'owner not readable')
  const holder = row.pid > 0 ? `${row.command} (pid ${row.pid})` : 'process not readable'
  const where = row.worktreeName ? ` · ${row.worktreeName}` : ''
  const runId = row.runId ? ` · run ${row.runId.slice(0, 8)}` : ''
  const names = row.portless
    ? ` · ${row.portless.hostnames.join(', ')}${row.portless.served ? '' : ' (registered, no proxy for this user)'}`
    : ''
  const reach = row.ipv6Only ? ' · only ::1, unreachable through an IPv4 forward' : ''
  const pool = row.pool ? `[${row.pool}] ` : ''
  return `${String(row.port).padEnd(6)}${pool}${owner} · ${holder}${where}${runId}${names}${reach}`
}

function runRow(r: Run) {
  const where = `${r.projectName} · ${r.worktreeBranch ?? r.worktreeName} · ${r.name}`
  const extra = r.urls.length ? ` · ${r.urls[0]}` : r.port ? ` · port ${r.port}` : ''
  return `${r.id.slice(0, 8)}  ${r.status.padEnd(9)} ${where}${extra}`
}

function output(data: unknown, json: boolean, lines: () => string[]) {
  if (json) console.log(JSON.stringify(data, null, 2))
  else for (const line of lines()) console.log(line)
}

// ── CLI ──
const usage = `darsena ${version}
  serve
  projects | worktrees <project> | tasks <project> <worktree>
  runs | logs <run> [-n N] | ports
  start <project> <worktree> <task> | stop <run>
  status | add <path> [--workspace] | remove <project>
  share <project> [--off] | allow <project> <worktree> <task> [--off]
  mcp-json | mcp-header | unit | version
All verbs accept --json.`

async function main(argv: string[]) {
  const json = argv.includes('--json')
  const off = argv.includes('--off')
  const n = argv.includes('-n') ? Number(argv[argv.indexOf('-n') + 1]) : 100
  const args = argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '-n')
  const [verb, a, b, c] = argv[0] === '--version' ? ['version'] : args

  switch (verb) {
    case 'serve':
      return serve()
    case 'projects': {
      const data = await tool('list_projects')
      return output(data, json, () =>
        (data.projects as { id: string; name: string; root: string }[]).map(
          (p) => `${p.name.padEnd(24)} ${p.root}  (${p.id})`,
        ),
      )
    }
    case 'worktrees': {
      if (!a) break
      const p = await project(a)
      const data = await tool('list_worktrees', { projectId: p.id })
      return output(data, json, () =>
        (data.worktrees as Worktree[]).map(
          (w) => `${(w.branch ?? `(detached ${w.head.slice(0, 7)})`).padEnd(40)} ${w.path}${w.main ? '  [main]' : ''}${w.changed ? `  ${w.changed} changed` : ''}`,
        ),
      )
    }
    case 'tasks': {
      if (!a || !b) break
      const p = await project(a)
      const w = await worktree(p.id, b)
      const data = await tool('list_tasks', { projectId: p.id, worktree: w.path })
      return output(data, json, () =>
        (data.tasks as (Task & { mcpAllowed: boolean })[]).map(
          (t) => `${t.mcpAllowed ? '✓' : ' '} ${`${t.folder}:${t.name}`.padEnd(48)} ${t.available ? '' : '(unavailable) '}${t.description ?? ''}`.trimEnd(),
        ),
      )
    }
    case 'runs': {
      const data = await tool('list_runs')
      return output(data, json, () => (data.runs as Run[]).map(runRow))
    }
    case 'logs': {
      if (!a) break
      const r = await run(a)
      const data = await tool('read_logs', { runId: r.id, lines: Math.min(Math.max(n || 100, 1), 500) })
      return output(data, json, () => [String(data.text)])
    }
    case 'ports': {
      const data = await tool('list_listeners', { scope: 'all' })
      const rows = (data.listeners as Listener[]).sort((x, y) => x.port - y.port)
      return output({ ...data, listeners: rows }, json, () => [
        ...((data.warnings as string[] | undefined) ?? []).map((w) => `warning: ${w}`),
        ...rows.map(portRow),
      ])
    }
    case 'start': {
      if (!a || !b || !c) break
      const p = await project(a)
      const w = await worktree(p.id, b)
      const { tasks } = await tool('list_tasks', { projectId: p.id, worktree: w.path })
      const t = pickTask(tasks as Task[], c)
      const data = await tool('start_task', { projectId: p.id, worktree: w.path, taskId: t.id })
      return output(data, json, () =>
        data.kind === 'started' ? [runRow(data.run as Run)] : [`conflict: ${data.message}`],
      )
    }
    case 'stop': {
      if (!a) break
      const r = await run(a)
      const data = await tool('stop_run', { runId: r.id })
      return output(data, json, () => [runRow((data.run ?? r) as Run)])
    }
    case 'status': {
      const data = (await callAdmin(adminSocket, { op: 'status' })) as Json
      return output(data, json, () => [
        `darsena ${data.version} · pid ${data.pid} · MCP ${data.mcp} · ${data.activeRuns} active runs`,
        `data ${data.dataDir} · admin ${data.adminSocket}`,
        ...(data.projects as Json[]).map(
          (p) => `${p.shared ? 'shared ' : 'private'} ${String(p.name).padEnd(24)} ${p.root}${p.allowedTasks.length ? `  tasks: ${p.allowedTasks.join(', ')}` : ''}`,
        ),
      ])
    }
    case 'add': {
      if (!a) break
      const data = (await callAdmin(adminSocket, {
        op: 'add',
        path: path.resolve(a),
        workspace: argv.includes('--workspace'),
      })) as Json
      return output(data, json, () => [
        `added ${data.name} (${data.worktrees} worktrees, folders: ${data.folders.join(', ')})`,
        `share it with MCP: darsena share ${data.name}`,
      ])
    }
    case 'remove': {
      if (!a) break
      const data = await callAdmin(adminSocket, { op: 'remove', project: a })
      return output(data, json, () => [`removed ${a}`])
    }
    case 'share': {
      if (!a) break
      const data = await callAdmin(adminSocket, { op: 'share', project: a, on: !off })
      return output(data, json, () => [`${a}: ${off ? 'not shared' : 'shared'} with MCP`])
    }
    case 'allow': {
      if (!a || !b || !c) break
      const data = (await callAdmin(adminSocket, {
        op: 'allow',
        project: a,
        worktree: b,
        task: c,
        on: !off,
      })) as Json
      return output(data, json, () => [`${data.task}: ${off ? 'not allowed' : 'allowed'} for MCP`])
    }
    case 'mcp-json': {
      const settings = await readMcpFile()
      const self = process.env.DARSENA_BIN || `${process.execPath} ${path.resolve(process.argv[1]!)}`
      return console.log(
        JSON.stringify({
          type: 'http',
          url: `http://127.0.0.1:${settings.port}/mcp`,
          headersHelper: `${self} mcp-header`,
        }),
      )
    }
    case 'mcp-header': {
      const settings = await readMcpFile()
      return console.log(JSON.stringify({ Authorization: `Bearer ${settings.token}` }))
    }
    case 'unit': {
      // ExecStart goes through the stable shim (…/current via the bin
      // symlink), so an update only flips `current` and restarts.
      const bin = process.env.DARSENA_BIN
      if (!bin) throw new Error('Run `unit` through the installed `darsena` command.')
      return console.log(`[Unit]
Description=Darsena headless: dev servers per worktree, MCP on 127.0.0.1
After=default.target

[Service]
Type=simple
Environment=DARSENA_NODE=${process.execPath}
ExecStart=${bin} serve
# SIGTERM to Darsena only: it stops its runs' process groups itself, then
# systemd kills whatever is left after the timeout.
KillMode=mixed
TimeoutStopSec=20
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target`)
    }
    case 'version':
    case '--version':
      return console.log(version)
  }
  console.error(usage)
  process.exit(2)
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  console.error(message(error))
  process.exit(1)
}
