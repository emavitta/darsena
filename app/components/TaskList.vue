<script setup lang="ts">
import type { Folder, Run, Task, TaskCatalog } from '../../shared/types'
const props = defineProps<{
  projectId: string
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
const { status: mcpStatus, busy: mcpBusy, error: mcpError, perform: mcpPerform } = useMcpSettings()
const mcpShared = computed(() => !!mcpStatus.value?.projects[props.projectId])
function mcpAllowed(id: string) {
  return (
    mcpShared.value &&
    (props.favorites.includes(id) ||
      !!mcpStatus.value?.projects[props.projectId]?.tasks.includes(id))
  )
}
function taskMenu(task: Task) {
  return [
    ...(!task.action
      ? [
          {
            label: 'Configure task',
            icon: 'i-lucide-settings-2',
            disabled: props.busy,
            onSelect: () => emit('configure', task),
          },
        ]
      : []),
    {
      label: !mcpShared.value
        ? 'Share project in Preferences → MCP first'
        : props.favorites.includes(task.id)
          ? 'Allowed via favorites — unstar to revoke'
          : mcpAllowed(task.id)
            ? 'Revoke MCP access'
            : 'Allow through MCP',
      icon: 'i-lucide-plug',
      disabled:
        mcpBusy.value ||
        !mcpShared.value ||
        props.favorites.includes(task.id) ||
        (!task.available && !mcpAllowed(task.id)),
      onSelect: () =>
        mcpPerform('mcpTask', {
          projectId: props.projectId,
          worktree: props.worktree,
          taskId: task.id,
          allowed: !mcpAllowed(task.id),
        }),
    },
    ...(task.kind === 'custom'
      ? [
          {
            label: 'Remove command',
            icon: 'i-lucide-trash-2',
            disabled: props.busy,
            onSelect: () => emit('remove', task.id),
          },
        ]
      : []),
  ]
}
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
    <p v-if="mcpError" role="alert" class="inline-error">{{ mcpError }}</p>
    <div class="section-title">
      <h3>Tasks</h3>
      <AppTooltip :text="'Save an executable and its arguments to run across this project’s worktrees.'"><button
        
        class="text-button"
        @click="emit('custom')"
      >
        <AppIcon name="Plus" :size="14" />Custom command
      </button></AppTooltip>
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
        <AppTooltip :text="'Show the tasks you starred for this project, across all its worktrees.'"><button
          :class="{ active: tab === 'favorites' }"
          :aria-pressed="tab === 'favorites'"
          
          @click="tab = 'favorites'"
        >
          Favorites <span>{{ favorites.length }}</span></button
        ></AppTooltip><AppTooltip :text="'Show discovered scripts, loaded Gradle tasks and saved custom commands.'"><button
          :class="{ active: tab === 'all' }"
          :aria-pressed="tab === 'all'"
          
          @click="tab = 'all'"
        >
          All tasks <span>{{ tasks.length }}</span>
        </button></AppTooltip>
      </div>
      <div class="task-filters">
        <AppTooltip :text="'Show tasks for one tool, such as pnpm, npm, Yarn or Gradle.'"><select
          v-model="toolFilter"
          aria-label="Filter tasks by tool"
          class="task-tool-filter"
          
        >
          <option value="all">All tools</option>
          <option v-for="tool in toolOptions" :key="tool.id" :value="tool.id">
            {{ tool.label }} ({{ tool.count }})
          </option>
        </select></AppTooltip>
        <label class="task-search"
          ><AppIcon name="Search" :size="14" /><AppTooltip :text="'Filter tasks by name, working folder or tool.'"><input
            v-model="query"
            aria-label="Search tasks"
            
            placeholder="Find task…"
        /></AppTooltip></label>
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
      <AppTooltip :text="'Find tasks and star the ones you use often.'" v-else-if="tab === 'favorites'"><button
        
        
        class="button small"
        @click="tab = 'all'"
      >
        Browse all tasks<AppIcon name="ChevronRight" :size="14" />
      </button></AppTooltip>
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
              <AppTooltip :text="tool.label" v-for="tool in group.tools" :key="tool.id"><span
                
                :title="tool.label"
                :aria-label="tool.label"
                class="task-tool-symbol"
              >
                <TaskToolIcon :icon="tool.icon" />
              </span></AppTooltip>
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
            <AppTooltip :text="
                favorites.includes(task.id)
                  ? (mcpShared ? 'Remove favorite and revoke MCP access. Running tasks are not stopped.' : 'Remove this task from the project’s favorites.')
                  : (mcpShared ? 'Favorite this task and allow MCP clients to run it across this project’s worktrees.' : 'Favorite this task. Favorites are also allowed when you share this project with MCP.')
              "><button
              class="icon-button star-button"
              :class="{ starred: favorites.includes(task.id) }"
              :aria-label="`${favorites.includes(task.id) ? 'Unfavorite' : 'Favorite'} task ${task.name}`"
              :aria-pressed="favorites.includes(task.id)"
              
              @click="emit('star', task.id)"
            >
              <AppIcon name="Star" :size="18" />
            </button></AppTooltip>
            <div class="task-info">
              <div class="task-name">
                <AppTooltip :text="tool.label + ': ' + tool.hint" v-if="group.tools.length > 1"><span
                  
                  
                  :title="tool.label"
                  :aria-label="tool.label"
                  class="task-tool-symbol"
                >
                  <TaskToolIcon :icon="tool.icon" />
                </span></AppTooltip>
                <AppTooltip :text="task.description || [task.command, ...task.args].join(' ')"><strong >{{
                  task.name
                }}</strong></AppTooltip>
              </div>
              <span v-if="task.action" class="muted">Build, install and launch</span>
              <AppTooltip :text="'Darsena checks this TCP port before starting the task.'" v-if="task.port"><span
                
                class="mono muted"
                
                >Port {{ task.port }}</span
              ></AppTooltip>
              <span v-if="!task.available" class="task-missing">{{ missingHint(task) }}</span>
            </div>
            <div class="task-row-actions nuxt-ui-scope">
              <AppTooltip :text="'Allowed through MCP'" v-if="mcpAllowed(task.id)"><span  class="mcp-task-allowed"  aria-label="Allowed through MCP">MCP</span></AppTooltip>
              <UDropdownMenu :items="taskMenu(task)" :content="{ align: 'end' }">
                <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-ellipsis" :aria-label="`Actions for ${task.name} in ${task.folder}`" title="Task actions" />
              </UDropdownMenu>
              <AppTooltip :text="runHint(task)"><button
                class="run-button"
                :disabled="!task.available || busy || running.has(task.id)"
                :aria-label="`Run ${task.name} in ${task.folder}`"
                
                @click="emit('start', task.id)"
              >
                <AppIcon :name="running.has(task.id) ? 'Activity' : 'Play'" :size="13" />{{
                  running.has(task.id) ? 'Running' : 'Run'
                }}
              </button></AppTooltip>
            </div>
          </div>
        </template>
      </UCollapsible>
    </section>
  </section>
</template>

<style scoped>
.mcp-task-allowed {
  color: var(--muted);
  font-size: 11px;
}
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
