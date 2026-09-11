<script setup lang="ts">
import type { Task } from '../../shared/types'
const props = defineProps<{ task: Task; busy: boolean }>()
const emit = defineEmits<{ close: []; save: [port?: number] }>()
const port = shallowRef<string>(props.task.port?.toString() || '')
const error = shallowRef('')
function submit() {
  if (props.busy) return
  error.value = ''
  const value = String(port.value).trim()
  const parsed = value ? Number(value) : undefined
  if (parsed !== undefined && (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535)) {
    error.value = 'Enter a whole port number from 1 to 65535, or leave it blank.'
    return
  }
  emit('save', parsed)
}
</script>
<template>
  <AppDialog :title="task.name" :busy="busy" @close="emit('close')">
    <form class="port-form nuxt-ui-scope" @submit.prevent="submit">
      <div class="command-preview mono">{{ [task.command, ...task.args].join(' ') }}</div>
      <UFormField
        label="Exclusive TCP port"
        hint="Optional"
        :error="error"
        :ui="{ label: 'text-[13px]', hint: 'text-[13px]', error: 'text-[13px]' }"
      >
        <UInput
          v-model="port"
          type="number"
          :min="1"
          :max="65535"
          :step="1"
          placeholder="e.g. 3000"
          autofocus
          :disabled="busy"
          class="w-full"
          :ui="{ base: 'text-[14px] min-h-[36px]' }"
        />
      </UFormField>
      <p class="port-description">
        If this task uses a fixed port, Darsena checks that it is free before starting. This setting
        applies to the task in every worktree and does not change the server’s port. Leave blank to
        skip the port check.
      </p>
      <footer class="dialog-actions">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          :disabled="busy"
          class="text-[13px]"
          @click="emit('close')"
          >Cancel</UButton
        >
        <UButton type="submit" :loading="busy" :disabled="busy" class="text-[13px]">Save</UButton>
      </footer>
    </form>
  </AppDialog>
</template>
<style scoped>
.port-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.command-preview {
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.port-description {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
}
</style>
