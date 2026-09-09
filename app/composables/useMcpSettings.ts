import type { McpStatus, Methods } from '../../shared/types'

export function useMcpSettings() {
  const status = shallowRef<McpStatus>()
  const busy = shallowRef(false)
  const error = shallowRef('')
  const notice = shallowRef('')
  async function perform<
    K extends 'mcpStatus' | 'mcpConfigure' | 'mcpProject' | 'mcpTask' | 'mcpRotateToken',
  >(method: K, input?: Methods[K]['input']) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      if (!window.darsena) throw new Error('Open the desktop app to configure MCP.')
      status.value = await window.darsena.call(method, input)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      busy.value = false
    }
  }
  async function copyConfiguration() {
    error.value = ''
    notice.value = ''
    try {
      const configuration = await window.darsena!.call('mcpConfiguration')
      await navigator.clipboard.writeText(configuration)
      notice.value = 'Configuration copied, including your private connection token.'
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }
  async function rotateToken() {
    await perform('mcpRotateToken')
    if (!error.value)
      notice.value = 'Token replaced. Copy the new configuration into your MCP clients.'
  }
  onMounted(() => {
    void perform('mcpStatus')
  })
  return { status, busy, error, notice, perform, copyConfiguration, rotateToken }
}
