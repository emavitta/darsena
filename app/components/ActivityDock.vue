<script setup lang="ts">
import type { Run } from '../../shared/types'
const props = defineProps<{ runs: Run[] }>()
const open = defineModel<boolean>('open', { required: true })
const expanded = shallowRef(false)
const panelId = useId()
const running = computed(() =>
  props.runs.filter((run) => ['starting', 'running', 'stopping'].includes(run.status)),
)
const failed = computed(() => props.runs.filter(run => run.status === 'failed').length)
const height = shallowRef<number>()
let drag: { y: number; height: number } | undefined
function resize(event: PointerEvent) {
  if (event.button !== 0) return
  drag = { y: event.clientY, height: (event.currentTarget as HTMLElement).parentElement!.getBoundingClientRect().height }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function setHeight(value: number) {
  height.value = Math.max(220, Math.min(window.innerHeight * 0.8, value))
}
function move(event: PointerEvent) {
  if (drag) setHeight(drag.height + drag.y - event.clientY)
}
function resizeKey(event: KeyboardEvent) {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  setHeight((height.value || window.innerHeight * 0.44) + (event.key === 'ArrowUp' ? 30 : -30))
}
</script>

<template>
  <section
    class="activity-dock"
    :class="{ open, enlarged: open && expanded }"
    :style="open && height ? { height: `${height}px` } : undefined"
    aria-label="Activity dock"
  >
    <div v-if="open" class="dock-resize" role="separator" aria-label="Resize Activity panel" aria-orientation="horizontal" tabindex="0" @pointerdown="resize" @pointermove="move" @pointerup="drag = undefined" @lostpointercapture="drag = undefined" @keydown="resizeKey" />
    <header class="dock-toolbar nuxt-ui-scope">
      <UButton
        aria-label="Activity"
        :aria-expanded="open"
        :aria-controls="panelId"
        color="neutral"
        variant="ghost"
        icon="i-lucide-activity"
        class="dock-toggle"
        @click="open = !open"
        >Activity <span class="dock-count">{{ running.length }} active</span></UButton
      >
      <span class="dock-summary"><span v-if="failed" class="text-danger">{{ failed }} failed</span><span v-else>{{ running.length ? 'Across all projects' : 'No tasks running' }}</span></span>
      <StopAllTasks :runs="runs" />
      <UButton
        v-if="open"
        color="neutral"
        variant="ghost"
        :aria-label="expanded ? 'Reduce Activity panel' : 'Enlarge Activity panel'"
        :icon="expanded ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
        v-tooltip="
          expanded ? 'Give more space to the worktree.' : 'Give more space to task output.'
        "
        @click="expanded = !expanded; height = undefined"
      />
      <UButton
        color="neutral"
        variant="ghost"
        :aria-label="open ? 'Collapse Activity panel' : 'Open Activity panel'"
        :aria-expanded="open"
        :aria-controls="panelId"
        :icon="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
        class="dock-disclosure"
        @click="open = !open"
        >{{ open ? 'Collapse' : 'Show details' }}</UButton
      >
    </header>
    <div v-show="open" :id="panelId" class="dock-content"><slot /></div>
  </section>
</template>

<style scoped>
.dock-resize { height: 6px; flex-shrink: 0; cursor: ns-resize; touch-action: none; background: var(--line); }
.dock-resize:hover, .dock-resize:focus-visible { background: var(--accent); }
.activity-dock {
  height: 54px;
  min-height: 54px;
  margin: 12px;
  border: 1px solid var(--muted);
  border-radius: 12px;
  box-shadow: 0 4px 18px #0002;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  overflow: hidden;
}
.activity-dock.open {
  height: calc((100dvh - 46px) * 0.44);
}
.activity-dock.enlarged {
  height: calc((100dvh - 46px) * 0.55);
}
.dock-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 4px 12px;
  background: var(--surface);
}
.dock-disclosure {
  flex-shrink: 0;
  font-size: 13px;
}
.dock-toggle {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}
.dock-count {
  font-weight: 400;
  color: var(--accent);
  margin-left: 6px;
}
.dock-summary {
  flex: 1;
  font-size: 13px;
  color: var(--muted);
  min-width: 0;
}
.dock-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid var(--line);
  background: var(--bg);
}
</style>
