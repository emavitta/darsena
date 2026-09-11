<script setup lang="ts">
import type { Methods } from '../../shared/types'
type Operation = Methods['androidAppAction']['input']['operation']
const props = defineProps<{ projectId: string; worktree: string; folder: string; serial: string; disabled: boolean }>()
const emit = defineEmits<{ started: [id: string]; busy: [value: boolean] }>()
const expanded = shallowRef(false)
const packages = shallowRef<string[]>([])
const user = shallowRef('')
const applicationId = shallowRef('')
const loading = shallowRef(false)
const busy = shallowRef(false)
const error = shallowRef('')
const confirm = shallowRef<Operation>()
const menuOpen = shallowRef(false)
const selectOpen = shallowRef(false)
let alive = true
onBeforeUnmount(() => { alive = false })
async function refresh() {
  loading.value = true; error.value = ''; confirm.value = undefined
  try {
    const result = await window.darsena!.call('androidApps', { projectId: props.projectId, worktree: props.worktree, folder: props.folder, serial: props.serial })
    if (!alive) return
    packages.value = result.packages; user.value = result.user
    if (!result.packages.includes(applicationId.value)) applicationId.value = ''
  } catch (e) { if (alive) { error.value = e instanceof Error ? e.message : String(e); packages.value = []; applicationId.value = '' } }
  finally { if (alive) loading.value = false }
}
watch(expanded, value => { if (value) void refresh() })
watch(applicationId, () => { confirm.value = undefined })
async function execute(operation: Operation, confirmed = false) {
  if (busy.value || !applicationId.value || props.disabled) return
  if (['clear', 'uninstall'].includes(operation) && !confirmed) { confirm.value = operation; return }
  busy.value = true; emit('busy', true); error.value = ''
  try {
    const run = await window.darsena!.call('androidAppAction', { projectId: props.projectId, worktree: props.worktree, folder: props.folder, serial: props.serial, user: user.value, applicationId: applicationId.value, operation, confirmed })
    emit('started', run.id)
  } catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { busy.value = false; emit('busy', false) }
}
const items = computed(() => [
  [{ label: 'Start app', onSelect: () => execute('start') }, { label: 'Stop app', onSelect: () => execute('stop') }, { label: 'Restart app', onSelect: () => execute('restart') }],
  [{ label: 'Clear app data…', onSelect: () => execute('clear') }, { label: 'Uninstall app…', onSelect: () => execute('uninstall') }],
])
function escapeMenu(event: KeyboardEvent) { event.preventDefault(); event.stopPropagation(); menuOpen.value = selectOpen.value = false }
</script>
<template>
  <UCollapsible v-model:open="expanded" :disabled="disabled || busy">
    <UButton color="neutral" variant="outline" icon="i-lucide-smartphone" :disabled="disabled || busy">ADB actions</UButton>
    <template #content>
      <div class="adb-panel">
        <p class="muted">Control an installed app without rebuilding. Choose its application ID explicitly; the selected Gradle variant does not change the app already on the device.</p>
        <p class="mono adb-target">{{ serial }} · Android user {{ user || '…' }}</p>
        <UFormField label="Installed application ID">
          <USelect v-model="applicationId" v-model:open="selectOpen" :items="packages" aria-label="Installed application ID" placeholder="Choose an installed app" :disabled="loading || busy || disabled" portal="#android-launch-dialog" :content="{ onEscapeKeyDown: escapeMenu }" class="w-full" :ui="{ content: 'nuxt-ui-scope', base: 'text-[14px] min-h-[36px]', item: 'text-[13px] min-h-[32px]' }" />
        </UFormField>
        <p v-if="!loading && !packages.length" class="muted">No user-installed apps found. Install a build or refresh the device.</p>
        <div class="adb-buttons">
          <UButton color="neutral" variant="ghost" :loading="loading" :disabled="busy || disabled" icon="i-lucide-refresh-cw" @click="refresh">Refresh apps</UButton>
          <UDropdownMenu v-model:open="menuOpen" :items="items" portal="#android-launch-dialog" :content="{ onEscapeKeyDown: escapeMenu }">
            <UButton color="neutral" variant="soft" :disabled="!applicationId || loading || busy || disabled" :loading="busy" trailing-icon="i-lucide-chevron-down">App actions</UButton>
          </UDropdownMenu>
        </div>
        <div v-if="confirm" class="adb-confirm" role="group" aria-label="Confirm Android operation">
          <strong>{{ confirm === 'clear' ? 'Clear all local app data?' : 'Uninstall this app?' }}</strong>
          <p class="mono adb-target">{{ applicationId }} · {{ serial }} · user {{ user }}</p>
          <p>This removes this app’s local data for this Android user. It affects the installed app even if another worktree built it.</p>
          <div class="adb-buttons">
            <UButton color="neutral" variant="ghost" :disabled="busy" @click="confirm = undefined">Cancel action</UButton>
            <UButton color="error" :loading="busy" @click="execute(confirm!, true)">{{ confirm === 'clear' ? 'Clear app data' : 'Uninstall app' }}</UButton>
          </div>
        </div>
        <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
      </div>
    </template>
  </UCollapsible>
</template>
<style scoped>
.adb-panel { display: grid; gap: 12px; margin-top: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; }
.adb-target { overflow-wrap: anywhere; }
.adb-select { width: 100%; min-height: 36px; font-size: 14px; }
.adb-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.adb-confirm { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--danger); border-radius: 8px; }
</style>
