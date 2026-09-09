<script setup lang="ts">
import type { CustomTask, Folder } from '../../shared/types'
import { shellScriptCommand, type ScriptShell } from '../utils/customCommands'

defineProps<{ folders: Folder[]; busy: boolean }>()
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
  <AppDialog title="Add a custom command" @close="emit('close')">
    <form class="form-stack" @submit.prevent="submit">
      <fieldset class="command-type">
        <legend class="sr-only">Command type</legend>
        <label v-tooltip="'Save any executable with its arguments.'">
          <input v-model="mode" type="radio" value="command" name="command-type" />
          <TaskToolIcon icon="command" /> Command
        </label>
        <label v-tooltip="'Run a script file from the selected worktree with Bash, Zsh or Sh.'">
          <input v-model="mode" type="radio" value="script" name="command-type" />
          <TaskToolIcon icon="shell" /> Shell script
        </label>
      </fieldset>
      <label>
        Display name
        <input
          v-tooltip="'A recognizable name for this command in the task list.'"
          v-model="name"
          required
          placeholder="Run tests"
          autofocus
        />
      </label>
      <label>
        Working folder
        <select
          v-tooltip="'Run from this folder inside whichever worktree you select.'"
          v-model="folder"
        >
          <option v-for="entry in folders" :key="entry.id" :value="entry.path">
            {{ entry.label }} · {{ entry.path }}
          </option>
        </select>
      </label>
      <template v-if="mode === 'script'">
        <label>
          Script path
          <input
            v-model="script"
            v-tooltip="
              'Path relative to the working folder. Spaces are allowed; do not add quotes.'
            "
            required
            placeholder="scripts/dev.sh"
            spellcheck="false"
          />
        </label>
        <label>
          Run with
          <select
            v-model="shell"
            v-tooltip="
              'Choose the shell this script was written for. The file does not need executable permission.'
            "
          >
            <option value="bash">Bash</option>
            <option value="zsh">Zsh</option>
            <option value="sh">Sh (POSIX)</option>
          </select>
        </label>
      </template>
      <label v-else>
        Executable
        <input
          v-model="command"
          v-tooltip="
            'The executable name or path, without arguments. For example: cargo or ./gradlew.'
          "
          required
          placeholder="cargo, python3, ./gradlew…"
          spellcheck="false"
        />
      </label>
      <label>
        Arguments <span class="muted">One per line · optional</span>
        <textarea
          v-model="args"
          v-tooltip="
            'One argument per line, without surrounding quotes. Spaces stay in that argument. Shell operators are not expanded.'
          "
          rows="3"
          spellcheck="false"
          :placeholder="mode === 'script' ? '--watch' : 'test'"
        />
      </label>
      <div class="command-preview">
        <TaskToolBadge :tool="preview" />
        <p class="form-hint">
          {{
            mode === 'script'
              ? 'Uses this script from the selected worktree. Choose the shell your script needs.'
              : 'Runs in the selected worktree. Use Shell script for a .sh file or multi-step setup.'
          }}
        </p>
      </div>
      <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
      <footer class="dialog-actions">
        <button
          v-tooltip="'Discard this unsaved command.'"
          type="button"
          class="button"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          v-tooltip="'Save and favorite this command for the project. It does not run yet.'"
          class="button primary"
          :disabled="busy"
        >
          Add command
        </button>
      </footer>
    </form>
  </AppDialog>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.command-type {
  display: flex;
  gap: 8px;
  border: 0;
  padding: 0;
  margin: 0;
}
.command-type label {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}
.command-type label:has(input:checked) {
  border-color: var(--accent);
  background: var(--surface);
}
.command-type input {
  width: auto;
  margin: 0;
  accent-color: var(--accent);
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
