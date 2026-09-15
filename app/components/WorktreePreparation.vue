<script setup lang="ts">
import type { AppState, Project, Run, Worktree } from '../../shared/types'
const props = defineProps<{ project: Project; worktree: Worktree; runs: Run[]; busy: boolean }>()
const emit = defineEmits<{ start: [id: string]; saved: [state: AppState] }>()
const task = computed(() =>
  props.project.customTasks.find((t) => t.id === props.project.preparationTaskId),
)
const latest = computed(
  () =>
    props.runs
      .filter(
        (r) =>
          r.projectId === props.project.id &&
          r.worktree === props.worktree.path &&
          r.taskId === task.value?.id,
      )
      .sort((a, b) => b.startedAt - a.startedAt)[0],
)
const running = computed(
  () => latest.value && ['starting', 'running', 'stopping'].includes(latest.value.status),
)
const editing = shallowRef(false)
const command = shallowRef('')
const args = shallowRef('')
const saving = shallowRef(false)
const error = shallowRef('')
function edit() {
  command.value = task.value?.command || ''
  args.value = task.value?.args.join('\n') || ''
  error.value = ''
  editing.value = true
}
async function save(remove = false) {
  if (saving.value || (!remove && !command.value.trim())) return
  saving.value = true
  error.value = ''
  try {
    const state = await window.darsena!.call('configurePreparation', {
      projectId: props.project.id,
      command: remove ? '' : command.value.trim(),
      args: remove ? [] : args.value.split(/\r?\n/).filter((x) => x.length),
    })
    emit('saved', state)
    editing.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <section class="preparation nuxt-ui-scope" aria-label="Worktree preparation">
    <div class="preparation-heading">
      <div>
        <strong>Prepare worktree</strong>
        <p class="muted">
          {{
            task ? [task.command, ...task.args].join(' ') : 'Save a setup command for this project.'
          }}
        </p>
      </div>
      <UButton v-if="task" :disabled="busy || !!running" @click="emit('start', task.id)">{{
        running ? 'Preparing…' : 'Prepare'
      }}</UButton>
      <UButton color="neutral" variant="ghost" :disabled="busy" @click="edit">{{
        task ? 'Configure' : 'Set up'
      }}</UButton>
    </div>
    <p v-if="task" class="muted preparation-path">
      Runs at the root of <span class="mono">{{ worktree.path }}</span
      >. Output appears in Activity.
    </p>
    <p v-if="latest" class="muted">
      Last preparation: {{ latest.status }} · {{ new Date(latest.startedAt).toLocaleString() }}.
      This is a command result, not a readiness check.
    </p>
    <AppDialog
      v-if="editing"
      title="Configure worktree preparation"
      :busy="saving"
      @close="editing = false"
    >
      <form class="form-stack nuxt-ui-scope" @submit.prevent="save()">
        <p>
          Saved for {{ project.name }}. Runs only when you click Prepare, in the selected worktree’s
          root.
        </p>
        <UFormField
          label="Executable"
          description="For example: pnpm, bash, or ./scripts/setup.sh. Do not enter a full shell command here."
        >
          <UInput
            v-model="command"
            aria-label="Preparation executable"
            placeholder="pnpm"
            :disabled="saving"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Arguments"
          description="One argument per line. For pnpm install, enter install. For bash, enter the relative script path."
        >
          <UTextarea
            v-model="args"
            aria-label="Preparation arguments"
            :disabled="saving"
            class="w-full"
          />
        </UFormField>
        <p class="muted">
          Darsena does not copy environment files or install dependencies automatically. The command
          you choose controls those changes.
        </p>
        <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
        <footer class="dialog-actions">
          <UButton
            v-if="task"
            color="neutral"
            variant="ghost"
            :disabled="saving"
            @click="save(true)"
            >Remove setup command</UButton
          >
          <UButton color="neutral" variant="ghost" :disabled="saving" @click="editing = false"
            >Cancel</UButton
          >
          <UButton type="submit" :loading="saving" :disabled="!command.trim()"
            >Save command</UButton
          >
        </footer>
      </form>
    </AppDialog>
  </section>
</template>
<style scoped>
.preparation {
  width: 100%;
  padding: 12px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.preparation-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.preparation-heading > div {
  flex: 1;
  min-width: 180px;
}
.preparation p {
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.preparation-path {
  margin-top: 6px;
}
</style>
