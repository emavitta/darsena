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
const runningPaths = computed(
  () =>
    new Set(
      props.runs
        .filter((r) => ['running', 'starting', 'stopping'].includes(r.status))
        .map((r) => r.worktree),
    ),
)
</script>
<template>
  <section class="worktree-column">
    <header class="list-heading">
      <h2>
        Worktrees <span class="muted">{{ worktrees.length }}</span>
      </h2>
      <button
        class="icon-button"
        :disabled="loading"
        aria-label="Refresh worktrees"
        v-tooltip="
          loading
            ? 'Reading the worktrees and their Git status…'
            : 'Rescan Git for worktrees and update their local changes.'
        "
        @click="emit('refresh')"
      >
        <AppIcon name="RefreshCw" :class="{ spin: loading }" :size="15" />
      </button>
    </header>
    <label class="search-field"
      ><AppIcon name="Search" :size="15" /><input
        v-model="query"
        data-worktree-search
        placeholder="Find a worktree…"
        aria-label="Find a worktree"
        v-tooltip="'Filter by worktree name, branch or path. Shortcut: ⌘K.'"
      /><kbd>⌘ K</kbd></label
    >
    <p v-if="error" class="inline-error pad" role="alert">{{ error }}</p>
    <div class="worktree-scroll">
      <p v-if="loading && !worktrees.length" class="empty-small">Reading Git worktrees…</p>
      <p v-else-if="!filtered.length" class="empty-small">
        {{ query ? 'No matching worktrees.' : 'No worktrees available.' }}
      </p>
      <button
        v-for="tree in filtered"
        :key="tree.path"
        class="worktree-row"
        :class="{ selected: selected === tree.path, unavailable: !tree.exists || tree.bare }"
        v-tooltip="worktreeSelectionHint(tree)"
        :disabled="!tree.exists || tree.bare"
        @click="emit('select', tree.path)"
      >
        <div class="worktree-name">
          <AppIcon name="GitFork" :size="16" /><strong class="truncate">{{ tree.name }}</strong
          ><span
            v-if="runningPaths.has(tree.path)"
            class="status-dot"
            v-tooltip="
              'Darsena has a running, starting or stopping task in this worktree. See Activity for details.'
            "
          /><AppIcon v-if="selected === tree.path" name="ChevronRight" :size="14" />
        </div>
        <div
          v-tooltip="
            tree.branch
              ? `Checked-out branch: ${tree.branch}`
              : tree.bare
                ? 'This repository has no working files.'
                : 'This worktree points directly to a commit, rather than a branch.'
          "
          class="worktree-branch truncate"
        >
          {{ tree.branch || (tree.bare ? 'Bare repository' : 'Detached HEAD') }}
        </div>
        <div class="worktree-meta">
          <span v-if="tree.main" v-tooltip="'The repository’s main working folder.'"
            >Main checkout</span
          ><span v-else-if="!tree.exists" v-tooltip="worktreeStatusHint(tree)">Folder missing</span
          ><span
            v-else-if="tree.locked"
            v-tooltip="`Git protects this worktree from pruning or removal.\n${tree.locked}`"
            >Locked</span
          ><span v-else v-tooltip="`Current commit: ${tree.head}`">{{ tree.head.slice(0, 7) }}</span
          ><span v-if="tree.error" v-tooltip="worktreeStatusHint(tree)">Status unknown</span
          ><span v-else-if="tree.changed" v-tooltip="worktreeStatusHint(tree)" class="modified"
            ><i />{{ tree.changed }} changed</span
          ><span v-else-if="tree.changed === 0" v-tooltip="worktreeStatusHint(tree)" class="clean"
            >Clean</span
          >
        </div>
      </button>
    </div>
    <footer class="column-foot">
      <AppIcon name="GitBranch" :size="13" />Discovered directly from Git
    </footer>
  </section>
</template>
