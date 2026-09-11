export type AppId = 'vscode' | 'terminal' | 'android-studio' | 'finder'
export interface Folder {
  id: string
  path: string
  label: string
}
export interface FolderListing {
  path: string
  folders: { name: string; path: string }[]
}
export interface CustomTask {
  id: string
  name: string
  folder: string
  command: string
  args: string[]
}
export interface TaskPreference {
  port?: number
}
export interface Project {
  id: string
  name: string
  root: string
  commonDir: string
  starred: boolean
  folders: Folder[]
  favorites: string[]
  customTasks: CustomTask[]
  taskPreferences: Record<string, TaskPreference>
  lastWorktree?: string
}
export interface AppState {
  version: 1
  projects: Project[]
  selectedProject?: string
  apps: Partial<Record<Exclude<AppId, 'finder'>, string>>
}
export interface Worktree {
  path: string
  name: string
  branch: string | null
  head: string
  main: boolean
  exists: boolean
  locked?: string
  prunable?: string
  bare: boolean
  changed?: number
  error?: string
}
export interface AndroidDevice { serial: string; state: string; label: string }
export interface Task {
  action?: 'android-launch'
  android?: { assembleTask: string; variant: string; buildDirectory: string }
  id: string
  name: string
  folder: string
  kind: 'script' | 'gradle' | 'custom'
  command: string
  args: string[]
  description?: string
  available: boolean
  manager?: string
  port?: number
}
export interface TaskSource {
  kind: Task['kind']
  folder: string
  label: string
  loaded: boolean
  count: number
}
export interface TaskCatalog {
  tasks: Task[]
  sources: TaskSource[]
  errors: { folder: string; message: string }[]
}
export type RunStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'succeeded' | 'failed'
export interface Run {
  androidOperation?: 'deployment' | 'app-action' | 'logcat'
  androidApplicationId?: string
  androidVariant?: string
  logcat?: { state: 'running' | 'not-running' | 'unknown'; pids: number[]; checkedAt: number; lastCrashAt?: number }
  androidDevice?: string
  id: string
  source: 'ui' | 'mcp'
  projectId: string
  projectName: string
  worktree: string
  worktreeName: string
  /** Git identity captured when this run started. */
  worktreeBranch?: string | null
  worktreeHead?: string
  taskId: string
  name: string
  folder: string
  command: string
  pid?: number
  status: RunStatus
  startedAt: number
  endedAt?: number
  exitCode?: number | null
  signal?: string | null
  port?: number
  urls: string[]
}
export interface Listener {
  pid: number
  command: string
  port: number
  address: string
  cwd?: string
  projectId?: string
  worktree?: string
  worktreeName?: string
  runId?: string
}
export interface ListenerReport {
  listeners: Listener[]
  error?: string
  checkedAt: number
}
export type StartResult =
  { kind: 'started'; run: Run } | { kind: 'conflict'; message: string; runId?: string }
export type GitAction = 'fetch' | 'pull'
export interface GitState {
  branch: string | null
  head: string
  upstream?: string
  ahead?: number
  behind?: number
  dirty: boolean
  operation?: string
  branches: { ref: string; name: string; local: boolean; upstream?: string; remote: string; remoteRef: string; worktrees: string[] }[]
  remotes: string[]
  checkedAt: number
}
export interface Methods {
  exportLogcat: { input: { runId: string }; output: boolean }
  startLogcat: { input: { runId: string }; output: Run }
  androidApps: { input: { projectId: string; worktree: string; folder: string; serial: string }; output: { user: string; packages: string[] } }
  androidAppAction: { input: { projectId: string; worktree: string; folder: string; serial: string; applicationId: string; user: string; operation: 'start' | 'stop' | 'restart' | 'clear' | 'uninstall'; confirmed: boolean }; output: Run }

  gitState: { input: { projectId: string; worktree: string }; output: GitState }
  gitAction: { input: { projectId: string; worktree: string; action: GitAction; expectedHead: string; expectedBranch: string | null }; output: { state: GitState; message: string } }

  copyText: { input: { text: string }; output: void }
  mcpStatus: { input: undefined; output: McpStatus }
  mcpConfigure: { input: { enabled: boolean; port: number }; output: McpStatus }
  mcpProject: { input: { projectId: string; allowed: boolean }; output: McpStatus }
  mcpTask: {
    input: { projectId: string; worktree: string; taskId: string; allowed: boolean }
    output: McpStatus
  }
  mcpRotateToken: { input: undefined; output: McpStatus }
  mcpConfiguration: { input: undefined; output: string }
  state: { input: undefined; output: AppState }
  addProject: { input: undefined; output: AppState }
  removeProject: { input: { projectId: string }; output: AppState }
  starProject: { input: { projectId: string }; output: AppState }
  selectProject: { input: { projectId: string }; output: AppState }
  worktrees: { input: { projectId: string }; output: Worktree[] }
  selectWorktree: { input: { projectId: string; worktree: string }; output: AppState }
  browseFolders: {
    input: { projectId: string; worktree: string; folder: string }
    output: FolderListing
  }
  addFolder: { input: { projectId: string; worktree: string; folder: string }; output: AppState }
  removeFolder: { input: { projectId: string; folderId: string }; output: AppState }
  tasks: { input: { projectId: string; worktree: string }; output: TaskCatalog }
  androidDevices: { input: { projectId: string; worktree: string; folder: string }; output: AndroidDevice[] }
  androidStart: { input: { projectId: string; worktree: string; taskId: string; serial: string }; output: Run }
  loadGradle: {
    input: { projectId: string; worktree: string; folder: string }
    output: TaskCatalog
  }
  starTask: { input: { projectId: string; taskId: string }; output: AppState }
  taskPort: { input: { projectId: string; taskId: string; port?: number }; output: AppState }
  addCustom: { input: { projectId: string; task: Omit<CustomTask, 'id'> }; output: AppState }
  removeCustom: { input: { projectId: string; taskId: string }; output: AppState }
  openFolder: {
    input: { projectId: string; worktree: string; folder: string; app: AppId }
    output: void
  }
  chooseApp: { input: { app: Exclude<AppId, 'finder'> }; output: AppState }
  start: { input: { projectId: string; worktree: string; taskId: string }; output: StartResult }
  stop: { input: { runId: string }; output: void }
  runs: { input: undefined; output: Run[] }
  logs: { input: { runId: string }; output: string }
  listeners: { input: undefined; output: ListenerReport }
  stopExternal: { input: { pid: number; port: number }; output: void }
  openUrl: { input: { url: string }; output: void }
}
export interface DesktopApi {
  call<K extends keyof Methods>(
    method: K,
    input?: Methods[K]['input'],
  ): Promise<Methods[K]['output']>
  onChange(callback: () => void): () => void
}

export interface McpStatus {
  enabled: boolean
  port: number
  projects: Record<string, { tasks: string[] }>
  listening: boolean
  url?: string
  error?: string
}
