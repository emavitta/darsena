<script setup lang="ts">
import type { TaskCatalog } from '../../shared/types'
const props = defineProps<{
  initialFolder: string
  projectId: string
  worktree: string
  catalog: TaskCatalog
  gradleBusy: boolean
}>()
const emit = defineEmits<{ close: []; started: [id: string]; loaded: [] }>()
const { devices, loading, busy, error, refresh, start, loadVariants, variantsLoading } = useAndroidLaunch(
  { projectId: props.projectId, worktree: props.worktree },
  (id) => emit('started', id),
)
const adbBusy = shallowRef(false)
const syncedAt = shallowRef('')
const loadedCatalog = shallowRef(props.catalog)
watch(() => props.catalog, value => { loadedCatalog.value = value })
const selectOpen = reactive({ folder: false, variant: false, device: false })
function closeSelect(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()
  selectOpen.folder = selectOpen.variant = selectOpen.device = false
}
async function load() {
  const catalog = await loadVariants(folder.value)
  if (catalog) { loadedCatalog.value = catalog; syncedAt.value = new Date().toLocaleTimeString(); emit('loaded') }
}
const folder = shallowRef(props.initialFolder)
const taskId = shallowRef('')
const serial = shallowRef('')
const variants = computed(() =>
  loadedCatalog.value.tasks
    .filter((t) => t.folder === folder.value && t.available && t.android)
    .map((t) => ({ label: t.name.replace(/install([^:]*)$/, '$1'), value: t.id })),
)
const sourceLoaded = computed(
  () => loadedCatalog.value.sources.find((s) => s.kind === 'gradle' && s.folder === folder.value)?.loaded,
)
const deviceOptions = computed(() =>
  devices.value.map((d) => ({
    label: d.label + ' · ' + d.serial + (d.state === 'device' ? '' : ' · ' + d.state),
    value: d.serial,
    disabled: d.state !== 'device',
  })),
)
watch(
  folder,
  (value) => {
    taskId.value = ''
    serial.value = ''
    void refresh(value)
  },
  { immediate: true },
)
watch(variants, (items) => {
  if (!items.some((i) => i.value === taskId.value)) taskId.value = items[0]?.value || ''
})
watch(devices, (items) => {
  if (!items.some((i) => i.serial === serial.value && i.state === 'device'))
    serial.value =
      items.filter((i) => i.state === 'device').length === 1
        ? items.find((i) => i.state === 'device')!.serial
        : ''
})
</script>
<template>
  <AppDialog
    id="android-launch-dialog"
    title="Run on Android"
    :busy="busy || adbBusy || gradleBusy || variantsLoading"
    @close="emit('close')"
  >
    <div class="form-stack nuxt-ui-scope">
      <p class="mono android-context">{{ worktree }}</p>
      <UFormField label="Android folder">
        <p class="mono android-context">{{ folder === '.' ? 'Worktree root' : folder }}</p>
      </UFormField>
      <UFormField label="Module and variant">
        <USelect
          v-model="taskId"
          v-model:open="selectOpen.variant"
          :content="{ onEscapeKeyDown: closeSelect }"
          :items="variants"
          :disabled="busy || adbBusy || gradleBusy || variantsLoading || !variants.length"
          placeholder="Choose a variant"
          portal="#android-launch-dialog"
          class="w-full"
          :ui="{ base: 'text-[14px] min-h-[36px]', content: 'nuxt-ui-scope', item: 'text-[13px] min-h-[32px]' }"
        />
      </UFormField>
      <UButton
        color="neutral"
        variant="outline"
        :loading="gradleBusy || variantsLoading"
        @click="load"
        >{{ variantsLoading ? 'Syncing…' : 'Sync Gradle' }}</UButton
      >
      <p v-if="syncedAt" class="muted">Last synced {{ syncedAt }}</p>
      <p v-if="sourceLoaded && !variants.length" class="muted">
        No Android install variants found. This folder may be a library or a non-Android Gradle
        project.
      </p>
      <UFormField label="Device or running emulator">
        <USelect
          v-model="serial"
          v-model:open="selectOpen.device"
          :content="{ onEscapeKeyDown: closeSelect }"
          :items="deviceOptions"
          :disabled="busy || adbBusy || loading"
          placeholder="Choose a device"
          portal="#android-launch-dialog"
          class="w-full"
          :ui="{ base: 'text-[14px] min-h-[36px]', content: 'nuxt-ui-scope', item: 'text-[13px] min-h-[32px]' }"
        />
      </UFormField>
      <UButton
        color="neutral"
        variant="ghost"
        :loading="loading"
        :disabled="busy || adbBusy"
        icon="i-lucide-refresh-cw"
        @click="refresh(folder)"
        >Refresh devices</UButton
      >
      <p v-if="!loading && !devices.length" class="muted">
        Connect a device with USB debugging authorized, or start an emulator in Android Studio.
      </p>
      <AndroidAppActions v-if="serial" :key="serial" :project-id="projectId" :worktree="worktree" :folder="folder" :serial="serial" :disabled="busy || gradleBusy || variantsLoading" @busy="adbBusy = $event" @started="emit('started', $event)" />
      <p class="android-note">
        Build → install → launch. Installing the same application ID replaces its current build on
        the selected device, including a build from another worktree. Existing app data is kept when
        Android permits the update.
      </p>
      <p class="android-note">
        The app continues independently on the device after deployment. Stop in Activity cancels
        deployment; it does not stop the installed app.
      </p>
      <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
      <footer class="dialog-actions">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="busy || adbBusy || gradleBusy || variantsLoading"
          @click="emit('close')"
          >Cancel</UButton
        >
        <UButton
          :loading="busy"
          :disabled="adbBusy || !taskId || !serial || loading || gradleBusy || variantsLoading"
          icon="i-lucide-play"
          @click="start(taskId, serial)"
          >Build, install &amp; launch</UButton
        >
      </footer>
    </div>
  </AppDialog>
</template>
<style scoped>
.android-context {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.android-note {
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}
</style>
