<script setup lang="ts">
import type { Project, Run, Worktree } from '../../shared/types'
const props = defineProps<{
  projects: Project[]
  trees: Record<string, Worktree[]>
  errors: string[]
  loading: boolean
  busy: boolean
  runs: Run[]
  selectedProject?: string
  selectedPath: string
}>()
const emit = defineEmits<{ close: []; select: [projectId: string, path: string] }>()
const search = shallowRef('')
const inputId = useId()
const groups = computed(() => props.projects.map(project => ({
  id: project.id,
  ignoreFilter: true,
  label: project.name,
  items: (props.trees[project.id] || []).filter(tree => {
    const text = [project.name, tree.name, tree.branch || '', tree.path].join(' ').toLowerCase()
    return search.value.toLowerCase().trim().split(/\s+/).every(term => text.includes(term))
  }).map(tree => ({
    id: project.id + ':' + tree.path,
    label: tree.branch || 'Detached HEAD · ' + tree.head.slice(0, 7),
    description: tree.path,
    suffix: project.name + ' ' + tree.name,
    disabled: props.busy || !tree.exists || tree.bare,
    projectName: project.name,
    treeName: tree.name,
    current: project.id === props.selectedProject && tree.path === props.selectedPath,
    activeCount: props.runs.filter(run => run.projectId === project.id && run.worktree === tree.path && ['starting', 'running', 'stopping'].includes(run.status)).length,
    unavailable: !tree.exists || tree.bare,
    onSelect: () => emit('select', project.id, tree.path),
  })),
})))
</script>

<template>
  <AppDialog title="Switch worktree" wide :busy="busy" class="worktree-switcher" @close="emit('close')">
    <label :for="inputId" class="sr-only">Search projects and worktrees</label>
    <UCommandPalette
      v-model:search-term="search"
      class="nuxt-ui-scope"
      :groups="groups"
      :loading="loading || busy"
      :disabled="busy"
      :input="{ id: inputId, ui: { base: 'text-[15px] min-h-[46px]' } }"
      placeholder="Search project, branch or path…"
      :ui="{ content: 'h-[360px] max-h-[45vh]', item: 'p-3 gap-3 min-h-[86px]', label: 'text-[13px] px-3 py-2', empty: 'text-[14px] p-6' }"
    >
      <template #item="{ item }">
        <UIcon name="i-lucide-git-branch" class="size-[19px] shrink-0 text-primary" />
        <div class="switcher-result">
          <div class="switcher-branch">
            <strong>{{ item.label }}</strong>
            <span v-if="item.current" class="switcher-current">Selected</span>
            <span v-if="item.activeCount" class="switcher-active">{{ item.activeCount }} active</span>
          </div>
          <span class="switcher-project">{{ item.projectName }} · {{ item.treeName }}<span v-if="item.unavailable"> · Unavailable</span></span>
          <span class="switcher-path mono">{{ item.description }}</span>
        </div>
      </template>
      <template #empty>{{ loading ? 'Reading projects…' : 'No matching worktrees.' }}</template>
    </UCommandPalette>
    <p v-for="message in errors" :key="message" class="inline-error" role="alert">{{ message }}</p>
    <p class="switcher-hint">↑ ↓ Navigate · Enter Open · Esc Close</p>
  </AppDialog>
</template>

<style scoped>
.switcher-result { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; text-align: left; }
.switcher-branch { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.switcher-branch strong { font-size: 16px; overflow-wrap: anywhere; }
.switcher-project { font-size: 13px; color: var(--text); }
.switcher-path { font-size: 12px; line-height: 1.5; color: var(--muted); overflow-wrap: anywhere; white-space: normal; }
.switcher-active { font-size: 12px; color: var(--accent); }
.switcher-current { font-size: 12px; color: var(--muted); }
.switcher-hint { font-size: 12px; color: var(--muted); margin: 14px 0 0; }
</style>
