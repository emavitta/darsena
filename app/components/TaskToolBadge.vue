<script setup lang="ts">
import type { TaskTool } from '../utils/taskTools'
defineProps<{ tool: TaskTool }>()
</script>

<template>
  <span class="task-tool-badge" :class="`tool-${tool.tone}`" v-tooltip="tool.hint">
    <TaskToolIcon :icon="tool.icon" />
    <span>{{ tool.label }}</span>
  </span>
</template>

<style scoped>
.task-tool-badge {
  --tool-ink: #4e5662;
  --tool-bg: #edf0f4;
  --tool-line: #cbd2dc;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  min-width: 98px;
  max-width: 100%;
  min-height: 29px;
  padding: 4px 10px;
  border: 1px solid var(--tool-line);
  border-radius: 6px;
  background: var(--tool-bg);
  color: var(--tool-ink);
  font-size: 12px;
  font-weight: 650;
  line-height: 18px;
  overflow-wrap: anywhere;
  text-align: left;
}
.tool-npm {
  --tool-ink: #9d2c36;
  --tool-bg: #fbecef;
  --tool-line: #e9bac2;
}
.tool-pnpm {
  --tool-ink: #815316;
  --tool-bg: #fff3d7;
  --tool-line: #e4c791;
}
.tool-yarn {
  --tool-ink: #145e8a;
  --tool-bg: #e9f4fb;
  --tool-line: #b6d8ee;
}
.tool-bun {
  --tool-ink: #63513c;
  --tool-bg: #f3eee7;
  --tool-line: #d7cbbb;
}
.tool-gradle {
  --tool-ink: #126457;
  --tool-bg: #e5f5ee;
  --tool-line: #a9d5c7;
}
.tool-custom {
  --tool-ink: #604399;
  --tool-bg: #f2edfc;
  --tool-line: #d4c5ef;
}
@media (prefers-color-scheme: dark) {
  .task-tool-badge {
    --tool-ink: #d1d8e2;
    --tool-bg: #2d323b;
    --tool-line: #525d6d;
  }
  .tool-npm {
    --tool-ink: #ffb5bd;
    --tool-bg: #42282e;
    --tool-line: #82424e;
  }
  .tool-pnpm {
    --tool-ink: #f5cd85;
    --tool-bg: #3d3222;
    --tool-line: #7f6738;
  }
  .tool-yarn {
    --tool-ink: #9ed9ff;
    --tool-bg: #233647;
    --tool-line: #426b8d;
  }
  .tool-bun {
    --tool-ink: #e8d1b4;
    --tool-bg: #38322c;
    --tool-line: #786a58;
  }
  .tool-gradle {
    --tool-ink: #92e4c8;
    --tool-bg: #203b33;
    --tool-line: #3e7865;
  }
  .tool-custom {
    --tool-ink: #d2b8ff;
    --tool-bg: #352b47;
    --tool-line: #6f539a;
  }
}
</style>
