<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Project } from '../../shared/types'

const props = defineProps<{ project: Project; selected: boolean }>()
const emit = defineEmits<{ select: []; star: []; remove: []; copy: []; reveal: [] }>()
const opened = shallowRef(false)
let contextRelease: AbortController | undefined
let contextFrame = 0
const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: props.project.name, description: props.project.root }],
  [
    { label: 'Show in Finder', icon: 'i-lucide-folder-open', onSelect: () => emit('reveal') },
    { label: 'Copy project path', icon: 'i-lucide-copy', onSelect: () => emit('copy') },
  ],
  [{ label: 'Remove from Darsena…', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('remove') }],
])
function contextMenu(event: MouseEvent) {
  contextRelease?.abort()
  cancelAnimationFrame(contextFrame)
  const show = () => { contextFrame = requestAnimationFrame(() => { opened.value = true }) }
  if (event.buttons) {
    contextRelease = new AbortController()
    document.addEventListener('pointerup', show, { once: true, signal: contextRelease.signal })
  } else show()
}
function contextKey(event: KeyboardEvent) {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    event.preventDefault()
    opened.value = true
  }
}
onBeforeUnmount(() => {
  contextRelease?.abort()
  cancelAnimationFrame(contextFrame)
})
</script>

<template>
  <div
    class="project-entry"
    :class="{ selected }"
    @contextmenu.prevent="contextMenu"
    @keydown="contextKey"
  >
    <button
      v-tooltip="`View this project’s worktrees.\n${project.root}`"
      class="project-select"
      :data-project-selected="selected"
      @click="emit('select')"
    >
      <AppIcon name="Folder" /><span class="truncate">{{ project.name }}</span>
    </button>
    <button
      v-tooltip="
        project.starred
          ? 'Remove this project from favorites.'
          : 'Keep this project at the top of your project list.'
      "
      class="icon-button small star-button"
      :class="{ starred: project.starred }"
      :aria-label="`${project.starred ? 'Unfavorite' : 'Favorite'} ${project.name}`"
      :aria-pressed="project.starred"
      @click="emit('star')"
    >
      <AppIcon name="Star" :size="13" />
    </button>
    <UDropdownMenu
      v-model:open="opened"
      :items="items"
      :content="{ align: 'start' }"
    >
      <UButton
        class="nuxt-ui-scope project-actions-trigger"
        color="neutral"
        variant="ghost"
        icon="i-lucide-ellipsis"
        :aria-label="`Actions for ${project.name}`"
        v-tooltip="'Project actions: show in Finder, copy path or remove from Darsena.'"
      />
    </UDropdownMenu>
  </div>
</template>

<style scoped>
.project-actions-trigger { flex-shrink: 0; opacity: 0.7; }
.project-entry:hover .project-actions-trigger,
.project-entry:focus-within .project-actions-trigger,
.project-actions-trigger[aria-expanded='true'] { opacity: 1; }
</style>
