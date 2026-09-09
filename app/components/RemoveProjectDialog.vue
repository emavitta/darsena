<script setup lang="ts">
import type { Project } from '../../shared/types'

defineProps<{ project: Project; running: number; busy: boolean; error: string }>()
const emit = defineEmits<{ close: []; confirm: []; activity: [] }>()
const descriptionId = useId()
</script>

<template>
  <AppDialog
    title="Remove project?"
    :busy="busy"
    :aria-describedby="descriptionId"
    @close="emit('close')"
  >
    <div class="removal-content">
      <div class="removal-project">
        <div class="removal-project-icon"><AppIcon name="Folder" :size="22" /></div>
        <div class="removal-project-identity">
          <strong class="removal-project-name">{{ project.name }}</strong>
          <span class="removal-project-path mono">{{ project.root }}</span>
        </div>
      </div>
      <div :id="descriptionId" class="removal-description">
        <p>
          This removes the project and its saved settings from Darsena, including folder shortcuts,
          task favorites and custom commands.
        </p>
        <p class="removal-files">Your files and Git worktrees stay on your computer.</p>
        <p>You can add the repository again later.</p>
      </div>
      <div v-if="running" class="removal-running" role="status">
        <AppIcon name="Activity" :size="18" />
        <div>
          <strong>{{ running }} {{ running === 1 ? 'task is' : 'tasks are' }} still running</strong>
          <p>Stop this project’s tasks in Activity before removing it.</p>
        </div>
      </div>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <footer class="dialog-actions">
        <button class="button" autofocus :disabled="busy" @click="emit('close')">Cancel</button>
        <button v-if="running" class="button primary" :disabled="busy" @click="emit('activity')">
          <AppIcon name="Activity" :size="15" />View Activity
        </button>
        <button v-else class="button removal-confirm" :disabled="busy" @click="emit('confirm')">
          <AppIcon :name="busy ? 'LoaderCircle' : 'Trash2'" :size="15" />
          {{ busy ? 'Removing…' : 'Remove from Darsena' }}
        </button>
      </footer>
    </div>
  </AppDialog>
</template>

<style scoped>
.removal-content {
  display: grid;
  gap: 22px;
}
.removal-project {
  display: flex;
  gap: 13px;
  align-items: flex-start;
}
.removal-project-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: var(--accent);
  background: var(--accent-soft);
}
.removal-project-identity {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding-top: 2px;
}
.removal-project-name {
  font-size: 16px;
  font-weight: 550;
  overflow-wrap: anywhere;
}
.removal-project-path {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.removal-description {
  display: grid;
  gap: 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.removal-files {
  color: var(--text);
  font-weight: 500;
}
.removal-running {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--pane);
  font-size: 12px;
  line-height: 1.6;
}
.removal-running > .icon {
  margin-top: 2px;
  color: var(--accent);
}
.removal-running strong {
  font-weight: 500;
}
.removal-running p {
  color: var(--muted);
  font-size: 11px;
  margin-top: 4px;
}
.removal-confirm {
  background: var(--danger-soft);
  border-color: var(--danger-soft);
  color: var(--danger);
}
.removal-confirm:hover:not(:disabled) {
  background: var(--danger-soft);
  border-color: var(--danger);
}
</style>
