import type { GitAction, GitState } from '../../shared/types'

export function useWorktreeGit(context: () => { projectId: string; worktree: string; revision: string }) {
  const state = shallowRef<GitState>()
  const loading = shallowRef(false)
  const busy = shallowRef<GitAction>()
  const error = shallowRef('')
  const notice = shallowRef('')
  let revision = 0
  async function refresh() {
    const ticket = ++revision
    const input = context()
    loading.value = true
    error.value = ''
    try {
      if (!window.darsena) throw new Error('Git actions are available in the desktop app.')
      const result = await window.darsena.call('gitState', { projectId: input.projectId, worktree: input.worktree })
      if (ticket === revision) state.value = result
    } catch (cause) {
      if (ticket === revision) { state.value = undefined; error.value = String(cause instanceof Error ? cause.message : cause) }
    } finally { if (ticket === revision) loading.value = false }
  }
  async function run(action: GitAction) {
    if (!state.value || busy.value || loading.value) return
    const input = context()
    const snapshot = state.value
    const ticket = ++revision
    busy.value = action
    error.value = ''
    notice.value = ''
    try {
      if (!window.darsena) throw new Error('Git actions are available in the desktop app.')
      const result = await window.darsena.call('gitAction', {
        projectId: input.projectId, worktree: input.worktree, action,
        expectedHead: snapshot.head, expectedBranch: snapshot.branch,
      })
      if (ticket === revision) { state.value = result.state; notice.value = result.message }
    } catch (cause) {
      if (ticket === revision) {
        error.value = String(cause instanceof Error ? cause.message : cause)
        try {
          const latest = await window.darsena?.call('gitState', { projectId: input.projectId, worktree: input.worktree })
          if (ticket === revision) state.value = latest
        } catch { /* Keep the action error visible if the checkout is unavailable. */ }
      }
    } finally { if (ticket === revision) busy.value = undefined }
  }
  watch(() => JSON.stringify(context()), () => {
    state.value = undefined
    busy.value = undefined
    notice.value = ''
    void refresh()
  }, { immediate: true })
  onBeforeUnmount(() => { revision++ })
  return { state, loading, busy, error, notice, refresh, run }
}
