<script setup lang="ts">
import type { Run } from '../../shared/types'
import { filterLogcat, type LogLevel } from '../../shared/logcat'
const props = defineProps<{ run: Run; logs: string }>()
const query = shallowRef('')
const level = shallowRef<LogLevel>('V')
const follow = shallowRef(true)
const error = shallowRef('')
const exporting = shallowRef(false)
const output = useTemplateRef('output')
const text = computed(() => filterLogcat(props.logs, query.value, level.value))
const collecting = computed(() => ['running', 'starting'].includes(props.run.status))
const state = computed(() =>
  !collecting.value
    ? 'Collection ended — last observed state'
    : props.run.logcat?.state === 'running'
      ? 'App process detected'
      : props.run.logcat?.state === 'not-running'
        ? 'App process not running'
        : 'Checking app process…',
)
const levels = [
  { label: 'All levels', value: 'V' },
  { label: 'Debug+', value: 'D' },
  { label: 'Info+', value: 'I' },
  { label: 'Warning+', value: 'W' },
  { label: 'Error+', value: 'E' },
  { label: 'Fatal', value: 'F' },
]
watch(text, async () => {
  if (follow.value) {
    await nextTick()
    output.value?.scrollTo({ top: output.value.scrollHeight })
  }
})
async function exportLogs() {
  exporting.value = true
  error.value = ''
  try {
    await window.darsena!.call('exportLogcat', { runId: props.run.id })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    exporting.value = false
  }
}
</script>
<template>
  <div class="logcat-output nuxt-ui-scope">
    <div class="logcat-context">
      <strong>{{ state }}</strong>
      <span
        >{{ run.androidDevice }} · {{ run.androidApplicationId
        }}<template v-if="run.androidVariant"> · {{ run.androidVariant }}</template></span
      >
      <span v-if="run.logcat?.checkedAt"
        >Observed {{ new Date(run.logcat.checkedAt).toLocaleTimeString()
        }}<template v-if="run.logcat.pids.length">
          · PID {{ run.logcat.pids.join(', ') }}</template
        ></span
      >
      <span v-if="run.logcat?.lastCrashAt" class="text-danger"
        >Crash-like log detected (may be from recent history). Inspect the timestamps below.</span
      >
      <span class="muted"
        >Logs follow the installed app, including restarts. This worktree is its launch context;
        another tool may replace the build.</span
      >
    </div>
    <div class="logcat-toolbar">
      <UInput
        v-model="query"
        aria-label="Search Logcat"
        placeholder="Search app logs…"
        icon="i-lucide-search"
        class="logcat-search"
      />
      <USelect v-model="level" :items="levels" aria-label="Logcat minimum level" />
      <UCheckbox v-model="follow" label="Follow" />
      <UButton color="neutral" variant="ghost" :loading="exporting" @click="exportLogs"
        >Export logs</UButton
      >
    </div>
    <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
    <pre ref="output" class="logcat-text">{{ text || 'No matching app logs.' }}</pre>
    <div class="logcat-caption muted">
      Up to 512 Ki characters retained for this session. Stopping collection leaves the Android app
      running.
    </div>
  </div>
</template>
<style scoped>
.logcat-output {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.logcat-context {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 16px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.logcat-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 16px;
  border-block: 1px solid var(--border);
}
.logcat-search {
  flex: 1;
  min-width: 140px;
}
.logcat-text {
  flex: 1;
  min-height: 100px;
  overflow: auto;
  padding: 16px;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.6;
}
.logcat-caption {
  padding: 6px 16px;
  font-size: 12px;
}
</style>
