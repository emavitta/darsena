import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  shell,
  Tray,
} from 'electron'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Store } from './store.js'
import { identifyProject, listWorktrees, matchingWorktree, validateWorktree } from './git.js'
import { command, importShellEnvironment, inside, message, resolveFolder } from './io.js'
import { TaskDiscovery } from './tasks.js'
import { browseFolders, folderShortcut } from './folders.js'
import { Runner, active } from './runner.js'
import { isDescendant, listeners, processCwd, processParents } from './processes.js'
import { isWindows, setTaskHost } from './platform.js'
import { openApplication } from './launchers.js'
import { windowsStartTime, stopWindowsProcess } from './windows-system.js'
import type { ListenerReport, Methods, StartResult } from '../shared/types.js'

app.setName('Darsena')
if (process.env.DARSENA_DATA_DIR)
  app.setPath('userData', path.resolve(process.env.DARSENA_DATA_DIR))
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'darsena',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])
const base = path.dirname(fileURLToPath(import.meta.url))
setTaskHost(
  path.join(base.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1'), 'darsena-task-host.exe'),
)
const assets = path.resolve(base, '../.output/public')
const devUrl =
  !app.isPackaged && process.env.DARSENA_DEV_URL === 'http://127.0.0.1:3141'
    ? process.env.DARSENA_DEV_URL
    : undefined
const store = new Store(app.getPath('userData'))
const discovery = new TaskDiscovery()
const runner = new Runner()
let window: BrowserWindow | undefined
let tray: Tray | undefined
let quitReady = false,
  quitting = false,
  initialized = false
let changeTimer: ReturnType<typeof setTimeout> | undefined
function changed() {
  if (changeTimer) return
  changeTimer = setTimeout(() => {
    changeTimer = undefined
    if (window && !window.isDestroyed() && window.isVisible())
      window.webContents.send('darsena:changed')
  }, 150)
}
runner.on('changed', changed)
const string = z
  .string()
  .min(1)
  .max(8192)
  .refine((v) => !v.includes('\0'))
const projectInput = z.object({ projectId: string })
const treeInput = projectInput.extend({ worktree: string })
const taskInput = treeInput.extend({ taskId: string })
const folderInput = treeInput.extend({ folder: string })
const schemas: Record<keyof Methods, z.ZodType> = {
  state: z.undefined(),
  addProject: z.undefined(),
  runs: z.undefined(),
  listeners: z.undefined(),
  removeProject: projectInput,
  starProject: projectInput,
  selectProject: projectInput,
  worktrees: projectInput,
  selectWorktree: treeInput,
  browseFolders: folderInput,
  addFolder: folderInput,
  removeFolder: projectInput.extend({ folderId: string }),
  tasks: treeInput,
  loadGradle: folderInput,
  starTask: projectInput.extend({ taskId: string }),
  taskPort: projectInput.extend({
    taskId: string,
    port: z.number().int().min(1).max(65535).optional(),
  }),
  addCustom: projectInput.extend({
    task: z.object({
      name: string,
      folder: string,
      command: string,
      args: z
        .array(
          z
            .string()
            .max(8192)
            .refine((v) => !v.includes('\0')),
        )
        .max(100),
    }),
  }),
  removeCustom: projectInput.extend({ taskId: string }),
  openFolder: folderInput.extend({
    app: z.enum(['vscode', 'terminal', 'android-studio', 'finder']),
  }),
  chooseApp: z.object({ app: z.enum(['vscode', 'terminal', 'android-studio']) }),
  start: taskInput,
  stop: z.object({ runId: string }),
  logs: z.object({ runId: string }),
  stopExternal: z.object({
    pid: z.number().int().min(2),
    port: z.number().int().min(1).max(65535),
  }),
  openUrl: z.object({ url: z.url().max(8192) }),
}
async function save() {
  const state = await store.save()
  changed()
  return state
}
async function tree(projectId: string, worktree: string) {
  const project = store.project(projectId)
  return { project, worktree: await validateWorktree(project.root, worktree) }
}
async function scanListeners(): Promise<ListenerReport> {
  try {
    const rows = await listeners()
    const parents = await processParents()
    const owned = await runner.ownedProcesses()
    const trees = await Promise.all(
      store.state.projects.map(async (p) => ({
        project: p,
        trees: await listWorktrees(p.root, false).catch(() => []),
      })),
    )
    const cwdByPid = new Map<number, string | undefined>()
    const pids = [...new Set(rows.map((r) => r.pid))]
    for (let i = 0; i < pids.length; i += 6)
      await Promise.all(
        pids.slice(i, i + 6).map(async (pid) => cwdByPid.set(pid, await processCwd(pid))),
      )
    for (const row of rows) {
      row.cwd = cwdByPid.get(row.pid)
      const run = runner
        .list()
        .find(
          (r) =>
            active(r) &&
            (owned.get(row.pid) === r.id ||
              (!isWindows && r.pid && isDescendant(row.pid, r.pid, parents))),
        )
      if (run) {
        row.cwd ||= run.folder
        row.runId = run.id
        row.projectId = run.projectId
        row.worktree = run.worktree
        row.worktreeName = run.worktreeName
      } else if (row.cwd) {
        for (const entry of trees) {
          const match = matchingWorktree(entry.trees, row.cwd)
          if (match) {
            row.projectId = entry.project.id
            row.worktree = match.path
            row.worktreeName = match.name
            break
          }
        }
      }
    }
    return { listeners: rows, checkedAt: Date.now() }
  } catch (error) {
    return { listeners: [], error: message(error), checkedAt: Date.now() }
  }
}
let startQueue: Promise<unknown> = Promise.resolve()
function queueStart(operation: () => Promise<StartResult>) {
  const promise = startQueue.then(operation, operation)
  startQueue = promise.catch(() => {})
  return promise
}
async function start(input: {
  projectId: string
  worktree: string
  taskId: string
}): Promise<StartResult> {
  return queueStart(async () => {
    const context = await tree(input.projectId, input.worktree)
    const task = (await discovery.list(context.project, input.worktree)).tasks.find(
      (t) => t.id === input.taskId,
    )
    if (!task?.available)
      throw new Error(
        'This task is unavailable in the selected worktree. Reload its source or choose another task.',
      )
    const live = runner.list().filter(active)
    const duplicate = live.find(
      (r) =>
        r.projectId === input.projectId &&
        r.worktree === input.worktree &&
        r.taskId === input.taskId,
    )
    if (duplicate)
      return {
        kind: 'conflict',
        message: 'This task is already running in this worktree.',
        runId: duplicate.id,
      }
    if (task.port) {
      const owned = live.find((r) => r.port === task.port)
      if (owned)
        return {
          kind: 'conflict',
          message: `Port ${task.port} is reserved by ${owned.name} in ${owned.worktreeName}.`,
          runId: owned.id,
        }
      const occupied = (await listeners()).find((l) => l.port === task.port)
      if (occupied)
        return {
          kind: 'conflict',
          message: `Port ${task.port} is in use by ${occupied.command} (PID ${occupied.pid}). Check Listening ports before starting.`,
        }
    }
    const cwd = await resolveFolder(input.worktree, task.folder)
    return { kind: 'started', run: runner.start(context.project, context.worktree, task, cwd) }
  })
}
const handlers: {
  [K in keyof Methods]: (input: Methods[K]['input']) => Promise<Methods[K]['output']>
} = {
  state: async () => structuredClone(store.state),
  addProject: async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add a Git project',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return store.state
    const repo = await identifyProject(result.filePaths[0])
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
    project.lastWorktree =
      matchingWorktree(repo.worktrees, await realpath(result.filePaths[0]))?.path || repo.root
    store.state.selectedProject = project.id
    return save()
  },
  removeProject: async ({ projectId }) => {
    if (runner.list().some((r) => r.projectId === projectId && active(r)))
      throw new Error('Stop this project’s tasks before removing it from Darsena.')
    store.state.projects = store.state.projects.filter((p) => p.id !== projectId)
    if (store.state.selectedProject === projectId)
      store.state.selectedProject = store.state.projects[0]?.id
    return save()
  },
  starProject: async ({ projectId }) => {
    const p = store.project(projectId)
    p.starred = !p.starred
    return save()
  },
  selectProject: async ({ projectId }) => {
    store.project(projectId)
    store.state.selectedProject = projectId
    return save()
  },
  worktrees: async ({ projectId }) => listWorktrees(store.project(projectId).root),
  selectWorktree: async ({ projectId, worktree }) => {
    const t = await tree(projectId, worktree)
    t.project.lastWorktree = worktree
    return save()
  },
  browseFolders: async ({ projectId, worktree, folder }) => {
    await tree(projectId, worktree)
    return browseFolders(worktree, folder)
  },
  addFolder: async ({ projectId, worktree, folder }) => {
    const { project } = await tree(projectId, worktree)
    const shortcut = await folderShortcut(worktree, folder)
    if (!project.folders.some((f) => f.path === shortcut.path))
      project.folders.push({ id: randomUUID(), ...shortcut })
    return save()
  },
  removeFolder: async ({ projectId, folderId }) => {
    const p = store.project(projectId)
    p.folders = p.folders.filter((f) => f.id !== folderId || f.id === 'root')
    return save()
  },
  tasks: async ({ projectId, worktree }) => {
    const t = await tree(projectId, worktree)
    return discovery.list(t.project, worktree)
  },
  loadGradle: async ({ projectId, worktree, folder }) => {
    const t = await tree(projectId, worktree)
    if (!t.project.folders.some((f) => f.path === folder))
      throw new Error('Add this folder to the project first.')
    await discovery.loadGradle(worktree, folder)
    return discovery.list(t.project, worktree)
  },
  starTask: async ({ projectId, taskId }) => {
    const p = store.project(projectId)
    p.favorites = p.favorites.includes(taskId)
      ? p.favorites.filter((id) => id !== taskId)
      : [...p.favorites, taskId]
    return save()
  },
  taskPort: async ({ projectId, taskId, port }) => {
    store.project(projectId).taskPreferences[taskId] = { port }
    return save()
  },
  addCustom: async ({ projectId, task }) => {
    if (path.isAbsolute(task.folder)) throw new Error('Use a folder path relative to the worktree.')
    const p = store.project(projectId)
    const id = randomUUID()
    p.customTasks.push({ ...task, id })
    p.favorites.push(id)
    return save()
  },
  removeCustom: async ({ projectId, taskId }) => {
    const p = store.project(projectId)
    p.customTasks = p.customTasks.filter((t) => t.id !== taskId)
    p.favorites = p.favorites.filter((id) => id !== taskId)
    return save()
  },
  openFolder: async ({ projectId, worktree, folder, app: targetApp }) => {
    const { project } = await tree(projectId, worktree)
    if (!project.folders.some((f) => f.path === folder)) throw new Error('Unknown folder shortcut.')
    const target = await resolveFolder(worktree, folder)
    if (targetApp === 'finder') {
      shell.showItemInFolder(target)
      return
    }
    await openApplication(targetApp, target, store.state.apps[targetApp])
  },
  chooseApp: async ({ app: targetApp }) => {
    const result = await dialog.showOpenDialog({
      title: 'Choose application',
      defaultPath: isWindows ? process.env.ProgramFiles : '/Applications',
      properties: ['openFile'],
      filters: [{ name: 'Applications', extensions: [isWindows ? 'exe' : 'app'] }],
    })
    if (result.filePaths[0]) {
      store.state.apps[targetApp] = result.filePaths[0]
      return save()
    }
    return store.state
  },
  start,
  stop: async ({ runId }) => {
    await runner.stop(runId)
  },
  runs: async () => runner.list(),
  logs: async ({ runId }) => runner.logs(runId),
  listeners: scanListeners,
  stopExternal: async ({ pid, port }) => {
    const report = await scanListeners()
    if (report.error) throw new Error(report.error)
    const found = report.listeners.find((l) => l.pid === pid && l.port === port)
    if (!found) throw new Error('This listener is no longer present. Refresh Listening ports.')
    if (found.runId) {
      await runner.stop(found.runId)
      return
    }
    if (pid === process.pid || pid === process.ppid)
      throw new Error('This process cannot be stopped here.')
    const startedAt = isWindows
      ? await windowsStartTime(pid)
      : (await command('/bin/ps', ['-p', String(pid), '-o', 'lstart='])).trim()
    if (!startedAt) throw new Error('This process is no longer present.')
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Stop an external process?',
      message: `Stop ${found.command} (PID ${pid}) on port ${port}?`,
      detail: `Started outside Darsena. ${isWindows ? 'This forcefully terminates this process only.' : 'This sends SIGTERM to this process only.'}\n${found.cwd || 'Working folder unavailable'}`,
      buttons: ['Cancel', 'Stop process'],
      defaultId: 0,
      cancelId: 0,
    })
    if (result.response !== 1) return
    const fresh = (await listeners()).find(
      (l) => l.pid === pid && l.port === port && l.command === found.command,
    )
    const cwd = await processCwd(pid)
    const currentStart = isWindows
      ? await windowsStartTime(pid)
      : (await command('/bin/ps', ['-p', String(pid), '-o', 'lstart='])).trim()
    if (!fresh || cwd !== found.cwd || currentStart !== startedAt)
      throw new Error('The process changed while the dialog was open. Refresh and try again.')
    if (isWindows) await stopWindowsProcess(pid, startedAt)
    else process.kill(pid, 'SIGTERM')
  },
  openUrl: async ({ url }) => {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol))
      throw new Error('Only HTTP and HTTPS links can be opened.')
    await shell.openExternal(url)
  },
}
function createWindow() {
  if (window && !window.isDestroyed()) {
    window.show()
    window.focus()
    return
  }
  window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    title: 'Darsena',
    titleBarStyle: isWindows ? 'default' : 'hiddenInset',
    icon: path.join(assets, 'brand/icon.png'),
    backgroundColor: '#f8f7f4',
    webPreferences: {
      preload: path.join(base, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!(url.startsWith('darsena://app/') || (devUrl && new URL(url).origin === devUrl)))
      event.preventDefault()
  })
  window.on('close', (event) => {
    if (!quitReady) {
      event.preventDefault()
      window?.hide()
    }
  })
  void window.loadURL(devUrl || 'darsena://app/')
}
app.on('second-instance', () => {
  if (initialized) createWindow()
})
app.on('activate', () => {
  if (initialized) createWindow()
})
app.on('before-quit', (event) => {
  if (quitReady) return
  event.preventDefault()
  if (quitting) return
  quitting = true
  void runner
    .shutdown()
    .then(() => {
      quitReady = true
      app.quit()
    })
    .catch(async (error) => {
      quitting = false
      createWindow()
      await dialog.showMessageBox({ type: 'error', message: message(error) })
    })
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => app.quit())

if (gotLock)
  void app
    .whenReady()
    .then(async () => {
      await store.load()
      await importShellEnvironment()
      protocol.handle('darsena', async (request) => {
        const url = new URL(request.url)
        if (url.hostname !== 'app') return new Response('Not found', { status: 404 })
        const target = path.resolve(
          assets,
          `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
        )
        if (!inside(assets, target)) return new Response('Forbidden', { status: 403 })
        const response = await net.fetch(pathToFileURL(target).toString())
        const headers = new Headers(response.headers)
        headers.set(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'",
        )
        return new Response(response.body, { status: response.status, headers })
      })
      ipcMain.handle('darsena:call', async (event, method: string, input: unknown) => {
        try {
          const origin = event.senderFrame?.url || ''
          if (
            event.sender !== window?.webContents ||
            !(origin.startsWith('darsena://app/') || (devUrl && new URL(origin).origin === devUrl))
          )
            throw new Error('Untrusted sender.')
          if (!Object.hasOwn(schemas, method)) throw new Error('Unknown operation.')
          const name = method as keyof Methods
          const parsed = schemas[name].parse(input)
          const handler = handlers[name] as (input: unknown) => Promise<unknown>
          return { ok: true, value: await handler(parsed) }
        } catch (error) {
          return { ok: false, error: message(error) }
        }
      })
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: 'Darsena',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { label: 'Show Darsena', click: createWindow },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' },
        ]),
      )
      const icon = nativeImage.createFromPath(path.join(assets, 'brand/icon.png'))
      if (!icon.isEmpty()) app.dock?.setIcon(icon)
      if (isWindows) {
        app.setAppUserModelId('app.darsena.desktop')
        tray = new Tray(icon.resize({ width: 32, height: 32 }))
        tray.setToolTip('Darsena — worktrees and tasks')
        tray.setContextMenu(
          Menu.buildFromTemplate([
            { label: 'Open Darsena', click: createWindow },
            { type: 'separator' },
            { label: 'Quit Darsena', click: () => app.quit() },
          ]),
        )
        tray.on('click', createWindow)
      }
      initialized = true
      createWindow()
    })
    .catch(async (error) => {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Darsena could not start',
        message: message(error),
      })
      quitReady = true
      app.quit()
    })
