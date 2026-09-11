import type { AndroidDevice, TaskCatalog } from '../../shared/types'
export function useAndroidLaunch(
  context: { projectId: string; worktree: string },
  started: (id: string) => void,
) {
  const devices = shallowRef<AndroidDevice[]>([])
  const loading = shallowRef(false)
  const busy = shallowRef(false)
  const variantsLoading = shallowRef(false)
  const error = shallowRef('')
  let revision = 0
  onBeforeUnmount(() => {
    revision++
  })
  async function refresh(folder: string) {
    const current = ++revision
    loading.value = true
    error.value = ''
    devices.value = []
    try {
      const result = await window.darsena!.call('androidDevices', { ...context, folder })
      if (current === revision) devices.value = result
    } catch (e) {
      if (current === revision) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (current === revision) loading.value = false
    }
  }
  async function loadVariants(folder: string): Promise<TaskCatalog | undefined> {
    if (variantsLoading.value) return
    variantsLoading.value = true
    error.value = ''
    try { return await window.darsena!.call('loadGradle', { ...context, folder }) }
    catch (e) { error.value = e instanceof Error ? e.message : String(e) }
    finally { variantsLoading.value = false }
  }
  async function start(taskId: string, serial: string) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      const run = await window.darsena!.call('androidStart', { ...context, taskId, serial })
      started(run.id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      busy.value = false
    }
  }
  return { devices, loading, busy, error, refresh, start, loadVariants, variantsLoading }
}
