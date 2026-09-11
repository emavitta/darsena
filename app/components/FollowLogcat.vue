<script setup lang="ts">
import type { Run } from '../../shared/types'
const props = defineProps<{ run: Run }>()
const emit = defineEmits<{ started: [id: string] }>()
const busy = shallowRef(false)
const error = shallowRef('')
async function start() {
  busy.value = true
  error.value = ''
  try {
    const run = await window.darsena!.call('startLogcat', { runId: props.run.id })
    emit('started', run.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="follow-logcat nuxt-ui-scope">
    <UButton color="neutral" variant="outline" :loading="busy" @click="start"
      >Follow Logcat</UButton
    >
    <span class="muted">{{ run.androidApplicationId }} · {{ run.androidDevice }}</span>
    <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
  </div>
</template>
<style scoped>
.follow-logcat {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
</style>
