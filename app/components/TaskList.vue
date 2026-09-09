<script setup lang="ts">
import type { Run, Task, TaskCatalog } from '../../shared/types'
const props = defineProps<{
  catalog: TaskCatalog
  favorites: string[]
  runs: Run[]
  worktree: string
  busy: boolean
  sourceLoading: boolean
}>()
const emit = defineEmits<{
  star: [id: string]
  start: [id: string]
  configure: [task: Task]
  custom: []
  remove: [id: string]
  loadSource: [folder: string]
}>()
const tasks = computed(() => props.catalog.tasks)
const pendingSources = computed(() => props.catalog.sources.some((source) => !source.loaded))
const tab = shallowRef<'favorites' | 'all'>('favorites')
const query = shallowRef('')
const toolFilter = shallowRef('all')
const rows = computed(() => tasks.value.map((task) => ({ task, tool: taskTool(task) })))
const toolOptions = computed(() => {
  const options = new Map<string, { id: string; label: string; count: number }>()
  for (const { tool } of rows.value) {
    const option = options.get(tool.id)
    if (option) option.count++
    else options.set(tool.id, { id: tool.id, label: tool.label, count: 1 })
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label))
})
const filtering = computed(() => !!query.value.trim() || toolFilter.value !== 'all')
const visible = computed(() =>
  rows.value.filter(
    ({ task, tool }) =>
      (tab.value === 'all' || props.favorites.includes(task.id)) &&
      (toolFilter.value === 'all' || tool.id === toolFilter.value) &&
      `${task.name} ${task.folder} ${tool.label}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
)
watch(toolOptions, (options) => {
  if (toolFilter.value !== 'all' && !options.some((tool) => tool.id === toolFilter.value))
    toolFilter.value = 'all'
})
function clearFilters() {
  query.value = ''
  toolFilter.value = 'all'
}
const running = computed(
  () =>
    new Set(
      props.runs
        .filter(
          (r) =>
            r.worktree === props.worktree && ['running', 'starting', 'stopping'].includes(r.status),
        )
        .map((r) => r.taskId),
    ),
)
function needsSource(task: Task) {
  return props.catalog.sources.some(
    (s) => s.kind === task.kind && s.folder === task.folder && !s.loaded,
  )
}
function missingHint(task: Task) {
  return needsSource(task) ? 'Load this task’s source in Sources.' : 'Unavailable in this worktree'
}
function runHint(task: Task) {
  if (running.value.has(task.id))
    return 'This task is already active in this worktree. Open Activity to view its output or stop it.'
  if (!task.available)
    return needsSource(task)
      ? missingHint(task)
      : 'This task is not available in the selected worktree.'
  if (props.busy) return 'Wait for the current action to finish.'
  return `Run ${task.name} in ${task.folder === '.' ? 'the root folder' : task.folder} of the selected worktree.`
}
</script>
<template>
  <section class="detail-section tasks-section">
    <div class="section-title">
      <h3>Tasks</h3>
      <button
        v-tooltip="'Save an executable and its arguments to run across this project’s worktrees.'"
        class="text-button"
        @click="emit('custom')"
      >
        <AppIcon name="Plus" :size="14" />Custom command
      </button>
    </div>
    <TaskSources
      :sources="catalog.sources"
      :loading="sourceLoading"
      @load="emit('loadSource', $event)"
    />
    <div v-for="error in catalog.errors" :key="error.folder" class="source-error" role="alert">
      <AppIcon name="TriangleAlert" :size="15" />
      <div>
        <strong>{{ error.folder }}</strong>
        <p>{{ error.message }}</p>
      </div>
    </div>
    <div class="task-toolbar">
      <div class="segmented">
        <button
          :class="{ active: tab === 'favorites' }"
          :aria-pressed="tab === 'favorites'"
          v-tooltip="'Show the tasks you starred for this project, across all its worktrees.'"
          @click="tab = 'favorites'"
        >
          Favorites <span>{{ favorites.length }}</span></button
        ><button
          :class="{ active: tab === 'all' }"
          :aria-pressed="tab === 'all'"
          v-tooltip="'Show discovered scripts, loaded Gradle tasks and saved custom commands.'"
          @click="tab = 'all'"
        >
          All tasks <span>{{ tasks.length }}</span>
        </button>
      </div>
      <div class="task-filters">
        <select
          v-model="toolFilter"
          aria-label="Filter tasks by tool"
          class="task-tool-filter"
          v-tooltip="'Show tasks for one tool, such as pnpm, npm, Yarn or Gradle.'"
        >
          <option value="all">All tools</option>
          <option v-for="tool in toolOptions" :key="tool.id" :value="tool.id">
            {{ tool.label }} ({{ tool.count }})
          </option>
        </select>
        <label class="task-search"
          ><AppIcon name="Search" :size="14" /><input
            v-model="query"
            aria-label="Search tasks"
            v-tooltip="'Filter tasks by name, working folder or tool.'"
            placeholder="Find task…"
        /></label>
      </div>
    </div>
    <div v-if="!visible.length" class="tasks-empty">
      <AppIcon :name="tab === 'favorites' ? 'Star' : 'Terminal'" :size="24" /><strong>{{
        filtering
          ? 'No matching tasks.'
          : tab === 'favorites'
            ? 'Keep your usual tasks close.'
            : 'No tasks found here.'
      }}</strong>
      <p>
        {{
          filtering
            ? 'Try another tool or search term.'
            : tab === 'favorites'
              ? 'Star a task once. Run it from any worktree.'
              : pendingSources
                ? 'Open Sources above to load the remaining tasks into this list.'
                : 'Add a folder with package.json or a Gradle wrapper, or add a custom command.'
        }}
      </p>
      <button v-if="filtering" class="button small" @click="clearFilters">Clear filters</button>
      <button
        v-else-if="tab === 'favorites'"
        v-tooltip="'Find tasks and star the ones you use often.'"
        class="button small"
        @click="tab = 'all'"
      >
        Browse all tasks<AppIcon name="ChevronRight" :size="14" />
      </button>
    </div>
    <div
      v-for="{ task, tool } in visible"
      :key="task.id"
      class="task-row"
      :class="{ unavailable: !task.available }"
    >
      <button
        class="icon-button star-button"
        :class="{ starred: favorites.includes(task.id) }"
        :aria-label="`${favorites.includes(task.id) ? 'Unfavorite' : 'Favorite'} task ${task.name}`"
        :aria-pressed="favorites.includes(task.id)"
        v-tooltip="
          favorites.includes(task.id)
            ? 'Remove this task from the project’s favorites.'
            : 'Favorite this task once to find it in every worktree of this project.'
        "
        @click="emit('star', task.id)"
      >
        <AppIcon name="Star" :size="18" />
      </button>
      <div class="task-info">
        <div class="task-name">
          <strong v-tooltip="task.description || [task.command, ...task.args].join(' ')">{{
            task.name
          }}</strong>
        </div>
        <span
          v-tooltip="`Working folder relative to the selected worktree: ${task.folder}`"
          class="mono muted truncate"
          >{{ task.folder === '.' ? 'Root' : task.folder
          }}<span
            v-if="task.port"
            v-tooltip="
              `Darsena checks that TCP port ${task.port} is free before starting. It does not change the server’s port.`
            "
          >
            · port {{ task.port }}</span
          ></span
        ><span v-if="!task.available" class="task-missing">{{ missingHint(task) }}</span>
      </div>
      <TaskToolBadge :tool="tool" class="task-row-tool" />
      <div class="task-row-actions">
        <button
          class="icon-button subtle"
          :aria-label="`Configure ${task.name}`"
          v-tooltip="'Set a fixed TCP port to check for conflicts before starting this task.'"
          @click="emit('configure', task)"
        >
          <AppIcon name="Settings2" :size="14" />
        </button>
        <button
          v-if="task.kind === 'custom'"
          class="icon-button subtle"
          :aria-label="`Remove command ${task.name}`"
          v-tooltip="'Remove this saved command from the project. No files are deleted.'"
          @click="emit('remove', task.id)"
        >
          <AppIcon name="Trash2" :size="14" />
        </button>
        <button
          class="run-button"
          :disabled="!task.available || busy || running.has(task.id)"
          :aria-label="`Run ${task.name} in ${task.folder}`"
          v-tooltip="runHint(task)"
          @click="emit('start', task.id)"
        >
          <AppIcon :name="running.has(task.id) ? 'Activity' : 'Play'" :size="13" />{{
            running.has(task.id) ? 'Running' : 'Run'
          }}
        </button>
      </div>
    </div>
  </section>
</template>
