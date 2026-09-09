import type {
  AppId,
  AppState,
  CustomTask,
  Folder,
  FolderListing,
  ListenerReport,
  Methods,
  Project,
  Run,
  StartResult,
  Task,
  TaskCatalog,
  Worktree,
} from '../../shared/types'

interface FolderPicker {
  projectId: string
  worktree: string
  worktreeName: string
  folders: Folder[]
  listing?: FolderListing
  loading: boolean
  saving: boolean
  error: string
}

export function useWorkspace() {
  const state = shallowRef<AppState>({ version: 1, projects: [], apps: {} })
  const worktrees = shallowRef<Worktree[]>([])
  const selectedPath = shallowRef('')
  const catalog = shallowRef<TaskCatalog>({ tasks: [], sources: [], errors: [] })
  const runs = shallowRef<Run[]>([])
  const selectedRun = shallowRef(''),
    logs = shallowRef('')
  const report = shallowRef<ListenerReport>({ listeners: [], checkedAt: 0 })
  const ready = shallowRef(false),
    bridge = shallowRef(true),
    loading = shallowRef(false)
  const actionCount = shallowRef(0),
    gradleBusy = shallowRef(false),
    scanning = shallowRef(false)
  const error = shallowRef(''),
    contextError = shallowRef(''),
    toast = shallowRef('')
  const activity = shallowRef(false),
    settings = shallowRef(false),
    customDialog = shallowRef(false)
  const portTask = shallowRef<Task>()
  const folderPicker = shallowRef<FolderPicker>()
  const removalProject = shallowRef<Project>()
  const removalBusy = shallowRef(false)
  const removalError = shallowRef('')
  const removalRuns = computed(() =>
    activeRuns.value.filter((run) => run.projectId === removalProject.value?.id),
  )
  let folderRevision = 0
  const conflict = shallowRef<{
    result: Extract<StartResult, { kind: 'conflict' }>
    input: Methods['start']['input']
  }>()
  const project = computed(
    () =>
      state.value.projects.find((p) => p.id === state.value.selectedProject) ||
      state.value.projects[0],
  )
  const worktree = computed(() => worktrees.value.find((t) => t.path === selectedPath.value))
  const activeRuns = computed(() =>
    runs.value.filter((r) => ['starting', 'running', 'stopping'].includes(r.status)),
  )
  const busy = computed(() => actionCount.value > 0)
  let contextRevision = 0,
    fetchingRuns = false,
    refreshingContext = false
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let cleanup: (() => void) | undefined
  let poll: ReturnType<typeof setInterval> | undefined

  function call<K extends keyof Methods>(
    method: K,
    input?: Methods[K]['input'],
  ): Promise<Methods[K]['output']> {
    if (!window.darsena)
      return Promise.reject(new Error('Open Darsena as a desktop app to access your projects.'))
    return window.darsena.call(method, input)
  }
  async function action<T>(operation: () => Promise<T>): Promise<T | undefined> {
    actionCount.value++
    try {
      return await operation()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      actionCount.value--
    }
  }
  function context() {
    if (!project.value || !selectedPath.value)
      throw new Error('Select a project and worktree first.')
    return { projectId: project.value.id, worktree: selectedPath.value }
  }
  async function refreshContext(force = false) {
    if (refreshingContext && !force) return
    const p = project.value
    const revision = ++contextRevision
    if (!p) {
      worktrees.value = []
      selectedPath.value = ''
      catalog.value = { tasks: [], sources: [], errors: [] }
      loading.value = false
      refreshingContext = false
      return
    }
    loading.value = true
    refreshingContext = true
    contextError.value = ''
    try {
      const trees = await call('worktrees', { projectId: p.id })
      if (revision !== contextRevision || project.value?.id !== p.id) return
      worktrees.value = trees
      const selected =
        trees.find(
          (t) => t.path === (p.lastWorktree || selectedPath.value) && t.exists && !t.bare,
        ) || trees.find((t) => t.exists && !t.bare)
      if (selectedPath.value !== selected?.path)
        catalog.value = { tasks: [], sources: [], errors: [] }
      selectedPath.value = selected?.path || ''
      if (!selected) {
        catalog.value = { tasks: [], sources: [], errors: [] }
        return
      }
      const next = await call('tasks', { projectId: p.id, worktree: selected.path })
      if (revision === contextRevision && selectedPath.value === selected.path) catalog.value = next
    } catch (e) {
      if (revision === contextRevision)
        contextError.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (revision === contextRevision) {
        loading.value = false
        refreshingContext = false
      }
    }
  }
  async function refreshRuns() {
    if (fetchingRuns || !bridge.value) return
    fetchingRuns = true
    try {
      runs.value = await call('runs')
      if (!selectedRun.value && runs.value[0]) selectedRun.value = runs.value[0].id
      if (selectedRun.value) await loadLogs(selectedRun.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      fetchingRuns = false
    }
  }
  async function loadLogs(id: string) {
    const output = await call('logs', { runId: id })
    if (selectedRun.value === id) logs.value = output
  }
  async function update(operation: () => Promise<AppState>, refresh = true) {
    return action(async () => {
      state.value = await operation()
      if (refresh) await refreshContext(true)
      return true
    })
  }
  function selectProject(id: string) {
    activity.value = false
    selectedPath.value = ''
    catalog.value = { tasks: [], sources: [], errors: [] }
    return update(() => call('selectProject', { projectId: id }))
  }
  function selectWorktree(path: string) {
    catalog.value = { tasks: [], sources: [], errors: [] }
    return update(() => call('selectWorktree', { projectId: project.value!.id, worktree: path }))
  }
  async function startInput(input: Methods['start']['input']) {
    const result = await call('start', input)
    if (result.kind === 'conflict') conflict.value = { result, input }
    else {
      conflict.value = undefined
      selectedRun.value = result.run.id
      logs.value = ''
      activity.value = true
      await refreshRuns()
    }
  }
  function startTask(id: string) {
    return action(() => startInput({ ...context(), taskId: id }))
  }
  async function transfer() {
    const pending = conflict.value
    if (!pending?.result.runId) return
    await action(async () => {
      await call('stop', { runId: pending.result.runId! })
      await startInput(pending.input)
    })
  }
  function inspect(id: string) {
    selectedRun.value = id
    logs.value = ''
    activity.value = true
    return action(() => loadLogs(id))
  }
  async function scan() {
    if (scanning.value) return
    scanning.value = true
    try {
      report.value = await call('listeners')
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      scanning.value = false
    }
  }
  function stop(id: string) {
    return action(async () => {
      await call('stop', { runId: id })
      await refreshRuns()
      if (report.value.checkedAt) await scan()
    })
  }
  function stopExternal(pid: number, port: number) {
    return action(async () => {
      await call('stopExternal', { pid, port })
      await scan()
    })
  }
  async function gradle(folder: string) {
    if (gradleBusy.value) return
    const input = { ...context(), folder }
    gradleBusy.value = true
    try {
      const result = await call('loadGradle', input)
      if (project.value?.id === input.projectId && selectedPath.value === input.worktree)
        catalog.value = result
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      gradleBusy.value = false
    }
  }
  async function saveCustom(task: Omit<CustomTask, 'id'>) {
    if (await update(() => call('addCustom', { projectId: project.value!.id, task })))
      customDialog.value = false
  }
  function closeFolderPicker() {
    if (folderPicker.value?.saving) return
    folderRevision++
    folderPicker.value = undefined
  }
  function addFolder() {
    if (!worktree.value || !project.value) return
    folderPicker.value = {
      ...context(),
      worktreeName: worktree.value.name,
      folders: project.value.folders,
      loading: false,
      saving: false,
      error: '',
    }
    void browseFolder('.')
  }
  async function browseFolder(folder: string) {
    const picker = folderPicker.value
    if (!picker || picker.saving) return
    const revision = ++folderRevision
    folderPicker.value = { ...picker, loading: true, error: '' }
    try {
      const listing = await call('browseFolders', {
        projectId: picker.projectId,
        worktree: picker.worktree,
        folder,
      })
      if (revision === folderRevision)
        folderPicker.value = { ...picker, listing, loading: false, error: '' }
    } catch (e) {
      if (revision === folderRevision)
        folderPicker.value = {
          ...picker,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }
    }
  }
  async function saveFolder(folder: string) {
    const picker = folderPicker.value
    if (!picker || picker.loading || picker.saving) return
    folderPicker.value = { ...picker, saving: true, error: '' }
    try {
      state.value = await call('addFolder', {
        projectId: picker.projectId,
        worktree: picker.worktree,
        folder,
      })
      folderPicker.value = undefined
      await refreshContext(true)
    } catch (e) {
      folderPicker.value = {
        ...picker,
        saving: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }
  async function savePort(port?: number) {
    if (!portTask.value || !project.value) return
    const input = { projectId: project.value.id, taskId: portTask.value.id, port }
    if (await update(() => call('taskPort', input))) portTask.value = undefined
  }
  async function copy(text: string) {
    await action(async () => {
      await navigator.clipboard.writeText(text)
      toast.value = 'Path copied'
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => {
        toast.value = ''
      }, 2000)
    })
  }
  function requestRemoval(id: string) {
    if (removalBusy.value) return
    removalProject.value = state.value.projects.find((p) => p.id === id)
    removalError.value = ''
    void refreshRuns()
  }
  function closeRemoval() {
    if (!removalBusy.value) removalProject.value = undefined
  }
  function viewRemovalActivity() {
    const run = removalRuns.value[0]
    closeRemoval()
    if (run) void inspect(run.id)
    else activity.value = true
  }
  async function confirmRemoval() {
    const target = removalProject.value
    if (!target || removalBusy.value || removalRuns.value.length) return
    removalBusy.value = true
    removalError.value = ''
    try {
      const selectedId = project.value?.id
      state.value = await call('removeProject', { projectId: target.id })
      removalProject.value = undefined
      if (selectedId !== project.value?.id) {
        worktrees.value = []
        selectedPath.value = ''
        catalog.value = { tasks: [], sources: [], errors: [] }
        await refreshContext(true)
      }
      toast.value = `${target.name} removed from Darsena`
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => {
        toast.value = ''
      }, 3000)
      await nextTick()
      const nextProject = document.querySelector<HTMLButtonElement>(
        '[data-project-selected="true"]',
      )
      const addButton = document.querySelector<HTMLButtonElement>('[data-project-add]')
      ;(nextProject || addButton)?.focus()
    } catch (e) {
      removalError.value = e instanceof Error ? e.message : String(e)
      await refreshRuns()
    } finally {
      removalBusy.value = false
    }
  }
  function revealProject(projectId: string) {
    const target = state.value.projects.find((p) => p.id === projectId)
    if (target)
      return action(() =>
        call('openFolder', { projectId, worktree: target.root, folder: '.', app: 'finder' }),
      )
  }
  async function locate(run: Run) {
    await selectProject(run.projectId)
    if (worktrees.value.some((t) => t.path === run.worktree && t.exists))
      await selectWorktree(run.worktree)
  }
  function focus() {
    if (ready.value && bridge.value) {
      void refreshContext()
      void refreshRuns()
    }
  }
  function keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      activity.value = false
      void nextTick(() =>
        document.querySelector<HTMLInputElement>('[data-worktree-search]')?.focus(),
      )
    }
  }
  onMounted(async () => {
    bridge.value = !!window.darsena
    if (!bridge.value) {
      ready.value = true
      return
    }
    await action(async () => {
      state.value = await call('state')
      await Promise.all([refreshContext(true), refreshRuns()])
    })
    ready.value = true
    cleanup = window.darsena?.onChange(() => {
      void refreshRuns()
    })
    window.addEventListener('focus', focus)
    window.addEventListener('keydown', keydown)
    poll = setInterval(() => {
      if (document.visibilityState === 'visible') focus()
    }, 10000)
  })
  onUnmounted(() => {
    cleanup?.()
    clearInterval(poll)
    clearTimeout(toastTimer)
    window.removeEventListener('focus', focus)
    window.removeEventListener('keydown', keydown)
  })
  return {
    state,
    worktrees,
    selectedPath,
    catalog,
    runs,
    selectedRun,
    logs,
    report,
    ready,
    bridge,
    loading,
    busy,
    gradleBusy,
    scanning,
    error,
    contextError,
    toast,
    activity,
    settings,
    customDialog,
    removalProject,
    removalBusy,
    removalError,
    removalRuns,
    requestRemoval,
    closeRemoval,
    confirmRemoval,
    viewRemovalActivity,
    revealProject,
    folderPicker,
    browseFolder,
    saveFolder,
    closeFolderPicker,
    portTask,
    conflict,
    project,
    worktree,
    activeRuns,
    refreshContext,
    selectProject,
    selectWorktree,
    startTask,
    transfer,
    inspect,
    scan,
    stop,
    stopExternal,
    gradle,
    saveCustom,
    savePort,
    copy,
    locate,
    addProject: () => {
      activity.value = false
      return update(() => call('addProject'))
    },
    starProject: (projectId: string) => update(() => call('starProject', { projectId }), false),
    addFolder,
    removeFolder: (folderId: string) =>
      update(() => call('removeFolder', { projectId: project.value!.id, folderId })),
    starTask: (taskId: string) =>
      update(() => call('starTask', { projectId: project.value!.id, taskId })),
    removeCustom: (taskId: string) =>
      update(() => call('removeCustom', { projectId: project.value!.id, taskId })),
    openFolder: (folder: string, app: AppId) =>
      action(() => call('openFolder', { ...context(), folder, app })),
    chooseApp: (app: Exclude<AppId, 'finder'>) => update(() => call('chooseApp', { app }), false),
    openUrl: (url: string) => action(() => call('openUrl', { url })),
  }
}
