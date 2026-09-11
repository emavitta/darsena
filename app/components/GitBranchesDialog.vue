<script setup lang="ts">
import type { GitState } from '../../shared/types'
const props = defineProps<{ state: GitState; worktree: string }>()
const emit = defineEmits<{ close: []; navigate: [path: string] }>()
const query = shallowRef('')
const groups = computed(() => [true, false].map(local => ({
  label: local ? 'Local branches' : 'Remote branches',
  branches: props.state.branches.filter(branch => branch.local === local && `${branch.name} ${branch.worktrees.join(' ')}`.toLowerCase().includes(query.value.trim().toLowerCase())),
})))
</script>
<template>
  <AppDialog title="Branches" wide @close="emit('close')">
    <div class="nuxt-ui-scope git-branches">
      <UInput v-model="query" icon="i-lucide-search" placeholder="Find branch or worktree…" aria-label="Find branch or worktree" class="branch-search" autofocus />
      <p class="muted">Branches are shared by this project. Selecting a worktree opens its view without changing its checked-out branch.</p>
      <section v-for="group in groups" :key="group.label">
        <h3>{{ group.label }} <span class="muted">{{ group.branches.length }}</span></h3>
        <p v-if="!group.branches.length" class="muted">No matching branches.</p>
        <div v-for="branch in group.branches" :key="branch.ref" class="git-branch-row">
          <div class="branch-name"><UIcon :name="branch.local ? 'i-lucide-git-branch' : 'i-lucide-cloud'" /><strong>{{ branch.name }}</strong><span v-if="branch.local && branch.name === state.branch" class="muted">Current</span></div>
          <div v-if="branch.upstream" class="muted">Tracks {{ branch.upstream }}</div>
          <div v-for="folder in branch.worktrees" :key="folder" class="branch-location">
            <span class="mono">{{ folder }}</span>
            <UButton v-if="folder !== worktree" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" :aria-label="`View worktree for ${branch.name}`" @click="emit('navigate', folder)">View worktree</UButton>
          </div>
          <span v-if="branch.local && !branch.worktrees.length" class="muted">Not checked out in a worktree</span>
        </div>
      </section>
    </div>
  </AppDialog>
</template>
<style scoped>
.git-branches { display: grid; gap: 16px; }
.branch-search { width: 100%; }
h3 { font-size: 14px; margin: 0 0 8px; }
.git-branch-row { padding: 12px 0; border-top: 1px solid var(--line); display: grid; gap: 6px; font-size: 13px; }
.branch-name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.branch-name strong { font-size: 15px; overflow-wrap: anywhere; }
.branch-location { display: flex; align-items: center; gap: 12px; }
.branch-location .mono { flex: 1; overflow-wrap: anywhere; min-width: 0; }
</style>
