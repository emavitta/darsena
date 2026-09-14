<script setup lang="ts">
import type { UpdateStatus } from '../../shared/types'
defineProps<{ compact?: boolean }>()
const status = useState<UpdateStatus | undefined>('release-status', () => undefined)
const busy = useState('release-checking', () => false)
const details = shallowRef(false)
async function check(force = false) {
  if (busy.value || !window.darsena) return
  busy.value = true
  try { status.value = await window.darsena.call('checkUpdates', { force }) }
  finally { busy.value = false }
}
async function open(url: string) {
  await window.darsena!.call('openUrl', { url })
}
onMounted(() => { if (!status.value) void check() })
</script>
<template>
  <div v-if="!compact || status?.release" class="update-status nuxt-ui-scope" :class="{ 'update-compact': compact }">
    <template v-if="!compact">
      <p>Version {{ status?.currentVersion || '…' }} · {{ status?.includePrereleases ? 'Including prereleases' : 'Stable releases' }}</p>
      <UButton color="neutral" variant="outline" :loading="busy" @click="check(true)">Check for updates</UButton>
      <p v-if="status?.error" role="status" class="muted">Could not check for updates: {{ status.error }}</p>
      <p v-else-if="status && !status.release" role="status" class="muted">No newer release found.</p>
    </template>
    <UButton v-if="status?.release" color="primary" variant="soft" icon="i-lucide-download" @click="details = !details">{{ status.release.version }} available</UButton>
    <template v-if="details && status?.release">
      <AppDialog v-if="compact" title="Darsena update available" @close="details = false">
        <div class="form-stack nuxt-ui-scope">
          <p>{{ status.currentVersion }} → {{ status.release.version }}</p>
          <pre class="release-notes">{{ status.release.notes || 'Release notes are available on GitHub.' }}</pre>
          <UButton v-if="status.release.downloadUrl" @click="open(status.release.downloadUrl)">Download macOS DMG</UButton>
          <UButton color="neutral" variant="ghost" @click="open(status.release.url)">View release on GitHub</UButton>
          <p class="muted">Download and install manually after quitting Darsena. Your tasks will not be interrupted by this check.</p>
        </div>
      </AppDialog>
      <div v-else class="form-stack">
        <pre class="release-notes">{{ status.release.notes || 'Release notes are available on GitHub.' }}</pre>
        <UButton v-if="status.release.downloadUrl" @click="open(status.release.downloadUrl)">Download macOS DMG</UButton>
        <UButton color="neutral" variant="ghost" @click="open(status.release.url)">View release on GitHub</UButton>
      </div>
    </template>
  </div>
</template>
<style scoped>
.update-status { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.update-compact { position: fixed; top: 7px; right: 100px; z-index: 20; margin: 0; -webkit-app-region: no-drag; }
.release-notes { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 280px; overflow: auto; font: inherit; line-height: 1.6; }
</style>
