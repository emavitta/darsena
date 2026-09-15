<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import type { InstallStatus } from '../../shared/types'
const status = shallowRef<InstallStatus>({ phase: 'idle', percent: 0 })
const error = shallowRef('')
const busy = shallowRef(false)
const activeRuns = shallowRef(0)
async function refresh() {
  if (!window.darsena) return
  try {
    const [state, runs] = await Promise.all([
      window.darsena.call('updateInstallation'),
      window.darsena.call('runs'),
    ])
    status.value = state
    activeRuns.value = runs.filter((run) =>
      ['starting', 'running', 'stopping'].includes(run.status),
    ).length
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
useIntervalFn(refresh, 1000)
onMounted(refresh)
async function act(install: boolean) {
  if (!window.darsena || busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (install) await window.darsena.call('installUpdate')
    else await window.darsena.call('downloadUpdate')
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="form-stack nuxt-ui-scope">
    <p v-if="status.phase === 'downloading'" role="status">
      Downloading update · {{ Math.round(status.percent) }}%
    </p>
    <p v-if="status.phase === 'installing'" role="status">
      Preparing installation. Darsena will restart.
    </p>
    <p v-if="status.error || error" role="alert">{{ status.error || error }}</p>
    <template v-if="status.phase === 'ready'">
      <p>Update downloaded. Install and restart when you are ready.</p>
      <p v-if="activeRuns" role="status">
        Stop the {{ activeRuns }} active tasks in Activity before installing.
      </p>
      <UButton :disabled="activeRuns > 0" :loading="busy" @click="act(true)"
        >Install and restart</UButton
      >
    </template>
    <UButton
      v-else
      :disabled="['downloading', 'installing'].includes(status.phase)"
      :loading="busy"
      @click="act(false)"
      >Download update in Darsena</UButton
    >
    <p class="muted">
      Requires a signed macOS release installed in a writable Applications folder. Downloading does
      not stop tasks. Installation happens only when you choose Install and restart.
    </p>
  </div>
</template>
