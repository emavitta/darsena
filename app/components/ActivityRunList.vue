<script setup lang="ts">
import { runFolderLabel } from '../../shared/run-labels'
import type { Run } from '../../shared/types'
const props = defineProps<{ runs: Run[]; selected?: string; compact?: boolean }>()
const emit = defineEmits<{ inspect: [id: string] }>()
const groups = computed(() => [
  { title: 'Running', label: 'Running tasks', active: true, runs: props.runs.filter(isActive) },
  {
    title: 'History',
    label: 'Task history',
    active: false,
    runs: props.runs.filter((run) => !isActive(run)),
  },
])
function isActive(run: Run) {
  return ['starting', 'running', 'stopping'].includes(run.status)
}
function status(run: Run) {
  return {
    starting: 'Starting',
    running: 'Running',
    stopping: 'Stopping…',
    stopped: 'Stopped',
    succeeded: 'Completed',
    failed: 'Failed',
  }[run.status]
}
function duration(run: Run) {
  const seconds = Math.max(0, Math.floor(((run.endedAt || Date.now()) - run.startedAt) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
</script>

<template>
  <div class="run-list" :class="{ 'run-list-compact': compact }">
    <section v-for="group in groups.filter(group => group.runs.length)" :key="group.title" :aria-label="group.label" class="run-group">
      <header class="group-heading">
        <h2>{{ group.title }}</h2>
        <span>{{ group.runs.length }}</span>
      </header>
      <p v-if="!group.runs.length" class="group-empty">
        {{
          group.active ? 'No tasks are running.' : 'Finished and stopped tasks will appear here.'
        }}
      </p>
      <button
        v-for="run in group.runs"
        :key="run.id"
        class="run-entry"
        :class="{ selected: run.id === selected, 'active-entry': group.active }"
        :aria-pressed="run.id === selected"
        v-tooltip="`View ${run.name} output.\n${run.folder}`"
        @click="emit('inspect', run.id)"
      >
        <div class="entry-status">
          <span
            class="state-label"
            :class="{ live: group.active, failed: run.status === 'failed' }"
            >{{ status(run) }}</span
          ><span class="run-duration">{{ duration(run) }}</span>
        </div>
        <div class="entry-task">{{ run.name }}</div>
        <div class="entry-folder mono" :title="run.folder"><AppIcon name="Folder" :size="14" />{{ runFolderLabel(run) }}</div>
        <div class="entry-branch">
          <AppIcon name="GitFork" :size="16" /><strong>{{
            run.worktreeBranch || run.worktreeName
          }}</strong>
        </div>
        <div class="entry-project" :title="run.worktree">{{ run.projectName }}</div>
        <div v-if="run.source === 'mcp' || run.port || run.exitCode != null" class="entry-meta">
          <span
            v-if="run.source === 'mcp'"
            class="tag"
            v-tooltip="'Started through Darsena’s MCP connection.'"
            >MCP</span
          >
          <span v-if="group.active && run.port">Port {{ run.port }}</span>
          <span v-if="!group.active && run.exitCode != null">Exit {{ run.exitCode }}</span>
        </div>
      </button>
    </section>
  </div>
</template>

<style scoped>
.entry-branch { margin-top: 5px; }

.run-list {
  width: clamp(275px, 28vw, 350px);
  padding: 14px;
}
.run-group + .run-group {
  border-top: 1px solid var(--line);
  margin-top: 20px;
  padding-top: 15px;
}
.group-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 3px 4px 12px;
}
.group-heading h2 {
  font-size: 14px;
  margin: 0;
}
.group-heading > span {
  color: var(--muted);
  font-size: 12px;
}
.group-empty {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
  padding: 0 4px 9px;
}
.run-entry {
  padding: 13px;
  margin-bottom: 9px;
  border-color: var(--line);
}
.run-entry.selected {
  border-color: var(--accent);
  box-shadow: inset 3px 0 var(--accent);
}
.entry-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.state-label {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--line);
  color: var(--muted);
}
.state-label.live {
  background: var(--accent-soft);
  color: var(--accent);
}
.state-label.failed {
  background: var(--danger-soft);
  color: var(--danger);
}
.run-duration {
  font-size: 12px;
}
.entry-branch {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 15px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.entry-branch svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--accent);
}
.entry-branch strong {
  min-width: 0;
}
.entry-task {
  font-size: 14px;
  font-weight: 600;
  margin-top: 9px;
  overflow-wrap: anywhere;
}
.entry-folder {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 5px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--accent);
  overflow-wrap: anywhere;
}
.entry-folder svg { flex-shrink: 0; margin-top: 3px; }
.entry-project {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
}
.entry-path {
  font-size: 12px;
  color: var(--muted);
  overflow-wrap: anywhere;
  line-height: 1.5;
  margin-top: 8px;
}
.entry-meta {
  display: flex;
  gap: 9px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
  margin-top: 10px;
}
.run-list-compact {
  width: clamp(250px, 25vw, 320px);
  padding: 8px;
}
.run-list-compact .group-heading {
  margin: 2px 4px 7px;
}
.run-list-compact .run-group + .run-group {
  margin-top: 12px;
  padding-top: 10px;
}
.run-list-compact .run-entry {
  padding: 9px 10px;
  margin-bottom: 6px;
}
.run-list-compact .entry-status {
  margin-bottom: 6px;
}
.run-list-compact .state-label {
  padding: 2px 5px;
}
.run-list-compact .entry-branch {
  font-size: 15px;
}
.run-list-compact .entry-task {
  margin-top: 5px;
  font-size: 14px;
}
.run-list-compact .entry-project {
  margin-top: 2px;
  font-size: 12px;
}
.run-list-compact .entry-path {
  margin-top: 5px;
  line-height: 1.4;
}
.run-list-compact .entry-meta {
  margin-top: 5px;
}
.run-list-compact .group-empty {
  padding-bottom: 4px;
  margin-block: 5px;
}
</style>
