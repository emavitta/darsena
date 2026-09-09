<script setup lang="ts">
import type { AppId, Project, Run, Task, TaskCatalog, Worktree } from '../../shared/types'
defineProps<{
  project: Project
  worktree: Worktree
  catalog: TaskCatalog
  runs: Run[]
  busy: boolean
  gradleBusy: boolean
}>()
const emit = defineEmits<{
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
</script>
<template>
  <main class="worktree-detail">
    <header class="detail-header">
      <div class="eyebrow"><span class="status-dot neutral" />Selected worktree</div>
      <h1>{{ worktree.name }}</h1>
      <div class="branch-line">
        <AppIcon name="GitBranch" :size="15" /><span
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
        ><button
          class="icon-button small"
          aria-label="Copy worktree path"
          v-tooltip="'Copy the full path of this worktree to the clipboard.'"
          @click="emit('copy', worktree.path)"
        >
          <AppIcon name="Copy" :size="13" /></button
        ><button
          class="icon-button small"
          aria-label="Show worktree in Finder"
          v-tooltip="'Reveal this worktree’s folder in Finder.'"
          @click="emit('open', '.', 'finder')"
        >
          <AppIcon name="ArrowUpRight" :size="14" />
        </button>
      </div>
    </header>
    <div class="detail-body">
      <FolderShortcuts
        :folders="project.folders"
        @open="(folder, targetApp) => emit('open', folder, targetApp)"
        @add="emit('addFolder')"
        @remove="emit('removeFolder', $event)"
      />
      <TaskList
        :catalog="catalog"
        :favorites="project.favorites"
        :runs="runs"
        :worktree="worktree.path"
        :busy="busy"
        :source-loading="gradleBusy"
        @load-source="emit('gradle', $event)"
        @star="emit('starTask', $event)"
        @start="emit('start', $event)"
        @configure="emit('configure', $event)"
        @custom="emit('custom')"
        @remove="emit('removeCustom', $event)"
      />
    </div>
  </main>
</template>
