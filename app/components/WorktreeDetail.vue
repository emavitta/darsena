<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AppState, AppId, Project, Run, Task, TaskCatalog, Worktree } from '../../shared/types'
const props = defineProps<{
  project: Project
  worktree: Worktree
  catalog: TaskCatalog
  runs: Run[]
  busy: boolean
  gradleBusy: boolean
}>()
const emit = defineEmits<{
  preparationSaved: [state: AppState]
  gitChanged: []
  navigate: [path: string]
  androidLoaded: []
  androidStarted: [id: string]
  open: [folder: string, app: AppId]
  addFolder: []
  removeFolder: [id: string]
  starTask: [id: string]
  start: [id: string]
  configure: [task: Task]
  custom: []
  removeCustom: [id: string]
  gradle: [folder: string]
  copy: [text: string]
}>()
const androidFolder = shallowRef<string>()
function runTask(id: string) {
  const task = props.catalog.tasks.find(t => t.id === id)
  if (task?.action === 'android-launch') androidFolder.value = task.folder
  else emit('start', id)
}
function androidStarted(id: string) { androidFolder.value = undefined; emit('androidStarted', id) }
const actions = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Open in VS Code', avatar: { src: '/apps/vscode.png', alt: '' }, onSelect: () => emit('open', '.', 'vscode') },
    { label: 'Open in Terminal', avatar: { src: '/apps/terminal.png', alt: '' }, onSelect: () => emit('open', '.', 'terminal') },
    { label: 'Open in Android Studio', avatar: { src: '/apps/android-studio.png', alt: '' }, onSelect: () => emit('open', '.', 'android-studio') },
  ],
  [
    { label: 'Show worktree in Finder', icon: 'i-lucide-folder-open', onSelect: () => emit('open', '.', 'finder') },
    { label: 'Copy worktree path', icon: 'i-lucide-copy', onSelect: () => emit('copy', props.worktree.path) },
  ],
])
</script>
<template>
  <main class="worktree-detail">
    <header class="detail-header">
      <div class="eyebrow"><span class="status-dot neutral" />Selected worktree</div>
      <h1>{{ worktree.name }}</h1>
      <div class="branch-line">
        <AppIcon name="GitBranch" :size="20" /><span
          class="detail-branch"
          v-tooltip="
            worktree.branch
              ? `Checked-out branch: ${worktree.branch}`
              : 'This worktree points directly to a commit, rather than a branch.'
          "
          >{{ worktree.branch || 'Detached HEAD' }}</span
        ><span
          v-tooltip="worktreeStatusHint(worktree)"
          class="tag"
          :class="{ changed: worktree.changed }"
          >{{
            worktree.error
              ? 'Status unknown'
              : worktree.changed
                ? `${worktree.changed} local changes`
                : 'Clean working tree'
          }}</span
        >
      </div>
      <div class="path-line">
        <span class="mono" v-tooltip="worktree.path">{{ worktree.path }}</span
        >
        <UDropdownMenu :items="actions" :content="{ align: 'end' }">
          <UButton
            class="nuxt-ui-scope"
            color="neutral"
            variant="ghost"
            icon="i-lucide-ellipsis"
            aria-label="Worktree actions"
            v-tooltip="'Open the selected worktree in an application, show it in Finder or copy its path.'"
          />
        </UDropdownMenu>
      </div>
      <WorktreeGit :project="project" :worktree="worktree" :runs="runs" @changed="emit('gitChanged')" @navigate="emit('navigate', $event)" />
    </header>
    <div class="detail-body">
      <WorktreePreparation :key="project.id + worktree.path" :project="project" :worktree="worktree" :runs="runs" :busy="busy" @start="emit('start', $event)" @saved="emit('preparationSaved', $event)" />
      <FolderShortcuts
        :folders="project.folders"
        @open="(folder, targetApp) => emit('open', folder, targetApp)"
        @add="emit('addFolder')"
        @remove="emit('removeFolder', $event)"
      />
      <AndroidLaunchDialog v-if="androidFolder !== undefined" :initial-folder="androidFolder" :key="worktree.path" :project-id="project.id" :worktree="worktree.path" :catalog="catalog" :gradle-busy="gradleBusy" @close="androidFolder = undefined" @started="androidStarted" @loaded="emit('androidLoaded')" />
      <TaskList
        :project-id="project.id"
        :folders="project.folders"
        :catalog="catalog"
        :favorites="project.favorites"
        :runs="runs"
        :worktree="worktree.path"
        :busy="busy"
        :source-loading="gradleBusy"
        @load-source="emit('gradle', $event)"
        @star="emit('starTask', $event)"
        @start="runTask"
        @configure="emit('configure', $event)"
        @custom="emit('custom')"
        @remove="emit('removeCustom', $event)"
      />
    </div>
  </main>
</template>

<style scoped>
.android-launch-button { margin: 0 0 22px; font-size: 14px; }
.detail-header h1 {
  font-size: 23px;
  line-height: 1.35;
}
.branch-line {
  color: var(--text);
  gap: 9px;
}
.branch-line > .icon {
  color: var(--accent);
  flex-shrink: 0;
}
.detail-branch {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
  min-width: 0;
}
.branch-line .tag {
  font-size: 12px;
  margin-left: 0;
}
.path-line {
  gap: 7px;
  align-items: flex-start;
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--pane);
}
.path-line > span {
  flex: 1;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text);
}
.path-line > button {
  flex-shrink: 0;
}
</style>
