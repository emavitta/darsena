const { contextBridge, ipcRenderer } = require('electron')
const methods = new Set([
  'checkUpdates',
  'downloadUpdate',
  'installUpdate',
  'updateInstallation',
  'mcpStatus',
  'mcpConfigure',
  'mcpProject',
  'mcpTask',
  'mcpRotateToken',
  'mcpConfiguration',
  'gitState',
  'gitAction',
  'copyText',
  'state',
  'addProject',
  'removeProject',
  'starProject',
  'selectProject',
  'worktrees',
  'selectWorktree',
  'workspaceFolders',
  'addWorkspaceFolders',
  'browseFolders',
  'addFolder',
  'removeFolder',
  'tasks',
  'environment',
  'loadGradle',
  'exportLogcat',
  'startLogcat',
  'androidApps',
  'androidAppAction',
  'androidDevices',
  'androidStart',
  'starTask',
  'taskPort',
  'configurePreparation',
  'addCustom',
  'removeCustom',
  'openFolder',
  'chooseApp',
  'start',
  'stop',
  'runs',
  'logs',
  'listeners',
  'stopExternal',
  'openUrl',
])
contextBridge.exposeInMainWorld('darsena', {
  call: async (method, input) => {
    if (!methods.has(method)) throw new Error('Unsupported operation')
    const result = await ipcRenderer.invoke('darsena:call', method, input)
    if (!result.ok) throw new Error(result.error)
    return result.value
  },
  onChange: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('darsena:changed', listener)
    return () => ipcRenderer.removeListener('darsena:changed', listener)
  },
})
