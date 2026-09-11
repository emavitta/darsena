<script setup lang="ts">
import type { CustomTask, Folder } from '../../shared/types'
import { shellScriptCommand, type ScriptShell } from '../utils/customCommands'

const props = defineProps<{ folders: Folder[]; busy: boolean }>()
const emit = defineEmits<{ close: []; save: [task: Omit<CustomTask, 'id'>] }>()
const name = shallowRef('')
const folder = shallowRef('.')
const mode = shallowRef<'command' | 'script'>('command')
const command = shallowRef('')
const script = shallowRef('')
const shell = shallowRef<ScriptShell>('bash')
const args = shallowRef('')
const error = shallowRef('')
const preview = computed(() =>
  taskTool({
    kind: 'custom',
    command: mode.value === 'script' ? shell.value : command.value.trim(),
  }),
)
watch([mode, script, shell], () => {
  error.value = ''
})
function submit() {
  if (props.busy) return
  error.value = ''
  if (!name.value.trim() || (mode.value === 'command' && !command.value.trim())) {
    error.value = 'Enter a display name and an executable.'
    return
  }
  try {
    const parsed = args.value.split(/\r?\n/u).filter((value) => value.length > 0)
    const invocation =
      mode.value === 'script'
        ? shellScriptCommand(script.value, shell.value, parsed)
        : { command: command.value.trim(), args: parsed }
    emit('save', { name: name.value.trim(), folder: folder.value, ...invocation })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AppDialog title="Add a custom command" :busy="busy" @close="emit('close')">
    <form class="custom-command-form nuxt-ui-scope" @submit.prevent="submit">
      <URadioGroup
        v-model="mode"
        legend="Command type"
        name="command-type"
        :items="[
          { value: 'command', label: 'Command' },
          { value: 'script', label: 'Shell script' },
        ]"
        orientation="horizontal"
        variant="card"
        :disabled="busy"
        :ui="{ label: 'text-[13px]', legend: 'text-[13px] font-medium', item: 'flex-1' }"
      />
      <UFormField label="Display name" required :ui="{ label: 'text-[13px]' }">
        <UInput
          aria-label="Display name"
          v-model="name"
          required
          placeholder="Run tests"
          autofocus
          :disabled="busy"
          class="w-full"
          :ui="{ base: 'text-[14px] min-h-[36px]' }"
        />
      </UFormField>
      <label class="native-choice">
        Working folder
        <select v-model="folder" :disabled="busy">
          <option v-for="entry in folders" :key="entry.id" :value="entry.path">
            {{ entry.label }} · {{ entry.path }}
          </option>
        </select>
      </label>
      <template v-if="mode === 'script'">
        <UFormField
          label="Script path"
          required
          description="Relative to the working folder. Spaces are allowed; do not add quotes."
          :ui="{ label: 'text-[13px]', description: 'text-[13px]' }"
        >
          <UInput
            aria-label="Script path"
            v-model="script"
            required
            placeholder="scripts/dev.sh"
            :spellcheck="false"
            :disabled="busy"
            class="w-full"
            :ui="{ base: 'text-[14px] min-h-[36px]' }"
          />
        </UFormField>
        <label class="native-choice">
          Run with
          <select v-model="shell" :disabled="busy">
            <option value="bash">Bash</option>
            <option value="zsh">Zsh</option>
            <option value="sh">Sh (POSIX)</option>
          </select>
          <span class="field-description"
            >Choose the shell this script needs. Executable permission is not required.</span
          >
        </label>
      </template>
      <UFormField
        v-else
        label="Executable"
        required
        description="Name or path without arguments, such as cargo or ./gradlew."
        :ui="{ label: 'text-[13px]', description: 'text-[13px]' }"
      >
        <UInput
          aria-label="Executable"
          v-model="command"
          required
          placeholder="cargo, python3, ./gradlew…"
          :spellcheck="false"
          :disabled="busy"
          class="w-full"
          :ui="{ base: 'text-[14px] min-h-[36px]' }"
        />
      </UFormField>
      <UFormField
        label="Arguments"
        hint="Optional"
        description="One argument per line, without surrounding quotes. Spaces stay in that argument; shell operators are not expanded."
        :ui="{ label: 'text-[13px]', hint: 'text-[13px]', description: 'text-[13px]' }"
      >
        <UTextarea
          v-model="args"
          :rows="3"
          :spellcheck="false"
          :placeholder="mode === 'script' ? '--watch' : 'test'"
          :disabled="busy"
          class="w-full"
          :ui="{ base: 'text-[14px] min-h-[36px]' }"
        />
      </UFormField>
      <div class="command-preview">
        <TaskToolBadge :tool="preview" />
        <p class="field-description">
          {{
            mode === 'script'
              ? 'Uses this script from the selected worktree.'
              : 'Runs in the selected worktree. Use Shell script for a .sh file or multi-step setup.'
          }}
        </p>
      </div>
      <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
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
        <UButton type="submit" :loading="busy" :disabled="busy" class="text-[13px]"
          >Add command</UButton
        >
      </footer>
    </form>
  </AppDialog>
</template>

<style scoped>
.custom-command-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.native-choice {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
}
.native-choice select {
  width: 100%;
  font-size: 14px;
  font-weight: 400;
}
.field-description {
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.55;
  margin: 0;
}
.command-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}
.command-preview .task-tool-badge {
  flex-shrink: 0;
}
</style>
