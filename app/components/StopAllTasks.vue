<script setup lang="ts">
import type { Run } from '../../shared/types'
import { runFolderLabel } from '../../shared/run-labels'
const props = defineProps<{ runs: Run[] }>()
const active = computed(() => props.runs.filter(run => ['starting', 'running'].includes(run.status)))
const snapshot = shallowRef<Run[]>()
const stopping = shallowRef(false)
const error = shallowRef('')
function review() {
  snapshot.value = [...active.value]
  error.value = ''
}
async function stopAll() {
  if (stopping.value || !snapshot.value) return
  stopping.value = true
  error.value = ''
  const results = await Promise.allSettled(snapshot.value.map(run => window.darsena!.call('stop', { runId: run.id })))
  const failures = results.flatMap((result, index) => result.status === 'rejected' ? [`${snapshot.value![index]!.name}: ${String(result.reason)}`] : [])
  stopping.value = false
  if (failures.length) error.value = failures.join('\n')
  else snapshot.value = undefined
}
</script>
<template>
  <UButton color="neutral" variant="ghost" icon="i-lucide-square" :disabled="!active.length || stopping" @click="review">Stop all · {{ active.length }}</UButton>
  <AppDialog v-if="snapshot" title="Stop all tasks?" :busy="stopping" @close="snapshot = undefined">
    <div class="form-stack nuxt-ui-scope">
      <p>Stop these {{ snapshot.length }} Darsena-managed tasks across all projects. Tasks started after this list was opened are not included.</p>
      <ul class="stop-task-list">
        <li v-for="run in snapshot" :key="run.id"><strong>{{ runFolderLabel(run) }} · {{ run.name }}</strong><span>{{ run.projectName }} · {{ run.worktreeBranch || run.worktreeName }}</span></li>
      </ul>
      <p class="muted">External services and detached daemons such as Portless are not stopped. Android apps already installed on a device keep running.</p>
      <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
      <div class="dialog-actions"><UButton color="neutral" variant="ghost" :disabled="stopping" @click="snapshot = undefined">Cancel</UButton><UButton color="error" :loading="stopping" :disabled="stopping" @click="stopAll">Stop {{ snapshot.length }} tasks</UButton></div>
    </div>
  </AppDialog>
</template>
<style scoped>
.stop-task-list { max-height: 260px; overflow: auto; padding: 0; list-style: none; }
.stop-task-list li { padding: 9px 0; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
.stop-task-list span { display: block; color: var(--muted); margin-top: 3px; }
</style>
