<script setup lang="ts">
import type { EnvironmentCheck } from '../../shared/types'
const props = defineProps<{ projectId: string; worktree: string }>()
const checks = shallowRef<EnvironmentCheck[]>()
const busy = ref(false)
const error = ref('')
async function inspect() {
  busy.value = true
  error.value = ''
  try {
    if (!window.darsena) throw new Error('Available in the desktop app.')
    checks.value = await window.darsena.call('environment', {
      projectId: props.projectId,
      worktree: props.worktree,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <details class="environment-checks">
    <summary>Environment</summary>
    <p class="muted">
      Check executable paths available to Darsena for this worktree. No build or setup command is
      run.
    </p>
    <UButton class="nuxt-ui-scope" color="neutral" variant="soft" :loading="busy" @click="inspect"
      >Check environment</UButton
    >
    <p v-if="error" role="alert">{{ error }}</p>
    <ul v-if="checks" aria-live="polite">
      <li v-for="check in checks" :key="check.name">
        <strong>{{ check.name }} · {{ check.path ? 'Found' : 'Not found' }}</strong>
        <code v-if="check.path">{{ check.path }}</code>
        <span class="muted">{{ check.hint }}</span>
      </li>
    </ul>
  </details>
</template>
<style scoped>
.environment-checks {
  width: 100%;
  margin-bottom: 20px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
summary {
  cursor: pointer;
  font-weight: 600;
}
p {
  margin: 10px 0;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: grid;
  gap: 5px;
  padding: 10px 0;
}
code {
  overflow-wrap: anywhere;
}
</style>
