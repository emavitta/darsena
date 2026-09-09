<script setup lang="ts">
import { FileTerminal, ListChecks, Terminal, Wrench } from '@lucide/vue'
import { toolIconPaths } from '../assets/tool-icon-paths'
import type { TaskToolIcon } from '../utils/taskTools'

const props = defineProps<{ icon: TaskToolIcon }>()
const path = computed(() =>
  Object.hasOwn(toolIconPaths, props.icon)
    ? toolIconPaths[props.icon as keyof typeof toolIconPaths]
    : undefined,
)
const fallbackIcons = { shell: FileTerminal, command: Terminal, build: Wrench, recipe: ListChecks }
const fallback = computed(() => fallbackIcons[props.icon as keyof typeof fallbackIcons] || Terminal)
</script>

<template>
  <svg
    v-if="path"
    class="tool-icon"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
  <component
    v-else
    :is="fallback"
    class="tool-icon"
    :size="18"
    :stroke-width="1.8"
    aria-hidden="true"
  />
</template>

<style scoped>
.tool-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
}
</style>
