<script setup lang="ts">
import type { ListenerReport, Run } from '../../shared/types'
const props = defineProps<{
  runs: Run[]
  selected?: string
  logs: string
  report: ListenerReport
  scanning: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  inspect: [id: string]
  stop: [id: string]
  scan: []
  stopExternal: [pid: number, port: number]
  openUrl: [url: string]
  locate: [run: Run]
}>()
const tab = shallowRef<'runs' | 'ports'>('runs')
const allPorts = shallowRef(false)
const follow = shallowRef(true)
const logElement = useTemplateRef('logElement')
const current = computed(() => props.runs.find((r) => r.id === props.selected))
const activeRuns = computed(() =>
  props.runs.filter((r) => ['running', 'starting', 'stopping'].includes(r.status)),
)
const visibleListeners = computed(() =>
  props.report.listeners.filter((l) => allPorts.value || l.projectId),
)
const cleanedLogs = computed(() =>
  props.logs
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\r(?!\n)/g, '\n'),
)
function status(run: Run) {
  return {
    running: 'Running',
    starting: 'Starting',
    stopping: 'Stopping',
    stopped: 'Stopped',
    succeeded: 'Completed',
    failed: 'Failed',
  }[run.status]
}
function duration(run: Run) {
  const seconds = Math.max(0, Math.floor(((run.endedAt || Date.now()) - run.startedAt) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
watch(
  () => props.logs,
  async () => {
    if (follow.value) {
      await nextTick()
      logElement.value?.scrollTo({ top: logElement.value.scrollHeight })
    }
  },
)
function showPorts() {
  tab.value = 'ports'
  emit('scan')
}
</script>
<template>
  <main class="activity-panel">
    <header class="activity-header">
      <div>
        <div class="eyebrow">Across your worktrees</div>
        <h1>Activity</h1>
        <p class="muted">
          {{ activeRuns.length }} {{ activeRuns.length === 1 ? 'task is' : 'tasks are' }} running.
          Every process has a place.
        </p>
      </div>
      <div class="segmented">
        <button
          v-tooltip="'Inspect tasks started by Darsena and read their output for this app session.'"
          :class="{ active: tab === 'runs' }"
          @click="tab = 'runs'"
        >
          Task runs</button
        ><button
          v-tooltip="'Find processes using TCP ports, including servers started outside Darsena.'"
          :class="{ active: tab === 'ports' }"
          @click="showPorts"
        >
          Listening ports
        </button>
      </div>
    </header>
    <div v-if="tab === 'runs'" class="activity-content">
      <section class="run-list">
        <div v-if="!runs.length" class="empty-small">
          <AppIcon name="Activity" :size="28" />
          <h3>No task runs yet.</h3>
          <p>Run a task from any worktree.<br />Its status and logs will appear here.</p>
        </div>
        <button
          v-for="run in runs"
          :key="run.id"
          class="run-entry"
          :class="{ selected: run.id === selected }"
          v-tooltip="
            `View output and status for ${run.name}.\n${run.projectName} / ${run.worktreeName}`
          "
          @click="emit('inspect', run.id)"
        >
          <div class="run-entry-top">
            <span
              class="status-dot"
              :class="{
                neutral: !['running', 'starting', 'stopping'].includes(run.status),
                danger: run.status === 'failed',
              }"
            /><strong class="truncate">{{ run.name }}</strong
            ><span
              v-tooltip="
                'Elapsed time from task start to completion, or until now if still active.'
              "
              class="run-duration"
              >{{ duration(run) }}</span
            >
          </div>
          <div class="run-context truncate">{{ run.projectName }} / {{ run.worktreeName }}</div>
          <div class="run-entry-bottom">
            <span :class="{ 'text-danger': run.status === 'failed' }">{{ status(run) }}</span
            ><span v-if="run.port" v-tooltip="'The fixed TCP port configured for this task.'"
              >:{{ run.port }}</span
            ><span
              v-else-if="run.exitCode != null"
              v-tooltip="
                run.exitCode === 0
                  ? 'The command exited successfully.'
                  : `The command exited with code ${run.exitCode}. Check its output for details.`
              "
              >exit {{ run.exitCode }}</span
            >
          </div>
        </button>
      </section>
      <section v-if="current" class="run-inspector">
        <header class="log-header">
          <div>
            <h3>{{ current.name }}</h3>
            <button
              v-tooltip="`Jump to the worktree where this task ran.\n${current.worktree}`"
              class="text-button muted"
              @click="emit('locate', current)"
            >
              <AppIcon name="GitFork" :size="13" />{{ current.worktreeName
              }}<AppIcon name="ArrowUpRight" :size="12" />
            </button>
          </div>
          <button
            v-if="['running', 'starting', 'stopping'].includes(current.status)"
            class="button stop"
            :disabled="busy || current.status === 'stopping'"
            v-tooltip="
              current.status === 'stopping'
                ? 'Waiting for this task’s processes to stop…'
                : 'Stop this task and the child processes started with it.'
            "
            @click="emit('stop', current.id)"
          >
            <AppIcon name="Square" :size="12" />{{
              current.status === 'stopping' ? 'Stopping…' : 'Stop task'
            }}</button
          ><span v-else class="tag">{{ status(current) }}</span>
        </header>
        <div class="run-details">
          <div class="mono">{{ current.command }}</div>
          <div class="mono muted">{{ current.folder }}</div>
          <div class="run-links">
            <button
              v-for="url in current.urls"
              :key="url"
              class="text-button"
              v-tooltip="`Open this address in your default browser.\n${url}`"
              @click="emit('openUrl', url)"
            >
              {{ url }}<AppIcon name="ArrowUpRight" :size="12" />
            </button>
          </div>
        </div>
        <div class="log-toolbar">
          <span
            >Output <span v-if="current.pid" class="muted">· PID {{ current.pid }}</span></span
          ><label
            ><input
              v-tooltip="
                'Automatically scroll to the latest output. Turn off to read earlier lines.'
              "
              v-model="follow"
              type="checkbox"
            />Follow output</label
          >
        </div>
        <pre ref="logElement" class="log-output">{{ cleanedLogs || 'Waiting for output…' }}</pre>
        <footer class="log-footer">
          Output is retained for this app session, up to 524,288 characters per task.
        </footer>
      </section>
      <div v-else-if="runs.length" class="empty-inspector">
        <AppIcon name="Terminal" :size="30" />
        <p>Select a task to inspect its output.</p>
      </div>
    </div>
    <section v-else class="ports-content">
      <div class="ports-toolbar">
        <label class="checkbox-label"
          ><input
            v-tooltip="'Also show TCP listeners that do not belong to a project added to Darsena.'"
            v-model="allPorts"
            type="checkbox"
          />Include listeners outside added projects</label
        ><button
          v-tooltip="
            scanning
              ? 'Scanning TCP listeners visible to your user account…'
              : 'Scan again to see which processes currently hold TCP ports.'
          "
          class="button small"
          :disabled="scanning"
          @click="emit('scan')"
        >
          <AppIcon name="RefreshCw" :class="{ spin: scanning }" :size="14" />{{
            scanning ? 'Scanning…' : 'Refresh'
          }}
        </button>
      </div>
      <p class="section-hint">
        TCP listeners visible to your user account. External processes keep their own lifecycle;
        task logs are available for Darsena runs.
      </p>
      <p v-if="report.error" role="alert" class="inline-error">{{ report.error }}</p>
      <div v-if="!visibleListeners.length" class="tasks-empty">
        <AppIcon name="Network" :size="26" /><strong>{{
          scanning ? 'Looking for listening processes…' : 'No matching listeners found.'
        }}</strong>
        <p v-if="!allPorts">You can include listeners outside your added projects.</p>
      </div>
      <div
        v-for="listener in visibleListeners"
        :key="`${listener.pid}:${listener.port}`"
        class="port-row"
      >
        <span
          v-tooltip="`This process is listening on TCP port ${listener.port}.`"
          class="port-number mono"
          >:{{ listener.port }}</span
        >
        <div class="port-info">
          <strong
            >{{ listener.command }}
            <span
              v-tooltip="
                listener.runId
                  ? 'Started and managed by Darsena.'
                  : 'Started outside Darsena. Its output is not captured here.'
              "
              class="task-kind"
              >{{ listener.runId ? 'Darsena' : 'External' }}</span
            ></strong
          ><span
            v-tooltip="listener.cwd || 'The process’s working folder could not be read.'"
            class="truncate"
            >{{ listener.worktreeName || listener.cwd || 'Working folder unavailable' }}</span
          ><span
            v-tooltip="'The process identifier and the network address it listens on.'"
            class="mono muted"
            >PID {{ listener.pid }} · {{ listener.address }}</span
          >
        </div>
        <button
          v-if="listener.runId"
          class="button small"
          :disabled="busy"
          v-tooltip="'Stop the Darsena task using this port and its child processes.'"
          @click="emit('stop', listener.runId)"
        >
          <AppIcon name="Square" :size="12" />Stop task</button
        ><button
          v-else
          class="button small"
          :disabled="busy"
          v-tooltip="'Review and confirm before stopping this external process.'"
          @click="emit('stopExternal', listener.pid, listener.port)"
        >
          Stop…
        </button>
      </div>
      <p v-if="report.checkedAt" class="section-hint">
        Checked {{ new Date(report.checkedAt).toLocaleTimeString() }}
      </p>
    </section>
  </main>
</template>
