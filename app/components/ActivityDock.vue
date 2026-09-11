<script setup lang="ts">
import type { Run } from '../../shared/types'
const props = defineProps<{ runs: Run[] }>()
const open = defineModel<boolean>('open', { required: true })
const expanded = shallowRef(false)
const panelId = useId()
const running = computed(() =>
  props.runs.filter((run) => ['starting', 'running', 'stopping'].includes(run.status)),
)
const summary = computed(() => {
  const run = running.value[0]
  if (!run) return 'No tasks running'
  const label = `${run.projectName} · ${run.name} · ${run.worktreeBranch || run.worktreeName}`
  return running.value.length > 1 ? `${label} · +${running.value.length - 1} more` : label
})
</script>

<template>
  <section
    class="activity-dock"
    :class="{ open, enlarged: open && expanded }"
    aria-label="Activity dock"
  >
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
      <span class="dock-summary truncate" :title="summary">{{ summary }}</span>
      <UButton
        v-if="open"
        color="neutral"
        variant="ghost"
        :aria-label="expanded ? 'Reduce Activity panel' : 'Enlarge Activity panel'"
        :icon="expanded ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
        v-tooltip="
          expanded ? 'Give more space to the worktree.' : 'Give more space to task output.'
        "
        @click="expanded = !expanded"
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
