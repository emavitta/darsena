<script setup lang="ts">
import type { Task } from '../../shared/types'
const props = defineProps<{ task: Task; busy: boolean }>()
const emit = defineEmits<{ close: []; save: [port?: number] }>()
const port = shallowRef(props.task.port?.toString() || '')
</script>
<template>
  <AppDialog :title="task.name" @close="emit('close')"
    ><form class="form-stack" @submit.prevent="emit('save', port ? Number(port) : undefined)">
      <div class="command-preview mono">{{ [task.command, ...task.args].join(' ') }}</div>
      <label
        >Exclusive TCP port <span class="muted">Optional</span
        ><input
          v-model="port"
          v-tooltip="
            'Set the fixed TCP port this task needs, or leave blank to skip the port check.'
          "
          type="number"
          min="1"
          max="65535"
          step="1"
          placeholder="e.g. 3000"
          autofocus
      /></label>
      <p class="form-hint">
        If this task uses a fixed port, Darsena checks that it is free before starting. This setting
        applies to the task in every worktree and does not change the server’s port.
      </p>
      <footer class="dialog-actions">
        <button
          v-tooltip="'Discard changes to this task’s port setting.'"
          class="button"
          type="button"
          @click="emit('close')"
        >
          Cancel</button
        ><button
          v-tooltip="'Apply this port check to the task in every worktree of this project.'"
          class="button primary"
          :disabled="busy"
        >
          Save
        </button>
      </footer>
    </form></AppDialog
  >
</template>
