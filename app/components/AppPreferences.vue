<script setup lang="ts">
import type { AppState, AppId } from '../../shared/types'
defineProps<{ state: AppState }>()
const emit = defineEmits<{ close: []; chooseApp: [app: Exclude<AppId, 'finder'>] }>()
const tab = shallowRef<'apps' | 'mcp'>('apps')
</script>

<template>
  <AppDialog class="preferences-dialog" title="Preferences" wide @close="emit('close')">
    <nav class="segmented preference-tabs" aria-label="Preference sections">
      <button
        :class="{ active: tab === 'apps' }"
        :aria-pressed="tab === 'apps'"
        @click="tab = 'apps'"
      >
        Applications</button
      ><button
        :class="{ active: tab === 'mcp' }"
        :aria-pressed="tab === 'mcp'"
        @click="tab = 'mcp'"
      >
        MCP
      </button>
    </nav>
    <McpSettings v-if="tab === 'mcp'" :projects="state.projects" />
    <div v-else class="form-stack">
      <p class="muted">Choose the applications used by folder shortcuts.</p>
      <div
        v-for="entry in [
          { id: 'vscode' as const, label: 'VS Code' },
          { id: 'terminal' as const, label: 'Terminal' },
          { id: 'android-studio' as const, label: 'Android Studio' },
        ]"
        :key="entry.id"
        class="preference-row"
      >
        <div>
          <strong>{{ entry.label }}</strong
          ><span
            v-tooltip="state.apps[entry.id] || `Use the default ${entry.label} application.`"
            class="mono muted"
            >{{ state.apps[entry.id] || 'Default application' }}</span
          >
        </div>
        <button
          v-tooltip="
            `Choose the macOS application used for ${entry.label} folder shortcuts. Saved immediately.`
          "
          class="button small"
          @click="emit('chooseApp', entry.id)"
        >
          Choose…
        </button>
      </div>
      <div class="preference-note">
        <AppIcon name="Info" :size="17" />
        <p>
          Closing the window keeps your tasks running. Quitting Darsena stops the tasks it started.
          External processes stay independent.
        </p>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
:deep(.dialog-header) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg);
}
.preference-tabs {
  width: fit-content;
  margin-bottom: 24px;
}
</style>
