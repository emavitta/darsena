<script setup lang="ts">
import { runFolderLabel } from '../../shared/run-labels'
import type { ListenerReport, Run } from '../../shared/types'
const props = defineProps<{
  compact?: boolean
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
const tab = shallowRef<'runs' | 'history' | 'ports'>('runs')
const allPorts = shallowRef(false)
const follow = shallowRef(true)
const logElement = useTemplateRef('logElement')
watch(() => props.runs.find(run => run.id === props.selected)?.status, (status) => {
  if (status && tab.value !== 'ports') tab.value = ['starting', 'running', 'stopping'].includes(status) ? 'runs' : 'history'
})
const shownRuns = computed(() => props.runs.filter(run => tab.value === 'history' ? !['starting', 'running', 'stopping'].includes(run.status) : ['starting', 'running', 'stopping'].includes(run.status)))
const current = computed(() => shownRuns.value.find((r) => r.id === props.selected))
watch([shownRuns, () => props.selected], () => {
  if (tab.value !== 'ports' && !current.value && shownRuns.value[0]) emit('inspect', shownRuns.value[0].id)
}, { immediate: true })
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
const logParts = computed(() => {
  const text = cleanedLogs.value
  const parts: { text: string; url?: string }[] = []
  let offset = 0
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`]+/g)) {
    const url = match[0].replace(/[.,;:!?)}\]]+$/, '')
    try {
      new URL(url)
    } catch {
      continue
    }
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index) })
    parts.push({ text: url, url })
    offset = match.index + url.length
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) })
  return parts
})
function status(run: Run) {
  if (run.androidOperation === 'logcat' && run.status === 'running') return 'Collecting logs'
  return {
    running: 'Running',
    starting: 'Starting',
    stopping: 'Stopping',
    stopped: 'Stopped',
    succeeded: 'Completed',
    failed: 'Failed',
  }[run.status]
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
</script>
<template>
  <main class="activity-panel" :class="{ 'activity-compact': compact }">
    <header class="activity-header">
      <div v-if="!compact">
        <div class="eyebrow">Across your worktrees</div>
        <h1>Activity</h1>
        <p v-if="!compact" class="muted">
          {{ activeRuns.length }} active {{ activeRuns.length === 1 ? 'task' : 'tasks' }}. Finished
          and stopped runs are kept in History.
        </p>
      </div>
      <div class="nuxt-ui-scope activity-tabs">
        <UTabs v-model="tab" :content="false" :items="[
          { label: `Running ${activeRuns.length}`, value: 'runs' },
          { label: `History ${runs.length - activeRuns.length}`, value: 'history' },
          { label: 'Listening ports', value: 'ports' },
        ]" size="sm" aria-label="Activity views" @update:model-value="value => { if (value === 'ports') emit('scan') }" />
      </div>
    </header>
    <div v-if="tab !== 'ports'" class="activity-content">
      <ActivityRunList
        :compact="compact"
        :runs="shownRuns"
        :selected="selected"
        @inspect="emit('inspect', $event)"
      />
      <section v-if="current" class="run-inspector">
        <header class="log-header">
          <div class="inspector-identity">
            <div class="run-project">{{ current.projectName }}</div>
            <h3>{{ current.name }}</h3>
            <div class="inspector-folder mono" :title="current.folder">
              <AppIcon name="Folder" :size="16" />{{ runFolderLabel(current) }}
            </div>
            <button
              v-tooltip="`Jump to the worktree where this task ran.\n${current.worktree}`"
              class="text-button inspector-worktree"
              @click="emit('locate', current)"
            >
              <AppIcon name="GitFork" :size="18" />{{
                current.worktreeBranch || current.worktreeName
              }}<AppIcon name="ArrowUpRight" :size="15" />
            </button>
          </div>
          <button
            v-if="['running', 'starting', 'stopping'].includes(current.status)"
            class="button stop"
            :disabled="busy || current.status === 'stopping'"
            v-tooltip="
              current.status === 'stopping'
                ? 'Waiting for this task’s processes to stop…'
                : current.androidOperation === 'logcat'
                  ? 'Stop log collection only; leave the Android app running.'
                  : 'Stop this task and the child processes started with it.'
            "
            @click="emit('stop', current.id)"
          >
            <AppIcon name="Square" :size="12" />{{
              current.status === 'stopping'
                ? 'Stopping…'
                : current.androidOperation === 'logcat'
                  ? 'Stop Logcat'
                  : current.androidOperation === 'app-action'
                    ? 'Cancel ADB operation'
                    : current.androidDevice
                      ? 'Stop deployment'
                      : 'Stop task'
            }}</button
          ><span v-else class="tag">{{ status(current) }}</span>
        </header>
        <div class="run-details">
          <div class="worktree-path mono" :title="compact ? current.worktree : undefined">
            {{ current.worktree }}
          </div>
          <div
            class="run-state"
            :class="{
              'run-state-ended': !['running', 'starting', 'stopping'].includes(current.status),
              'text-danger': current.status === 'failed',
            }"
            role="status"
          >
            <strong>{{ status(current) }}</strong>
            <span v-if="!compact && !['running', 'starting', 'stopping'].includes(current.status)"
              >This task is no longer running. You’re viewing saved output.</span
            >
            <span v-else-if="!compact && current.status === 'stopping'"
              >Waiting for this task’s processes to exit.</span
            >
            <span v-else-if="!compact">{{
              current.androidOperation === 'logcat'
                ? 'Reading logs from the Android device.'
                : 'Active in this worktree.'
            }}</span>
          </div>
          <div class="run-origin muted">
            Started from {{ current.source === 'mcp' ? 'MCP' : 'the Darsena interface' }}
          </div>
          <details v-if="compact" :key="current.id" class="command-details">
            <summary>Command &amp; folder</summary>
            <div class="mono">Worktree: {{ current.worktree }}</div>
            <div class="mono">{{ current.command }}</div>
            <div class="mono muted">Working folder: {{ current.folder }}</div>
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
          </details>
          <template v-else>
            <div class="mono">{{ current.command }}</div>
            <div class="mono muted">Working folder: {{ current.folder }}</div>
          </template>
          <p
            v-if="
              !compact &&
              current.urls.length &&
              !['running', 'starting', 'stopping'].includes(current.status)
            "
            class="muted"
          >
            Addresses from saved output; the task has ended.
          </p>
          <div v-if="!compact" class="run-links">
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
        <FollowLogcat
          v-if="
            current.androidApplicationId &&
            current.androidOperation !== 'logcat' &&
            !['starting', 'running', 'stopping'].includes(current.status)
          "
          :key="current.id"
          :run="current"
          @started="emit('inspect', $event)"
        />
        <LogcatOutput
          v-if="current.androidOperation === 'logcat'"
          :key="current.id + '-logs'"
          :run="current"
          :logs="cleanedLogs"
        />
        <template v-else>
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
          <pre ref="logElement" class="log-output"><template v-if="cleanedLogs"><template v-for="(part, index) in logParts" :key="index"><a v-if="part.url" class="log-link" :href="part.url" :title="`Open ${part.url} in browser`" @click.prevent="emit('openUrl', part.url)">{{ part.text }}</a><template v-else>{{ part.text }}</template></template></template><template v-else>{{ ['running', 'starting', 'stopping'].includes(current.status) ? 'Waiting for output…' : 'No output was recorded.' }}</template></pre>
          <footer v-if="!compact" class="log-footer">
            Output is retained for this app session, up to 524,288 characters per task.
          </footer>
        </template>
      </section>
      <div v-else class="empty-inspector">
        <AppIcon name="Terminal" :size="30" />
        <p>{{ shownRuns.length ? 'Select a task to inspect its output.' : tab === 'history' ? 'No completed tasks yet.' : 'No tasks running. Previous output is in History.' }}</p>
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
              ? 'Scanning TCP listeners visible to your macOS user…'
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
        TCP listeners visible to your macOS user. External processes keep their own lifecycle; task
        logs are available for Darsena runs.
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
            v-tooltip="'The macOS process identifier and the network address it listens on.'"
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

<style scoped>
.log-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.log-link:hover { text-decoration-thickness: 2px; }
.log-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.inspector-folder {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.inspector-folder svg { flex-shrink: 0; }
.log-header {
  align-items: flex-start;
}
.log-header > div {
  min-width: 0;
}
.log-header .button {
  flex-shrink: 0;
}
.run-project {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}
.log-header h3 {
  font-size: 17px;
}
.inspector-worktree {
  font-size: 20px;
  font-weight: 650;
  text-align: left;
  overflow-wrap: anywhere;
  align-items: flex-start;
}
.inspector-worktree svg {
  flex-shrink: 0;
  margin-top: 3px;
}
.worktree-path {
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.run-state {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 11px 13px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 7px;
  font-size: 13px;
}
.run-state-ended {
  background: var(--pane);
  color: var(--muted);
  border: 1px solid var(--line);
}
.run-state strong {
  color: var(--text);
}
.run-state.text-danger strong {
  color: var(--danger);
}
.run-details {
  gap: 10px;
}
.log-toolbar {
  font-size: 12px;
}
@media (max-width: 1100px) {
  .log-header {
    padding: 18px 18px 12px;
  }
  .run-details {
    padding-inline: 18px;
  }
  .inspector-worktree {
    font-size: 18px;
  }
}
.activity-compact {
  min-height: 0;
  overflow: hidden;
}
.activity-compact .activity-header {
  padding: 8px 16px;
  align-items: center;
  gap: 12px;
}
.activity-compact .activity-header h1 {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
}
.compact-count {
  margin-left: 10px;
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}
.activity-compact .log-header {
  padding: 10px 16px 6px;
  gap: 12px;
}
.activity-compact .inspector-identity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 12px;
  min-width: 0;
}
.activity-compact .run-project {
  margin: 0;
  font-size: 12px;
}
.activity-compact .log-header h3 {
  margin: 0;
  font-size: 14px;
}
.activity-compact .inspector-worktree {
  flex-basis: 100%;
  font-size: 16px;
  line-height: 1.35;
}
.activity-compact .run-details {
  padding: 0 16px 8px;
  gap: 5px 10px;
  flex-flow: row wrap;
  align-items: center;
  max-height: 130px;
  overflow: auto;
  flex-shrink: 0;
}
.activity-compact .worktree-path {
  flex-basis: 100%;
  font-size: 12px;
  line-height: 1.4;
}
.activity-compact .run-state {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
.activity-compact .run-origin {
  font-size: 12px;
}
.command-details {
  font-size: 12px;
  min-width: 0;
}
.command-details summary {
  cursor: pointer;
  color: var(--muted);
}
.command-details[open] {
  flex-basis: 100%;
}
.command-details > div {
  margin-top: 5px;
  overflow-wrap: anywhere;
}
.activity-compact .run-links {
  flex-basis: 100%;
  gap: 6px 12px;
  font-size: 12px;
}
.activity-compact .log-toolbar {
  padding: 6px 16px;
}
.activity-compact .log-output {
  padding: 8px 16px;
  min-height: 65px;
  font-size: 12px;
  line-height: 1.55;
}
.activity-compact .run-inspector {
  min-height: 0;
  overflow: auto;
}
.activity-compact .ports-content {
  padding: 12px 16px;
}
/* Keep output visible in the short dock; only the secondary metadata scrolls. */
.activity-compact .activity-header {
  padding: 3px 12px;
  justify-content: flex-end;
}
.activity-compact .activity-header .segmented button {
  padding-block: 4px;
}
.activity-compact .run-inspector {
  display: grid;
  grid-template-rows: auto auto auto minmax(65px, 1fr);
  overflow: hidden;
}
.activity-compact .log-header {
  padding: 6px 12px 4px;
}
.activity-compact .run-details {
  padding: 0 12px 4px;
  min-height: 0;
  max-height: 85px;
  align-content: flex-start;
  overflow: auto;
}
.activity-compact .worktree-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-compact .log-toolbar {
  padding: 4px 12px;
}
.activity-compact .log-output {
  min-height: 0;
  padding: 6px 12px;
}
</style>
