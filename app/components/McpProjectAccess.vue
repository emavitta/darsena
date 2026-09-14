<script setup lang="ts">
import type { Project, TaskCatalog, Worktree, Methods } from '../../shared/types'
import { taskTool } from '../utils/taskTools'
const props = defineProps<{
  project: Project
  allowed: boolean
  taskIds: string[]
  busy: boolean
}>()
const emit = defineEmits<{
  access: [allowed: boolean]
  task: [input: Methods['mcpTask']['input']]
}>()
const expanded = shallowRef(false)
const loading = shallowRef(false)
const error = shallowRef('')
const worktrees = shallowRef<Worktree[]>([])
const selected = shallowRef('')
const search = shallowRef('')
const catalog = shallowRef<TaskCatalog>({ tasks: [], sources: [], errors: [] })
let revision = 0
const tasks = computed(() =>
  catalog.value.tasks.filter((task) =>
    `${task.name} ${task.folder}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const missing = computed(() =>
  props.taskIds.filter((id) => !catalog.value.tasks.some((task) => task.id === id)),
)
async function load(refreshTrees = false) {
  const current = ++revision
  loading.value = true
  error.value = ''
  try {
    if (refreshTrees) {
      const trees = (
        await window.darsena!.call('worktrees', { projectId: props.project.id })
      ).filter((tree) => tree.exists && !tree.bare)
      if (current !== revision) return
      worktrees.value = trees
      selected.value =
        trees.find((tree) => tree.path === selected.value)?.path ||
        trees.find((tree) => tree.path === props.project.lastWorktree)?.path ||
        trees[0]?.path ||
        ''
    }
    const value = selected.value
      ? await window.darsena!.call('tasks', {
          projectId: props.project.id,
          worktree: selected.value,
        })
      : { tasks: [], sources: [], errors: [] }
    if (current === revision) catalog.value = value
  } catch (cause) {
    if (current === revision) error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (current === revision) loading.value = false
  }
}
function permission(taskId: string, allowed: boolean) {
  emit('task', {
    projectId: props.project.id,
    worktree: selected.value || props.project.root,
    taskId,
    allowed,
  })
}
watch(
  () => expanded.value && props.allowed,
  (open) => {
    if (open) void load(true)
    else {
      revision++
      loading.value = false
      catalog.value = { tasks: [], sources: [], errors: [] }
    }
  },
)
onBeforeUnmount(() => {
  revision++
})
</script>

<template>
  <section class="mcp-project">
    <div class="mcp-project-header">
      <label class="mcp-project-label">
        <input
          type="checkbox"
          :checked="allowed"
          :disabled="busy"
          :aria-label="`Share ${project.name} with MCP`"
          @change="emit('access', ($event.target as HTMLInputElement).checked)"
        />
        <span
          ><strong>{{ project.name }}</strong
          ><small>{{
            !allowed
              ? 'Not shared'
              : taskIds.length
                ? `${taskIds.length} ${taskIds.length === 1 ? 'task' : 'tasks'} authorized`
                : 'Read-only access'
          }}</small></span
        >
      </label>
      <button
        class="button small"
        :disabled="!allowed"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Hide tasks' : 'Task permissions' }}
      </button>
    </div>
    <div v-if="expanded && allowed" class="mcp-project-tasks">
      <p class="section-hint">
        Choose tasks that MCP clients may start or stop. These permissions apply across this
        project’s worktrees. Favorites are automatically allowed; remove the star in the task list to revoke their access. Other tasks can be authorized separately.
      </p>
      <div class="mcp-task-toolbar">
        <label
          >Read tasks from<select v-model="selected" :disabled="loading || busy" @change="load()">
            <option v-for="tree in worktrees" :key="tree.path" :value="tree.path">
              {{ tree.name }} · {{ tree.branch || 'Detached HEAD' }}
            </option>
          </select></label
        >
        <button class="button small" :disabled="loading || busy" @click="load(true)">
          Refresh
        </button>
      </div>
      <input
        v-model="search"
        type="search"
        placeholder="Find a task…"
        aria-label="Find task permissions"
      />
      <p v-if="loading" role="status" class="muted">Reading tasks…</p>
      <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
      <div v-else-if="!loading" class="mcp-task-list">
        <label v-for="task in tasks" :key="task.id" class="mcp-task-row">
          <input
            type="checkbox"
            :checked="taskIds.includes(task.id)"
            :disabled="busy || project.favorites.includes(task.id) || (!task.available && !taskIds.includes(task.id))"
            :aria-label="`Allow MCP to run ${task.name} in ${task.folder}`"
            @change="permission(task.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="mcp-task-name"
            ><strong>{{ task.name }}</strong
            ><small class="mono"
              >{{ task.folder }}{{ project.favorites.includes(task.id) ? ' · Allowed via favorites' : '' }}{{ !task.available ? ' · Unavailable here' : '' }}</small
            ></span
          >
          <TaskToolBadge :tool="taskTool(task)" />
        </label>
        <p v-if="!tasks.length" class="section-hint">
          {{ search ? 'No matching tasks.' : 'No tasks available in this worktree.' }}
        </p>
      </div>
      <p
        v-if="catalog.sources.some((source) => source.kind === 'gradle' && !source.loaded)"
        class="section-hint"
      >
        Gradle tasks have not been loaded here. Load the source in the workspace, then refresh this
        list. Loading Gradle evaluates the project’s build.
      </p>
      <p v-for="failure in catalog.errors" :key="failure.folder" class="inline-error">
        {{ failure.folder }}: {{ failure.message }}
      </p>
      <div v-for="id in missing" :key="id" class="mcp-missing">
        <span class="mono">Unavailable permission: {{ id }}</span
        ><button class="text-button" :disabled="busy || project.favorites.includes(id)" @click="permission(id, false)">Revoke</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mcp-project {
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.mcp-project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 16px;
}
.mcp-project-label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.mcp-project-label span,
.mcp-task-name {
  display: grid;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.mcp-project-label small,
.mcp-task-name small {
  color: var(--muted);
}
.mcp-project-tasks {
  display: grid;
  gap: 14px;
  padding: 0 16px 16px;
}
.mcp-project-tasks p {
  margin: 0;
}
.mcp-task-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.mcp-task-toolbar label {
  display: grid;
  gap: 7px;
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--muted);
}
.mcp-task-toolbar select {
  width: 100%;
}
.mcp-task-list {
  max-height: 270px;
  overflow: auto;
}
.mcp-task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.mcp-task-name {
  flex: 1;
}
.mcp-task-name strong {
  font-size: 13px;
}
.mcp-missing {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
}
.mcp-missing span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
