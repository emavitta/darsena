<script setup lang="ts">
import type { Folder, Run, Task, TaskCatalog } from '../../shared/types'
const props = defineProps<{
  folders: Folder[]
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
const collapsedFolders = shallowRef(new Set<string>())
function setFolderOpen(path: string, open: boolean) {
  const next = new Set(collapsedFolders.value)
  if (open) next.delete(path)
  else next.add(path)
  collapsedFolders.value = next
}
const folderGroups = computed(() => {
  const groups = new Map<string, typeof visible.value>()
  for (const row of visible.value) {
    const group = groups.get(row.task.folder)
    if (group) group.push(row)
    else groups.set(row.task.folder, [row])
  }
  return [...groups]
    .sort(([a], [b]) => (a === '.' ? -1 : b === '.' ? 1 : a.localeCompare(b)))
    .map(([path, rows]) => ({
      path,
      rows,
      tools: [...new Map(rows.map(({ tool }) => [tool.id, tool])).values()],
      label:
        path === '.'
          ? 'Worktree root'
          : props.folders.find((folder) => folder.path === path)?.label ||
            path.split('/').at(-1) ||
            path,
    }))
})
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
  if (task.action) return 'No Android application variants found in this folder.'
  return needsSource(task) ? 'Load this task’s source in Sources.' : 'Unavailable in this worktree'
}
function runHint(task: Task) {
  if (task.action && task.available)
    return 'Choose an Android variant and device, then build, install and launch.'
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
    <section
      v-for="group in folderGroups"
      :key="group.path"
      class="task-folder-group"
      :aria-label="'Tasks in ' + group.path"
    >
      <UCollapsible
        :open="filtering || !collapsedFolders.has(group.path)"
        @update:open="setFolderOpen(group.path, $event)"
      >
        <template #default="{ open }">
          <button
            class="task-folder-heading"
            :aria-label="group.label + ' tasks'"
            :disabled="filtering"
          >
            <AppIcon
              name="ChevronRight"
              :size="15"
              class="folder-chevron"
              :class="{ expanded: open }"
            />
            <AppIcon name="FolderOpen" :size="17" />
            <span class="task-folder-name">{{ group.label }}</span>
            <span class="task-folder-path mono" :title="group.path">{{
              group.path === '.' ? 'Root' : group.path
            }}</span>
            <span class="task-folder-tools">
              <span
                v-for="tool in group.tools"
                :key="tool.id"
                v-tooltip="tool.label"
                :title="tool.label"
                :aria-label="tool.label"
                class="task-tool-symbol"
              >
                <TaskToolIcon :icon="tool.icon" />
              </span>
            </span>
            <span class="task-folder-count">{{ group.rows.length }}</span>
          </button>
        </template>
        <template #content>
          <div
            v-for="{ task, tool } in group.rows"
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
                <span
                  v-if="group.tools.length > 1"
                  v-tooltip="tool.label + ': ' + tool.hint"
                  :title="tool.label"
                  :aria-label="tool.label"
                  class="task-tool-symbol"
                >
                  <TaskToolIcon :icon="tool.icon" />
                </span>
                <strong v-tooltip="task.description || [task.command, ...task.args].join(' ')">{{
                  task.name
                }}</strong>
              </div>
              <span v-if="task.action" class="muted">Build, install and launch</span>
              <span
                v-if="task.port"
                class="mono muted"
                v-tooltip="'Darsena checks this TCP port before starting the task.'"
                >Port {{ task.port }}</span
              >
              <span v-if="!task.available" class="task-missing">{{ missingHint(task) }}</span>
            </div>
            <div class="task-row-actions">
              <button
                v-if="!task.action"
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
        </template>
      </UCollapsible>
    </section>
  </section>
</template>

<style scoped>
.task-folder-group {
  max-width: 860px;
  margin-top: 12px;
}
.task-folder-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 38px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.task-folder-heading:hover {
  background: var(--pane);
}
.task-folder-heading:disabled {
  opacity: 1;
  cursor: default;
}
.task-folder-heading > .icon {
  color: var(--accent);
  flex-shrink: 0;
}
.task-folder-name {
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.task-folder-path {
  min-width: 0;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-folder-count {
  font-size: 12px;
  color: var(--muted);
  padding-left: 8px;
}
.task-folder-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}
.task-tool-symbol {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.task-tool-symbol :deep(.tool-icon) {
  width: 16px;
  height: 16px;
}
.task-folder-group .task-row {
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 10px;
  padding: 10px 4px;
  min-height: 52px;
}
.task-folder-group .task-info {
  gap: 3px;
}
.task-toolbar {
  max-width: 860px;
}
.folder-chevron {
  transition: transform 120ms ease;
}
.folder-chevron.expanded {
  transform: rotate(90deg);
}
.task-folder-group .task-row:last-child {
  border-bottom: 0;
}
@media (prefers-reduced-motion: reduce) {
  .folder-chevron {
    transition: none;
  }
}
</style>
