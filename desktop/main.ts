import { createMacInstaller } from './mac-updater.js'
import { environmentChecks } from './diagnostics.js'
import { createUpdateChecker } from './updates.js'
import { configurePreparation, preparationSchema } from './preparation.js'
import { discoverWorkspaceFolders } from './workspace-folders.js'
import {
  app,
  clipboard,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  session,
  shell,
} from 'electron'
import { realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Store } from './store.js'
import { identifyProject, listWorktrees, matchingWorktree } from './git.js'
import { command, importShellEnvironment, inside, message, resolveFolder } from './io.js'
import { WorkspaceService } from './workspace.js'
import { McpController, mcpConnectionSchema, mcpProjectSchema, mcpTaskSchema } from './mcp.js'
import { browseFolders, folderShortcut } from './folders.js'
import { active } from './runner.js'
import { installedApps, adbOperations } from './adb-actions.js'
import { androidDevices, findAdb } from './android.js'
import { listeners, processCwd } from './processes.js'
import type { Methods } from '../shared/types.js'

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
const assets = path.resolve(base, '../.output/public')
const devUrl =
  !app.isPackaged && process.env.DARSENA_DEV_URL === 'http://127.0.0.1:3141'
    ? process.env.DARSENA_DEV_URL
    : undefined
const store = new Store(app.getPath('userData'))
const workspace = new WorkspaceService(store)
const { discovery, runner } = workspace
const mcp = new McpController(workspace, app.getVersion(), changed)
const tree = workspace.tree.bind(workspace)
const scanListeners = workspace.scanListeners.bind(workspace)
const start = workspace.start.bind(workspace)
let window: BrowserWindow | undefined
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
const checkUpdates = createUpdateChecker(app.getVersion(), process.arch, process.platform)
const installer = createMacInstaller(() => checkUpdates(true), () => {
  if (quitting && !quitReady) { quitting = false; void mcp.resumeAfterFailedQuit() }
})
const schemas: Record<keyof Methods, z.ZodType> = {
  environment: treeInput,
  gitState: treeInput,
  gitAction: treeInput.extend({ action: z.enum(['fetch', 'pull']), expectedHead: z.string().max(64), expectedBranch: string.nullable() }),
  copyText: z.object({ text: z.string().max(32768) }),
  downloadUpdate: z.undefined(),
  installUpdate: z.undefined(),
  updateInstallation: z.undefined(),
  checkUpdates: z.object({ force: z.boolean() }),
  mcpStatus: z.undefined(),
  mcpConfigure: mcpConnectionSchema,
  mcpProject: mcpProjectSchema,
  mcpTask: mcpTaskSchema,
  mcpRotateToken: z.undefined(),
  mcpConfiguration: z.undefined(),
  state: z.undefined(),
  addProject: z.undefined(),
  runs: z.undefined(),
  listeners: z.undefined(),
  removeProject: projectInput,
  starProject: projectInput,
  selectProject: projectInput,
  worktrees: projectInput,
  selectWorktree: treeInput,
  workspaceFolders: z.object({ projectId: string, worktree: string }),
  addWorkspaceFolders: z.object({ projectId: string, worktree: string, folders: z.array(string).min(1).max(500) }),
  browseFolders: folderInput,
  addFolder: folderInput,
  removeFolder: projectInput.extend({ folderId: string }),
  tasks: treeInput,
  loadGradle: folderInput,
  exportLogcat: z.object({ runId: string }),
  startLogcat: z.object({ runId: string }),
  androidApps: folderInput.extend({ serial: string }),
  androidAppAction: folderInput.extend({ serial: string, applicationId: z.string().regex(/^[A-Za-z]\w*(\.[A-Za-z]\w*)+$/), user: z.string().regex(/^\d+$/), operation: z.enum(adbOperations), confirmed: z.boolean() }),
  androidDevices: folderInput,
  androidStart: taskInput.extend({ serial: string }),
  starTask: projectInput.extend({ taskId: string }),
  taskPort: projectInput.extend({
    taskId: string,
    port: z.number().int().min(1).max(65535).optional(),
  }),
  configurePreparation: preparationSchema,
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
const handlers: {
  [K in keyof Methods]: (input: Methods[K]['input']) => Promise<Methods[K]['output']>
} = {
  gitState: ({ projectId, worktree }) => workspace.gitState(projectId, worktree),
  gitAction: async (input) => { try { return await workspace.gitAction(input) } finally { changed() } },
  copyText: async ({ text }) => { clipboard.writeText(text) },
  updateInstallation: async () => ({ ...installer.status }),
  downloadUpdate: async () => { void installer.download(); return { ...installer.status } },
  installUpdate: async () => {
    if (runner.list().some(active)) throw new Error('Stop running tasks before installing the update.')
    if (installer.status.phase !== 'ready') throw new Error('Download the update first.')
    quitting = true
    try {
      await mcp.shutdown()
      if (runner.list().some(active)) throw new Error('A task started. Stop it before installing.')
      installer.install(0)
    } catch (error) {
      quitting = false
      await mcp.resumeAfterFailedQuit()
      throw error
    }
  },
  checkUpdates: ({ force }) => checkUpdates(force),
  mcpStatus: async () => mcp.status(),
  mcpConfigure: (input) => mcp.configure(input),
  mcpProject: ({ projectId, allowed }) => mcp.allowProject(projectId, allowed),
  mcpTask: (input) => mcp.allowTask(input),
  mcpRotateToken: () => mcp.rotateToken(),
  mcpConfiguration: async () => mcp.configuration(),
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
  workspaceFolders: async ({ projectId, worktree }) => {
    await tree(projectId, worktree)
    return discoverWorkspaceFolders(worktree)
  },
  addWorkspaceFolders: async ({ projectId, worktree, folders }) => {
    await tree(projectId, worktree)
    const detected = await discoverWorkspaceFolders(worktree)
    if (folders.some(folder => !detected.folders.some(f => f.path === folder))) throw new Error('Workspace changed. Refresh its folders before adding them.')
    const shortcuts = await Promise.all([...new Set(folders)].map(folder => folderShortcut(worktree, folder)))
    const project = store.project(projectId)
    for (const shortcut of shortcuts) if (!project.folders.some(f => f.path === shortcut.path)) project.folders.push({ id: randomUUID(), ...shortcut })
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
  environment: async ({ projectId, worktree }) => {
    const t = await tree(projectId, worktree)
    return environmentChecks(t.worktree.path, await discovery.list(t.project, t.worktree.path))
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
  exportLogcat: async ({ runId }) => {
    const run = runner.list().find(r => r.id === runId && r.androidOperation === 'logcat')
    if (!run) throw new Error('Logcat session not found.')
    const output = runner.logs(runId)
    const result = await dialog.showSaveDialog({ defaultPath: `Logcat-${run.androidApplicationId}-${Date.now()}.txt`, filters: [{ name: 'Text', extensions: ['txt'] }] })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, output, 'utf8')
    return true
  },
  startLogcat: async ({ runId }) => workspace.startLogcat(runId),
  androidApps: async input => {
    const { project } = await tree(input.projectId, input.worktree)
    if (!project.folders.some(f => f.path === input.folder)) throw new Error('Unknown folder shortcut.')
    const cwd = await resolveFolder(input.worktree, input.folder)
    if (!(await androidDevices(cwd)).some(d => d.serial === input.serial && d.state === 'device')) throw new Error('Device is unavailable or unauthorized.')
    return installedApps(await findAdb(cwd), cwd, input.serial, (file, args, cwd) => command(file, args, cwd))
  },
  androidAppAction: async input => {
    if (['clear', 'uninstall'].includes(input.operation) && !input.confirmed) throw new Error('Confirm this destructive action first.')
    const { project, worktree: selectedTree } = await tree(input.projectId, input.worktree)
    const apps = await handlers.androidApps(input)
    if (apps.user !== input.user || !apps.packages.includes(input.applicationId)) throw new Error('App or Android user changed. Refresh apps.')
    const cwd = await resolveFolder(input.worktree, input.folder)
    const adb = await findAdb(cwd)
    if (runner.list().some(r => active(r) && r.androidOperation !== 'logcat' && r.androidDevice === input.serial)) throw new Error('An Android operation is already running on this device.')
    const plan = { ...input, cwd, adb }
    return runner.start(project, selectedTree, { id: JSON.stringify(['adb', input.folder, input.operation, input.applicationId]), name: `ADB · ${input.operation} · ${input.applicationId} → ${input.serial}`, folder: input.folder, kind: 'custom', available: true, command: process.execPath, args: [path.join(base, 'adb-entry.js'), JSON.stringify(plan)] }, cwd, 'ui', { androidDevice: input.serial, env: { ELECTRON_RUN_AS_NODE: '1' }, androidOperation: 'app-action', androidApplicationId: input.applicationId, displayCommand: `ADB ${input.operation} ${input.applicationId} · device ${input.serial} · user ${input.user}` })
  },
  androidDevices: async ({ projectId, worktree, folder }) => {
    const { project } = await tree(projectId, worktree)
    if (!project.folders.some(f => f.path === folder)) throw new Error('Unknown folder shortcut.')
    return androidDevices(await resolveFolder(worktree, folder))
  },
  androidStart: async input => {
    const { project, worktree: selectedTree } = await tree(input.projectId, input.worktree)
    const task = (await discovery.list(project, input.worktree)).tasks.find(t => t.id === input.taskId)
    if (!task?.available || !task.android) throw new Error('Load Gradle tasks and select an Android install variant first.')
    const cwd = await resolveFolder(input.worktree, task.folder)
    const devices = await androidDevices(cwd)
    if (!devices.some(d => d.serial === input.serial && d.state === 'device')) throw new Error('The selected Android device is no longer available or authorized.')
    const androidTaskId = JSON.stringify(['gradle', task.folder, 'darsena:android-launch'])
    if (runner.list().some(r => active(r) && r.androidOperation !== 'logcat' && r.androidDevice === input.serial)) throw new Error('A deployment to this device is already running.')
    const plan = { cwd, worktree: input.worktree, ...task.android, adb: await findAdb(cwd), serial: input.serial }
    if (runner.list().some(r => active(r) && r.androidOperation !== 'logcat' && r.androidDevice === input.serial)) throw new Error('A deployment to this device is already running.')
    project.androidLaunches = { ...project.androidLaunches, [task.folder]: { taskId: input.taskId, serial: input.serial } }
    await save()
    if (runner.list().some(r => active(r) && r.androidOperation !== 'logcat' && r.androidDevice === input.serial)) throw new Error('A deployment to this device is already running.')
    return runner.start(project, selectedTree, { ...task, id: androidTaskId, name: 'Android · ' + task.android.variant + ' → ' + input.serial, command: process.execPath, args: [path.join(base, 'android-entry.js'), JSON.stringify(plan)] }, cwd, 'ui', { androidDevice: input.serial, env: { ELECTRON_RUN_AS_NODE: '1' }, reports: true, androidVariant: task.android.variant, displayCommand: task.android.assembleTask + ' → install → launch on ' + input.serial })
  },
  starTask: async ({ projectId, taskId }) => {
    const p = store.project(projectId)
    if (p.favorites.includes(taskId)) await mcp.removeFavoriteGrant(projectId, taskId)
    p.favorites = p.favorites.includes(taskId)
      ? p.favorites.filter((id) => id !== taskId)
      : [...p.favorites, taskId]
    return save()
  },
  taskPort: async ({ projectId, taskId, port }) => {
    store.project(projectId).taskPreferences[taskId] = { port }
    return save()
  },
  configurePreparation: async ({ projectId, command, args }) => {
    configurePreparation(store.project(projectId), command, args, runner.list())
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
    if (p.preparationTaskId === taskId) p.preparationTaskId = undefined
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
    const defaults = {
      vscode: 'Visual Studio Code',
      terminal: 'Terminal',
      'android-studio': 'Android Studio',
    }
    await command('/usr/bin/open', [
      '-a',
      store.state.apps[targetApp] || defaults[targetApp],
      target,
    ])
  },
  chooseApp: async ({ app: targetApp }) => {
    const result = await dialog.showOpenDialog({
      title: 'Choose application',
      defaultPath: '/Applications',
      properties: ['openFile'],
      filters: [{ name: 'Applications', extensions: ['app'] }],
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
    const startedAt = (await command('/bin/ps', ['-p', String(pid), '-o', 'lstart='])).trim()
    if (!startedAt) throw new Error('This process is no longer present.')
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Stop an external process?',
      message: `Stop ${found.command} (PID ${pid}) on port ${port}?`,
      detail: `Started outside Darsena. This sends SIGTERM to this process only.\n${found.cwd || 'Working folder unavailable'}`,
      buttons: ['Cancel', 'Stop process'],
      defaultId: 0,
      cancelId: 0,
    })
    if (result.response !== 1) return
    const fresh = (await listeners()).find(
      (l) => l.pid === pid && l.port === port && l.command === found.command,
    )
    const cwd = await processCwd(pid)
    const currentStart = (await command('/bin/ps', ['-p', String(pid), '-o', 'lstart='])).trim()
    if (!fresh || cwd !== found.cwd || currentStart !== startedAt)
      throw new Error('The process changed while the dialog was open. Refresh and try again.')
    process.kill(pid, 'SIGTERM')
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
    titleBarStyle: 'hiddenInset',
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
  if (quitting && installer.status.phase !== 'installing') return
  quitting = true
  void Promise.all([mcp.shutdown(), runner.shutdown()])
    .then(() => {
      quitReady = true
      app.quit()
    })
    .catch(async (error) => {
      quitting = false
      await mcp.resumeAfterFailedQuit()
      createWindow()
      await dialog.showMessageBox({ type: 'error', message: message(error) })
    })
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => app.quit())

if (gotLock)
  void app
    .whenReady()
    .then(async () => {
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
      session.defaultSession.setPermissionCheckHandler(() => false)
      await store.load()
      await importShellEnvironment()
      await mcp.initialize()
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
          if (quitting && !['updateInstallation', 'runs'].includes(method)) throw new Error('Darsena is preparing to quit.')
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
