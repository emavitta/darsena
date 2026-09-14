<script setup lang="ts">
import type { Run, Worktree } from '../../shared/types'
const props = defineProps<{
  worktrees: Worktree[]
  selected?: string
  loading: boolean
  runs: Run[]
  error?: string
}>()
const emit = defineEmits<{ select: [path: string]; refresh: [] }>()
const query = shallowRef('')
const filtered = computed(() =>
  props.worktrees.filter((tree) =>
    `${tree.name} ${tree.branch || ''} ${tree.path}`
      .toLowerCase()
      .includes(query.value.toLowerCase()),
  ),
)
const activeCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const run of props.runs) {
    if (['running', 'starting', 'stopping'].includes(run.status)) {
      counts.set(run.worktree, (counts.get(run.worktree) || 0) + 1)
    }
  }
  return counts
})
</script>
<template>
  <section class="worktree-column">
    <header class="list-heading">
      <h2>
        Worktrees <span class="muted">{{ worktrees.length }}</span>
      </h2>
      <AppTooltip :text="
          loading
            ? 'Reading the worktrees and their Git status…'
            : 'Rescan Git for worktrees and update their local changes.'
        "><button
        class="icon-button"
        :disabled="loading"
        aria-label="Refresh worktrees"
        
        @click="emit('refresh')"
      >
        <AppIcon name="RefreshCw" :class="{ spin: loading }" :size="15" />
      </button></AppTooltip>
    </header>
    <label class="search-field"
      ><AppIcon name="Search" :size="15" /><AppTooltip :text="'Filter this project by worktree name, branch or path.'"><input
        v-model="query"
        data-worktree-search
        placeholder="Find a worktree…"
        aria-label="Find a worktree"
        
      /></AppTooltip></label
    >
    <p v-if="error" class="inline-error pad" role="alert">{{ error }}</p>
    <div class="worktree-scroll">
      <p v-if="loading && !worktrees.length" class="empty-small">Reading Git worktrees…</p>
      <p v-else-if="!filtered.length" class="empty-small">
        {{ query ? 'No matching worktrees.' : 'No worktrees available.' }}
      </p>
      <AppTooltip :text="worktreeSelectionHint(tree)" v-for="tree in filtered" :key="tree.path"><button
        class="worktree-row"
        :class="{ selected: selected === tree.path, unavailable: !tree.exists || tree.bare }"
        
        :disabled="!tree.exists || tree.bare"
        :aria-current="selected === tree.path ? 'true' : undefined"
        @click="emit('select', tree.path)"
      >
        <div class="worktree-name">
          <AppIcon name="GitBranch" :size="18" />
          <strong>{{ tree.branch || (tree.bare ? 'Bare repository' : 'Detached HEAD') }}</strong>
          <AppIcon v-if="selected === tree.path" name="ChevronRight" :size="16" />
        </div>
        <div class="worktree-folder"><AppIcon name="Folder" :size="14" />{{ tree.name }}</div>
        <div class="worktree-path mono">{{ tree.path }}</div>
        <AppTooltip :text="'Tasks running, starting or stopping in this worktree. See Activity for details.'" v-if="activeCounts.has(tree.path)"><div
          
          class="worktree-active"
          
        >
          <span class="status-dot" />
          {{ activeCounts.get(tree.path) }} active {{ activeCounts.get(tree.path) === 1 ? 'task' : 'tasks' }}
        </div></AppTooltip>
        <div class="worktree-meta">
          <AppTooltip :text="'The repository’s main working folder.'" v-if="tree.main"><span  
            >Main checkout</span
          ></AppTooltip><AppTooltip :text="worktreeStatusHint(tree)" v-else-if="!tree.exists"><span  >Folder missing</span
          ></AppTooltip><AppTooltip :text="`Git protects this worktree from pruning or removal.\n${tree.locked}`" v-else-if="tree.locked"><span
            
            
            >Locked</span
          ></AppTooltip><AppTooltip :text="`Current commit: ${tree.head}`" v-else><span  >{{ tree.head.slice(0, 7) }}</span
          ></AppTooltip><AppTooltip :text="worktreeStatusHint(tree)" v-if="tree.error"><span  >Status unknown</span
          ></AppTooltip><AppTooltip :text="worktreeStatusHint(tree)" v-else-if="tree.changed"><span   class="modified"
            ><i />{{ tree.changed }} changed</span
          ></AppTooltip><AppTooltip :text="worktreeStatusHint(tree)" v-else-if="tree.changed === 0"><span   class="clean"
            >Clean</span
          ></AppTooltip>
        </div>
      </button></AppTooltip>
    </div>
    <footer class="column-foot">
      <AppIcon name="GitBranch" :size="13" />Discovered directly from Git
    </footer>
  </section>
</template>

<style scoped>
.worktree-column {
  width: clamp(290px, 25vw, 350px);
}
.search-field input {
  font-size: 13px;
}
.worktree-row {
  padding: 17px 13px;
  margin-bottom: 7px;
}
.worktree-row.selected {
  border-color: var(--accent);
  box-shadow: inset 3px 0 var(--accent);
}
.worktree-name {
  align-items: flex-start;
  font-size: 16px;
  line-height: 1.4;
  color: var(--text);
}
.worktree-name strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.worktree-name > .icon {
  flex-shrink: 0;
  margin-top: 3px;
}
.worktree-folder {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  font-size: 14px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.worktree-folder > .icon {
  flex-shrink: 0;
  color: var(--muted);
}
.worktree-path {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.worktree-active {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  font-weight: 600;
  font-size: 12px;
  margin-top: 12px;
}
.worktree-meta {
  padding-left: 0;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
  font-size: 12px;
  line-height: 1.4;
}
.column-foot {
  font-size: 12px;
}
</style>
