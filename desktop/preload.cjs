const { contextBridge, ipcRenderer } = require('electron')
const methods = new Set([
  'mcpStatus',
  'mcpConfigure',
  'mcpProject',
  'mcpTask',
  'mcpRotateToken',
  'mcpConfiguration',
  'state',
  'addProject',
  'removeProject',
  'starProject',
  'selectProject',
  'worktrees',
  'selectWorktree',
  'browseFolders',
  'addFolder',
  'removeFolder',
  'tasks',
  'loadGradle',
  'starTask',
  'taskPort',
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
