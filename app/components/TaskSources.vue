<script setup lang="ts">
import type { TaskSource } from '../../shared/types'
const props = defineProps<{ sources: TaskSource[]; loading: boolean }>()
const emit = defineEmits<{ load: [folder: string] }>()
const pending = computed(() => props.sources.filter((source) => !source.loaded).length)
</script>

<template>
  <details v-if="sources.length" class="task-sources">
    <AppTooltip :text="'See where tasks come from and load sources that require an explicit refresh.'"><summary
      
    >
      <AppIcon name="ChevronRight" :size="13" class="source-chevron" />
      <span
        >Sources <span class="muted">{{ sources.length }}</span></span
      >
      <span v-if="loading" class="source-pending" role="status">Loading tasks…</span>
      <span v-else-if="pending" class="source-pending">{{ pending }} to load</span>
    </summary></AppTooltip>
    <div class="source-list">
      <p class="source-explanation">Tasks from every source appear together in the list below.</p>
      <div
        v-for="source in sources"
        :key="JSON.stringify([source.kind, source.folder])"
        class="task-source-row"
      >
        <div class="source-info">
          <strong>{{ source.label }}</strong>
          <AppTooltip :text="`Source folder in the selected worktree: ${source.folder}`"><span
            class="mono muted"
            
            >{{ source.folder === '.' ? 'Root' : source.folder }}</span
          ></AppTooltip>
        </div>
        <span class="source-count muted">{{
          source.loaded ? `${source.count} tasks` : 'Not loaded'
        }}</span>
        <AppTooltip :text="
            `Run Gradle to discover tasks in this worktree. This evaluates the build and may take a moment.\n${source.folder}`
          " v-if="source.kind === 'gradle'"><button
          
          class="button small"
          :disabled="loading"
          :aria-label="`Sync Gradle in ${source.folder}`"
          
          @click="emit('load', source.folder)"
        >
          <AppIcon name="RefreshCw" :size="12" />{{ loading ? 'Syncing…' : 'Sync Gradle' }}
        </button></AppTooltip>
        <AppIcon v-else name="Check" :size="14" class="muted" />
      </div>
      <p v-if="pending" class="source-explanation">
        Gradle needs to evaluate the build to discover its tasks. Load it when you need it.
      </p>
    </div>
  </details>
</template>

<style scoped>
.task-sources {
  margin: -4px 0 16px;
  font-size: 12px;
}
.task-sources > summary {
  display: flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  cursor: pointer;
  border-radius: 4px;
  padding: 5px 2px;
  list-style: none;
}
.task-sources > summary::-webkit-details-marker {
  display: none;
}
.task-sources > summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.task-sources[open] .source-chevron {
  transform: rotate(90deg);
}
.source-pending {
  color: var(--accent);
  margin-left: 5px;
}
.source-list {
  margin-top: 7px;
  padding: 12px 14px;
  background: var(--pane);
  border: 1px solid var(--line);
  border-radius: 7px;
}
.source-explanation {
  color: var(--muted);
  line-height: 1.6;
  font-size: 12px;
}
.task-source-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}
.task-source-row + .task-source-row {
  border-top: 1px solid var(--line);
}
.source-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.source-info > span {
  overflow-wrap: anywhere;
  font-size: 12px;
}
.source-count {
  white-space: nowrap;
  font-size: 12px;
}
</style>
