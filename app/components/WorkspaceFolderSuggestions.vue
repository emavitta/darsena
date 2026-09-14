<script setup lang="ts">
import type { Folder, WorkspaceFolders } from '../../shared/types'
const props = defineProps<{
  projectId: string
  worktree: string
  folders: Folder[]
  saving: boolean
}>()
const emit = defineEmits<{ save: [folders: string[]] }>()
const report = shallowRef<WorkspaceFolders>()
const loading = shallowRef(false)
const error = shallowRef('')
const selected = shallowRef<string[]>([])
const query = shallowRef('')
const saved = computed(() => new Set(props.folders.map((f) => f.path)))
const visible = computed(
  () =>
    report.value?.folders.filter((f) =>
      `${f.name} ${f.path}`.toLowerCase().includes(query.value.toLowerCase()),
    ) || [],
)
let revision = 0
onBeforeUnmount(() => revision++)
async function refresh() {
  const current = ++revision
  loading.value = true
  error.value = ''
  selected.value = []
  try {
    const value = await window.darsena!.call('workspaceFolders', {
      projectId: props.projectId,
      worktree: props.worktree,
    })
    if (revision === current) report.value = value
  } catch (e) {
    if (revision === current) error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (revision === current) loading.value = false
  }
}
function toggle(folder: string, checked: boolean | 'indeterminate') {
  selected.value =
    checked === true
      ? [...new Set([...selected.value, folder])]
      : selected.value.filter((f) => f !== folder)
}
onMounted(refresh)
</script>
<template>
  <div class="workspace-suggestions nuxt-ui-scope">
    <div class="workspace-toolbar">
      <UInput
        v-model="query"
        aria-label="Search workspace folders"
        placeholder="Find package or folder…"
      />
      <UButton
        color="neutral"
        variant="ghost"
        :loading="loading"
        :disabled="saving"
        @click="refresh"
        >Refresh workspace</UButton
      >
    </div>
    <p v-if="report?.source" class="muted">Detected from {{ report.source }} in this worktree.</p>
    <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
    <p v-if="loading" role="status">Reading workspace…</p>
    <div v-else class="workspace-options">
      <div v-for="folder in visible" :key="folder.path" class="workspace-option">
        <UCheckbox
          :model-value="saved.has(folder.path) || selected.includes(folder.path)"
          :disabled="saving || saved.has(folder.path)"
          :label="folder.name"
          @update:model-value="toggle(folder.path, $event)"
        />
        <span class="mono muted workspace-path">{{ folder.path }}</span>
        <span class="muted">{{
          saved.has(folder.path) ? 'Already added' : folder.taskCount + ' scripts'
        }}</span>
      </div>
      <p v-if="!visible.length && !error" class="muted">
        {{
          report?.source
            ? 'No matching workspace packages. You can still browse folders manually.'
            : 'No supported workspace configuration found. Use Browse to choose folders.'
        }}
      </p>
    </div>
    <p v-for="warning in report?.warnings" :key="warning" class="muted">{{ warning }}</p>
    <UButton
      :disabled="loading || saving || !selected.length"
      :loading="saving"
      @click="emit('save', selected)"
      >Add selected folders ({{ selected.length }})</UButton
    >
  </div>
</template>
<style scoped>
.workspace-suggestions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.workspace-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.workspace-options {
  max-height: 300px;
  overflow: auto;
}
.workspace-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.workspace-path {
  overflow-wrap: anywhere;
  padding-left: 24px;
}
</style>
