<script setup lang="ts">
import { FileTerminal, ListChecks, Terminal, Wrench, Bot } from '@lucide/vue'
import { coloredToolIcons } from '../assets/colored-tool-icons'
import { toolIconPaths } from '../assets/tool-icon-paths'
import type { TaskToolIcon } from '../utils/taskTools'

const props = defineProps<{ icon: TaskToolIcon }>()
const path = computed(() =>
  Object.hasOwn(toolIconPaths, props.icon)
    ? toolIconPaths[props.icon as keyof typeof toolIconPaths]
    : undefined,
)
const fallbackIcons = { android: Bot, shell: FileTerminal, command: Terminal, build: Wrench, recipe: ListChecks }
const fallback = computed(() => fallbackIcons[props.icon as keyof typeof fallbackIcons] || Terminal)
</script>

<template>
  <img v-if="coloredToolIcons.some(name => name === icon)" :src="'/task-logos/' + icon + '.svg'" class="tool-icon brand-tool-icon" :class="icon" alt="" draggable="false" />
  <svg
    v-else-if="path"
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
    :style="icon === 'android' ? { color: '#3ddc84' } : undefined"
    :size="18"
    :stroke-width="1.8"
    aria-hidden="true"
  />
</template>

<style scoped>
.tool-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
 .brand-tool-icon { object-fit: contain; }
@media (prefers-color-scheme: dark) {
  .brand-tool-icon.pnpm, .brand-tool-icon.gradle, .brand-tool-icon.rust { background: #f5f5f4; border-radius: 2px; padding: 1px; }
}
</style>
