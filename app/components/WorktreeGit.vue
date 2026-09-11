<script setup lang="ts">
import type { Project, Run, Worktree, GitAction } from '../../shared/types'
const props = defineProps<{ project: Project; worktree: Worktree; runs: Run[] }>()
const emit = defineEmits<{ changed: []; navigate: [path: string] }>()
const { state, loading, busy, error, notice, refresh, run } = useWorktreeGit(() => ({
  projectId: props.project.id, worktree: props.worktree.path,
  revision: `${props.worktree.head}:${props.worktree.branch}:${props.worktree.changed}`,
}))
const branchesOpen = shallowRef(false)
watch(() => props.worktree.path, () => { branchesOpen.value = false })
const pullReason = computed(() => {
  if (!state.value?.branch || !state.value.head) return 'Pull requires a checked-out branch with commits.'
  if (state.value.operation) return 'Finish the Git operation in progress before pulling.'
  if (state.value.dirty) return 'Commit or stash local changes in your Git tool before pulling.'
  if (!state.value.upstream) return 'Set an upstream for this branch in your Git tool first.'
  if (state.value.ahead === undefined) return 'Upstream is unavailable locally. Fetch to update remote references.'
  if (state.value.ahead && state.value.behind) return 'Branches have diverged. Resolve this in your Git tool; Darsena never merges or rebases.'
  if (props.runs.some(run => run.worktree === props.worktree.path && ['starting', 'running', 'stopping'].includes(run.status))) return 'Stop tasks running in this worktree before pulling.'
  return ''
})
async function execute(action: GitAction) { await run(action); emit('changed') }
function navigate(path: string) { branchesOpen.value = false; emit('navigate', path) }
</script>
<template>
  <section class="worktree-git nuxt-ui-scope" aria-label="Git actions">
    <div class="git-toolbar">
      <div class="tracking" v-tooltip="'Comparison uses locally known remote references. Fetch to check the remote.'">
        <template v-if="state?.upstream"><span class="mono">{{ state.upstream }}</span><span v-if="state.ahead !== undefined">↑ {{ state.ahead }} ahead · ↓ {{ state.behind }} behind</span><span v-else>Upstream unavailable</span></template>
        <span v-else>{{ loading ? 'Reading Git…' : state?.branch ? 'No upstream configured' : 'Detached HEAD or no commits' }}</span>
      </div>
      <div class="git-buttons">
        <UButton color="neutral" variant="ghost" icon="i-lucide-git-branch" :disabled="!state || !!busy" @click="branchesOpen = true">Branches</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-cloud-download" :loading="busy === 'fetch'" :disabled="loading || !!busy || !state?.remotes.length" v-tooltip="'Fetch all remotes for this project. No working files are changed.'" @click="execute('fetch')">Fetch</UButton>
        <span v-tooltip="pullReason || 'Fetch the upstream and fast-forward only this worktree. No merge, rebase or automatic stash.'">
          <UButton color="neutral" variant="soft" icon="i-lucide-arrow-down" :loading="busy === 'pull'" :disabled="loading || !!busy || !!pullReason" @click="execute('pull')">Pull (ff-only)</UButton>
        </span>
        <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" aria-label="Refresh Git status" :loading="loading" :disabled="!!busy" v-tooltip="'Refresh local Git status without contacting the remote.'" @click="refresh" />
      </div>
    </div>
    <p v-if="error" role="alert" class="git-error">{{ error }}</p>
    <p v-else-if="notice" role="status" class="git-notice">{{ notice }}</p>
    <GitBranchesDialog v-if="branchesOpen && state" :state="state" :worktree="worktree.path" @close="branchesOpen = false" @navigate="navigate" />
  </section>
</template>
<style scoped>
.worktree-git { margin-top: 12px; }
.git-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tracking { display: flex; flex-wrap: wrap; gap: 8px; flex: 1 1 180px; min-width: 0; font-size: 12px; color: var(--muted); }
.tracking .mono { overflow-wrap: anywhere; }
.git-buttons { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.git-error, .git-notice { font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; margin: 10px 0 0; }
.git-error { color: var(--danger); }
.git-notice { color: var(--muted); }
</style>
