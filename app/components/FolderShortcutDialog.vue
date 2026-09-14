<script setup lang="ts">
import type { Folder, FolderListing } from '../../shared/types'

const props = defineProps<{
  projectId: string
  worktreeName: string
  worktreePath: string
  folders: Folder[]
  listing?: FolderListing
  loading: boolean
  saving: boolean
  error: string
}>()
const emit = defineEmits<{
  close: []
  browse: [folder: string]
  save: [folder: string]
  saveWorkspace: [folders: string[]]
}>()
const mode = shallowRef<'browse' | 'workspace'>('browse')
const filter = shallowRef('')
const search = useTemplateRef('search')
const currentPath = computed(() => props.listing?.path || '.')
const breadcrumbs = computed(() => {
  const parts = currentPath.value === '.' ? [] : currentPath.value.split('/')
  return [
    { name: 'Worktree root', path: '.' },
    ...parts.map((name, index) => ({ name, path: parts.slice(0, index + 1).join('/') })),
  ]
})
const saved = computed(() => new Set(props.folders.map((folder) => folder.path)))
const visibleFolders = computed(() => {
  const query = filter.value.trim().toLocaleLowerCase()
  return (
    props.listing?.folders.filter((folder) => folder.name.toLocaleLowerCase().includes(query)) || []
  )
})
const unavailable = computed(() => props.loading || props.saving)
watch(currentPath, async () => {
  filter.value = ''
  await nextTick()
  search.value?.focus()
})
</script>

<template>
  <AppDialog title="Add a folder shortcut" :busy="saving" wide @close="emit('close')">
    <div class="form-stack folder-picker">
      <div>
        <p>
          Choose a subfolder of <strong>{{ worktreeName }}</strong
          >.
        </p>
        <p class="muted">
          The shortcut uses the same relative path in every worktree. No folders are created or
          copied.
        </p>
        <p class="picker-root mono muted" v-tooltip="worktreePath">{{ worktreePath }}</p>
      </div>
      <div class="nuxt-ui-scope folder-modes">
        <UButton
          color="neutral"
          :variant="mode === 'browse' ? 'solid' : 'ghost'"
          :disabled="saving"
          @click="mode = 'browse'"
          >Browse</UButton
        >
        <UButton
          color="neutral"
          :variant="mode === 'workspace' ? 'solid' : 'ghost'"
          :disabled="saving"
          @click="mode = 'workspace'"
          >From workspace</UButton
        >
      </div>
      <WorkspaceFolderSuggestions
        v-if="mode === 'workspace'"
        :project-id="projectId"
        :worktree="worktreePath"
        :folders="folders"
        :saving="saving"
        @save="emit('saveWorkspace', $event)"
      />
      <template v-else>
        <nav class="folder-breadcrumbs" aria-label="Folder location">
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
            <AppIcon v-if="index" name="ChevronRight" :size="12" />
            <button
              class="breadcrumb"
              :aria-current="crumb.path === currentPath ? 'location' : undefined"
              :disabled="unavailable"
              v-tooltip="`Browse ${crumb.path === '.' ? 'the worktree root' : crumb.path}.`"
              @click="emit('browse', crumb.path)"
            >
              {{ crumb.name }}
            </button>
          </template>
        </nav>
        <input
          ref="search"
          v-model="filter"
          type="search"
          aria-label="Filter subfolders"
          placeholder="Filter subfolders…"
          :disabled="saving"
        />
        <div class="picker-entries" :aria-busy="loading">
          <p v-if="loading" class="picker-empty muted" role="status">Reading folders…</p>
          <ul v-else-if="visibleFolders.length" aria-label="Subfolders">
            <li v-for="folder in visibleFolders" :key="folder.name">
              <button
                class="picker-entry"
                :aria-label="`Browse ${folder.name}`"
                :disabled="saving"
                v-tooltip="`Browse subfolders and choose this shortcut.\n${folder.path}`"
                @click="emit('browse', folder.path)"
              >
                <AppIcon name="Folder" :size="18" />
                <span class="truncate">{{ folder.name }}</span>
                <span v-if="saved.has(folder.path)" class="saved-label">Added</span>
                <AppIcon name="ChevronRight" :size="14" />
              </button>
            </li>
          </ul>
          <p v-else class="picker-empty muted" role="status">
            {{
              filter
                ? 'No matching subfolders.'
                : listing
                  ? 'No subfolders here.'
                  : 'Folders could not be loaded.'
            }}
          </p>
        </div>

        <div class="picker-selection">
          <span class="muted">Shortcut path</span>
          <strong class="mono">{{ currentPath }}</strong>
          <span v-if="saved.has(currentPath)" class="muted">Already added to this project</span>
        </div>
      </template>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <footer class="dialog-actions">
        <button class="button" :disabled="saving" @click="emit('close')">Cancel</button>
        <button
          v-if="mode === 'browse'"
          class="button primary"
          :disabled="unavailable || !listing || saved.has(currentPath)"
          v-tooltip="
            saved.has(currentPath)
              ? 'This folder already has a shortcut.'
              : 'Save this relative folder for all worktrees in the project.'
          "
          @click="emit('save', currentPath)"
        >
          {{ saving ? 'Adding…' : 'Add shortcut' }}
        </button>
      </footer>
    </div>
  </AppDialog>
</template>

<style scoped>
.folder-picker {
  gap: 14px;
}
.picker-root {
  margin-top: 7px;
  overflow-wrap: anywhere;
  font-size: 10px !important;
}
.folder-breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.breadcrumb {
  padding: 5px 6px;
  border-radius: 4px;
  color: var(--muted);
  overflow-wrap: anywhere;
  text-align: left;
}
.breadcrumb:hover {
  background: var(--pane);
}
.breadcrumb[aria-current] {
  color: var(--text);
  font-weight: 600;
}
.picker-entries {
  border: 1px solid var(--line);
  border-radius: 8px;
  height: 218px;
  overflow-y: auto;
  background: var(--surface);
}
.picker-entries ul {
  list-style: none;
  padding: 5px;
  margin: 0;
}
.picker-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  text-align: left;
  border-radius: 5px;
}
.picker-entry:hover {
  background: var(--accent-soft);
}
.picker-entry > .truncate {
  flex: 1;
}
.picker-entry > .icon {
  flex-shrink: 0;
  color: var(--muted);
}
.picker-entry:focus-visible {
  outline-offset: -2px;
}
.saved-label {
  font-size: 10px;
  color: var(--muted);
}
.picker-empty {
  text-align: center;
  padding: 28px 12px;
}
.picker-selection {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}
.picker-selection strong {
  color: var(--accent);
  overflow-wrap: anywhere;
}
</style>
