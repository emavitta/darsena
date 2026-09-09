<script setup lang="ts">
const { fileManager } = usePlatform()
import type { Project } from '../../shared/types'

defineProps<{ project: Project; selected: boolean }>()
const emit = defineEmits<{ select: []; star: []; remove: []; copy: []; reveal: [] }>()
const trigger = useTemplateRef('trigger')
const menu = useTemplateRef('menu')
const menuId = useId()
const opened = shallowRef(false)
const position = shallowRef({ left: '0px', top: '0px' })
let contextRelease: AbortController | undefined
let contextFrame = 0

function items() {
  return [...(menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])]
}
function close(restoreFocus = false) {
  menu.value?.hidePopover()
  opened.value = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}
async function open(event?: MouseEvent, last = false) {
  if (!trigger.value || !menu.value) return
  const anchor = trigger.value.getBoundingClientRect()
  const x = event?.clientX ?? anchor.left
  const y = event?.clientY ?? anchor.bottom + 5
  position.value = { left: `${x}px`, top: `${y}px` }
  menu.value.showPopover()
  opened.value = true
  await nextTick()
  if (!opened.value || !menu.value) return
  const bounds = menu.value.getBoundingClientRect()
  position.value = {
    left: `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`,
    top: `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`,
  }
  await nextTick()
  const buttons = items()
  if (opened.value) buttons[last ? buttons.length - 1 : 0]?.focus({ preventScroll: true })
}
function contextMenu(event: MouseEvent) {
  contextRelease?.abort()
  cancelAnimationFrame(contextFrame)
  // On macOS contextmenu fires on mouse-down. Open after mouse-up so the
  // same gesture cannot immediately light-dismiss the native popover.
  const show = () => {
    contextFrame = requestAnimationFrame(() => {
      void open(event)
    })
  }
  if (event.buttons) {
    contextRelease = new AbortController()
    document.addEventListener('pointerup', show, { once: true, signal: contextRelease.signal })
  } else show()
}
function choose(action: 'copy' | 'reveal' | 'remove') {
  close(true)
  if (action === 'copy') emit('copy')
  else if (action === 'reveal') emit('reveal')
  else emit('remove')
}
function menuKey(event: KeyboardEvent) {
  const buttons = items()
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let next: number | undefined
  if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
  if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = buttons.length - 1
  if (next !== undefined) {
    event.preventDefault()
    buttons[next]?.focus()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close(true)
  } else if (event.key === 'Tab') close(true)
}
function contextKey(event: KeyboardEvent) {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    event.preventDefault()
    void open()
  }
}
function dismiss() {
  if (opened.value) close()
}
onMounted(() => {
  window.addEventListener('resize', dismiss)
  window.addEventListener('scroll', dismiss, true)
})
onBeforeUnmount(() => {
  contextRelease?.abort()
  cancelAnimationFrame(contextFrame)
  close()
  window.removeEventListener('resize', dismiss)
  window.removeEventListener('scroll', dismiss, true)
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
    <button
      ref="trigger"
      v-tooltip="`Project actions: show in ${fileManager}, copy path or remove from Darsena.`"
      class="icon-button small project-actions-trigger"
      :aria-label="`Actions for ${project.name}`"
      aria-haspopup="menu"
      :aria-expanded="opened"
      :aria-controls="menuId"
      @click="opened ? close(true) : open()"
      @keydown.down.prevent="open()"
      @keydown.up.prevent="open(undefined, true)"
    >
      <AppIcon name="Ellipsis" :size="16" />
    </button>
    <div
      :id="menuId"
      ref="menu"
      popover="auto"
      role="menu"
      :aria-label="`Actions for ${project.name}`"
      class="project-menu"
      :style="position"
      @toggle="opened = $event.newState === 'open'"
      @keydown="menuKey"
      @contextmenu.stop.prevent
    >
      <div class="project-menu-heading" role="presentation">
        <strong class="truncate">{{ project.name }}</strong>
        <span v-tooltip="project.root" class="mono truncate">{{ project.root }}</span>
      </div>
      <button class="project-menu-item" role="menuitem" tabindex="-1" @click="choose('reveal')">
        <AppIcon name="FolderOpen" />Show in {{ fileManager }}
      </button>
      <button class="project-menu-item" role="menuitem" tabindex="-1" @click="choose('copy')">
        <AppIcon name="Copy" />Copy project path
      </button>
      <div class="project-menu-divider" role="separator" />
      <button
        class="project-menu-item text-danger"
        role="menuitem"
        tabindex="-1"
        @click="choose('remove')"
      >
        <AppIcon name="Trash2" />Remove from Darsena…
      </button>
    </div>
  </div>
</template>

<style scoped>
.project-actions-trigger {
  opacity: 0.65;
}
.project-entry:hover .project-actions-trigger,
.project-entry:focus-within .project-actions-trigger,
.project-actions-trigger[aria-expanded='true'] {
  opacity: 1;
}
.project-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  width: 252px;
  max-width: calc(100vw - 16px);
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 6px 24px #0002;
}
.project-menu-heading {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 9px 12px;
}
.project-menu-heading strong {
  font-size: 12px;
  font-weight: 550;
}
.project-menu-heading span {
  font-size: 10px;
  color: var(--muted);
}
.project-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px;
  border-radius: 5px;
  text-align: left;
  font-size: 12px;
}
.project-menu-item:hover,
.project-menu-item:focus {
  background: var(--pane);
  outline: none;
}
.project-menu-divider {
  height: 1px;
  margin: 4px;
  background: var(--line);
}
</style>
