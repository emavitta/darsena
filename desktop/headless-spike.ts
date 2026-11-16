/**
 * Linux headless spike — the feasibility probe asked by the Mago lab
 * (docs/linux-feasibility.md): the real core — Store, WorkspaceService,
 * McpController — under plain Node, no Electron.
 *
 * Verbs:
 *   serve                                  headless daemon: workspace + MCP on 127.0.0.1
 *   register <path>                        add a repo to the store + grant the demo task
 *   ports [--json] [--scan]                MCP list_listeners (--scan: local scan, all sockets)
 *   runs [--json]                          MCP list_runs
 *   start <projectId> <worktree> <taskId>  MCP start_task
 *   stop <runId>                           MCP stop_run
 *   logs <runId>                           MCP read_logs
 *
 * Data dir: $DARSENA_DATA_DIR, else $XDG_CONFIG_HOME/darsena-spike, else
 * ~/.config/darsena-spike. MCP binds 127.0.0.1 with a per-user port
 * (20000 + uid % 20000) and a per-user token in mcp.json (mode 0600).
 */
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { Store } from './store.js'
import { WorkspaceService } from './workspace.js'
import { McpController } from './mcp.js'
import { identifyProject } from './git.js'
import { listeners } from './processes.js'
import { message } from './io.js'
import type { Listener } from '../shared/types.js'

const dataDir =
  process.env.DARSENA_DATA_DIR ||
  path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'darsena-spike',
  )
const mcpFile = path.join(dataDir, 'mcp.json')
const uid = typeof process.getuid === 'function' ? process.getuid() : 0
const defaultPort = 20000 + (uid % 20000)

/** The lab's fixed dev ports — mirror of mago-app tools/magolab/core/dev-ports.ts DEV_PORTS. */
const LAB_PORTS = new Map<number, string>([
  ...Array.from({ length: 10 }, (_, i) => [5174 + i, 'call service'] as [number, string]),
  [5190, 'WTC UI'],
  [5191, 'WTC UI'],
  [8080, 'Admin Console (frontend)'],
])

/** Harmless demo task: an HTTP server on an ephemeral 127.0.0.1 port, so a run owns a listener. */
const DEMO_TASK = {
  id: 'spike-http',
  name: 'Spike HTTP server',
  folder: '.',
  command: 'node',
  args: [
    '-e',
    "const s=require('http').createServer((q,r)=>r.end('darsena spike\\n'));s.listen(0,'127.0.0.1',()=>console.log('listening on http://127.0.0.1:'+s.address().port+'/'));",
  ],
}

interface McpSettings {
  enabled: boolean
  port: number
  token: string
  projects: Record<string, { tasks: string[] }>
}

async function readMcpSettings(): Promise<McpSettings> {
  return JSON.parse(await readFile(mcpFile, 'utf8')) as McpSettings
}

async function ensureMcpSettings(projects: Record<string, { tasks: string[] }>) {
  const current = await readMcpSettings().catch(() => undefined)
  const next: McpSettings = {
    enabled: true,
    port: current?.port ?? defaultPort,
    token: current?.token ?? randomBytes(32).toString('hex'),
    projects: { ...current?.projects, ...projects },
  }
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  await writeFile(mcpFile, JSON.stringify(next, null, 2), { mode: 0o600 })
  return next
}

async function openStore() {
  const store = new Store(dataDir)
  await store.load()
  return store
}

async function register(folder: string) {
  const store = await openStore()
  const repo = await identifyProject(folder)
  let project = store.state.projects.find((p) => p.id === repo.root)
  if (!project) {
    project = {
      id: repo.root,
      name: repo.name,
      root: repo.root,
      commonDir: repo.commonDir,
      starred: false,
      folders: [{ id: 'root', path: '.', label: 'root' }],
      favorites: [],
      customTasks: [],
      taskPreferences: {},
    }
    store.state.projects.push(project)
  }
  if (!project.customTasks.some((t) => t.id === DEMO_TASK.id))
    project.customTasks.push({ ...DEMO_TASK, args: [...DEMO_TASK.args] })
  await store.save()
  await ensureMcpSettings({ [project.id]: { tasks: [DEMO_TASK.id] } })
  console.log(
    `registered ${repo.root} (${repo.worktrees.length} worktrees) — MCP grant: ${DEMO_TASK.id}`,
  )
  console.log('restart `serve` to pick it up')
}

async function serve() {
  const store = await openStore()
  const grants = Object.fromEntries(
    store.state.projects.map((p) => [p.id, { tasks: [DEMO_TASK.id] }]),
  )
  await ensureMcpSettings(grants)
  const workspace = new WorkspaceService(store)
  const mcp = new McpController(workspace, 'linux-spike', () => {})
  await mcp.initialize()
  const status = mcp.status()
  if (!status.listening)
    throw new Error(`MCP is not listening: ${status.error || 'unknown reason'}`)
  console.log(
    `darsena headless spike — ${status.url} · data ${dataDir} · uid ${uid} · projects ${store.state.projects.length}`,
  )
  const quit = async () => {
    try {
      await workspace.runner.shutdown()
    } finally {
      process.exit(0)
    }
  }
  process.on('SIGTERM', () => void quit())
  process.on('SIGINT', () => void quit())
}

// ── Minimal MCP client (streamable HTTP: JSON or SSE answers) ──
type Json = Record<string, unknown>
async function rpc(settings: McpSettings, session: string | undefined, body: Json) {
  const response = await fetch(`http://127.0.0.1:${settings.port}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${settings.token}`,
      ...(session ? { 'mcp-session-id': session } : {}),
    },
    body: JSON.stringify(body),
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

async function call(tool: string, args: Json = {}): Promise<Json> {
  const settings = await readMcpSettings().catch(() => {
    throw new Error(`No MCP settings in ${dataDir}. Run \`register <path>\` and \`serve\` first.`)
  })
  const initialized = await rpc(settings, undefined, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'darsena-spike-cli', version: '0' },
    },
  })
  await rpc(settings, initialized.session, { jsonrpc: '2.0', method: 'notifications/initialized' })
  const { result } = await rpc(settings, initialized.session, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: tool, arguments: args },
  })
  if (result?.isError) {
    const content = result.content as { text?: string }[] | undefined
    throw new Error(content?.[0]?.text || 'MCP tool error')
  }
  if (result && 'structuredContent' in result) return result.structuredContent as Json
  const content = result?.content as { text?: string }[] | undefined
  return JSON.parse(content?.[0]?.text ?? 'null') as Json
}

function portLine(row: Listener) {
  const lab = LAB_PORTS.get(row.port)
  // `ss -e` prints no `uid:` for root-owned sockets; without a uid and a
  // readable process, claim nothing about the owner.
  const owner = row.user ?? (row.uid !== undefined ? `uid ${row.uid}` : row.pid > 0 ? 'me' : 'owner not readable')
  const holder = row.pid > 0 ? `${row.command} (pid ${row.pid})` : 'process not readable'
  const where = row.worktreeName
    ? ` · worktree ${row.worktreeName}`
    : row.cwd
      ? ` · ${row.cwd}`
      : ''
  const run = row.runId ? ` · run ${row.runId.slice(0, 8)}` : ''
  const reach = row.ipv6Only ? ' · only ::1 (unreachable through an IPv4 forward)' : ''
  return `${String(row.port).padEnd(5)} ${lab ? `[lab: ${lab}]`.padEnd(26) : ''.padEnd(26)} ${owner} · ${holder}${where}${run}${reach}`
}

function print(data: unknown, json: boolean, lines?: () => string[]) {
  if (json || !lines) console.log(JSON.stringify(data, null, 2))
  else for (const line of lines()) console.log(line)
}

const [verb, ...rest] = process.argv.slice(2)
const json = rest.includes('--json')
const scan = rest.includes('--scan')
const positional = rest.filter((a) => !a.startsWith('--'))

try {
  if (verb === 'serve') await serve()
  else if (verb === 'register' && positional[0]) await register(positional[0])
  else if (verb === 'ports' && scan) {
    const rows = await listeners()
    print(rows, json, () => rows.map(portLine))
  } else if (verb === 'ports') {
    const report = await call('list_listeners')
    const rows = (report.listeners as Listener[]) || []
    print(report, json, () => rows.map(portLine))
  } else if (verb === 'runs') {
    const data = await call('list_runs')
    print(data, json)
  } else if (verb === 'start' && positional.length === 3) {
    print(
      await call('start_task', {
        projectId: positional[0],
        worktree: positional[1],
        taskId: positional[2],
      }),
      true,
    )
  } else if (verb === 'stop' && positional[0]) {
    print(await call('stop_run', { runId: positional[0] }), true)
  } else if (verb === 'logs' && positional[0]) {
    const data = await call('read_logs', { runId: positional[0] })
    if (json) print(data, true)
    else console.log(String(data.log ?? JSON.stringify(data)))
  } else {
    console.error(
      'usage: darsena-spike <serve | register <path> | ports [--scan] [--json] | runs [--json] | start <projectId> <worktree> <taskId> | stop <runId> | logs <runId>>',
    )
    process.exit(2)
  }
} catch (error) {
  console.error(message(error))
  process.exit(1)
}
