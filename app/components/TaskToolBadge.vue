<script setup lang="ts">
import type { TaskTool } from '../utils/taskTools'
defineProps<{ tool: TaskTool }>()
</script>

<template>
  <AppTooltip :text="tool.hint"><span class="task-tool-badge" :class="`tool-${tool.tone}`" >
    <TaskToolIcon :icon="tool.icon" />
    <span>{{ tool.label }}</span>
  </span></AppTooltip>
</template>

<style scoped>
.task-tool-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 22px;
  padding: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 450;
  line-height: 18px;
  text-align: left;
}
</style>
