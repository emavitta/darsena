<script setup lang="ts">
const {
  switcher,
  switcherLoading,
  switcherBusy,
  switcherTrees,
  switcherErrors,
  openSwitcher,
  closeSwitcher,
  switchToWorktree,
  state,
  worktrees,
  selectedPath,
  catalog,
  runs,
  selectedRun,
  logs,
  report,
  ready,
  bridge,
  loading,
  busy,
  gradleBusy,
  scanning,
  error,
  contextError,
  toast,
  activity,
  settings,
  customDialog,
  folderPicker,
  browseFolder,
  saveFolder,
  closeFolderPicker,
  portTask,
  conflict,
  project,
  worktree,
  activeRuns,
  refreshContext,
  selectProject,
  selectWorktree,
  startTask,
  transfer,
  inspect,
  scan,
  stop,
  stopExternal,
  gradle,
  saveCustom,
  savePort,
  copy,
  locate,
  addProject,
  starProject,
  removalProject,
  removalBusy,
  removalError,
  removalRuns,
  requestRemoval,
  closeRemoval,
  confirmRemoval,
  viewRemovalActivity,
  revealProject,
  addFolder,
  removeFolder,
  starTask,
  removeCustom,
  openFolder,
  chooseApp,
  openUrl,
} = useWorkspace()
const sidebarOpen = shallowRef(true)
const about = shallowRef<'overview' | 'story' | null>(null)
function inspectConflict() {
  const runId = conflict.value?.result.runId
  conflict.value = undefined
  if (runId) void inspect(runId)
}
function viewConflictActivity() {
  conflict.value = undefined
  activity.value = true
  void scan()
}
</script>
<template>
  <div
    class="desktop-shell"
    :class="{ 'sidebar-collapsed': !sidebarOpen, 'has-activity': ready && bridge }"
  >
    <div class="titlebar">
      <UButton
        class="nuxt-ui-scope sidebar-toggle"
        color="neutral"
        variant="ghost"
        icon="i-lucide-panel-left"
        :aria-label="sidebarOpen ? 'Collapse projects sidebar' : 'Expand projects sidebar'"
        :aria-expanded="sidebarOpen"
        aria-controls="projects-sidebar"
        v-tooltip="
          sidebarOpen ? 'Reduce the projects sidebar to icons.' : 'Expand the projects sidebar.'
        "
        @click="sidebarOpen = !sidebarOpen"
      />
      <button
        class="titlebar-label switcher-trigger"
        aria-label="Switch worktree"
        @click="openSwitcher"
      >
        Search worktrees… <kbd>⌘ K</kbd>
      </button>
      <button
        v-if="activeRuns.length"
        v-tooltip="'Open Activity to inspect or stop running tasks across all projects.'"
        class="running-indicator"
        @click="activity = true"
      >
        <span class="status-dot" />{{ activeRuns.length }} running
      </button>
    </div>
    <ProjectSidebar
      :collapsed="!sidebarOpen"
      id="projects-sidebar"
      :projects="state.projects"
      :selected="project?.id"
      @select="selectProject"
      @add="addProject"
      @star="starProject"
      @remove="requestRemoval"
      @copy="copy"
      @reveal="revealProject"
      @settings="settings = true"
      @about="about = 'overview'"
    />
    <div class="workspace-main">
      <div class="workspace-content">
        <BrandSplash v-if="!ready" />
        <BrandWelcome v-else-if="!bridge" desktop-only @story="about = 'story'" />
        <template v-else-if="project"
          ><WorktreeList
            :worktrees="worktrees"
            :selected="selectedPath"
            :loading="loading"
            :runs="runs"
            :error="contextError"
            @select="selectWorktree"
            @refresh="refreshContext(true)"
          /><WorktreeDetail
            v-if="worktree"
            :project="project"
            :worktree="worktree"
            :catalog="catalog"
            :runs="runs"
            :busy="busy"
            :gradle-busy="gradleBusy"
            @git-changed="refreshContext(true)"
            @navigate="selectWorktree"
            @android-started="inspect"
            @android-loaded="refreshContext(true)"
            @open="openFolder"
            @add-folder="addFolder"
            @remove-folder="removeFolder"
            @star-task="starTask"
            @start="startTask"
            @configure="portTask = $event"
            @custom="customDialog = true"
            @remove-custom="removeCustom"
            @gradle="gradle"
            @copy="copy"
          />
          <div v-else class="empty-inspector">
            <AppIcon name="GitFork" :size="32" />
            <p>{{ loading ? 'Reading this project…' : 'Select an available worktree.' }}</p>
          </div></template
        >
        <BrandWelcome v-else :busy="busy" @add="addProject" @story="about = 'story'" />
      </div>
    </div>
    <ActivityDock v-if="ready && bridge" v-model:open="activity" :runs="runs">
      <ActivityPanel
        compact
        :runs="runs"
        :selected="selectedRun"
        :logs="logs"
        :report="report"
        :scanning="scanning"
        :busy="busy"
        @inspect="inspect"
        @stop="stop"
        @scan="scan"
        @stop-external="stopExternal"
        @open-url="openUrl"
        @locate="locate"
      />
    </ActivityDock>
    <div v-if="error" class="error-notice" role="alert">
      <AppIcon name="TriangleAlert" :size="18" />
      <p>{{ error }}</p>
      <button
        v-tooltip="'Dismiss this error message.'"
        class="icon-button"
        aria-label="Dismiss error"
        @click="error = ''"
      >
        <AppIcon name="X" :size="16" />
      </button>
    </div>
    <div v-if="toast" class="toast" role="status">
      <AppIcon name="Check" :size="15" />{{ toast }}
    </div>
    <WorktreeSwitcher
      v-if="switcher"
      :projects="state.projects"
      :trees="switcherTrees"
      :errors="switcherErrors"
      :loading="switcherLoading"
      :busy="switcherBusy"
      :runs="runs"
      :selected-project="project?.id"
      :selected-path="selectedPath"
      @close="closeSwitcher"
      @select="switchToWorktree"
    />
    <BrandAbout
      v-if="about"
      :initial-story="about === 'story'"
      @close="about = null"
      @open-url="openUrl"
    />
    <RemoveProjectDialog
      v-if="removalProject"
      :project="removalProject"
      :running="removalRuns.length"
      :busy="removalBusy"
      :error="removalError"
      @close="closeRemoval"
      @confirm="confirmRemoval"
      @activity="viewRemovalActivity"
    />
    <FolderShortcutDialog
      v-if="folderPicker"
      :worktree-name="folderPicker.worktreeName"
      :worktree-path="folderPicker.worktree"
      :folders="folderPicker.folders"
      :listing="folderPicker.listing"
      :loading="folderPicker.loading"
      :saving="folderPicker.saving"
      :error="folderPicker.error"
      @browse="browseFolder"
      @save="saveFolder"
      @close="closeFolderPicker"
    />
    <CustomTaskDialog
      v-if="customDialog && project"
      :folders="project.folders"
      :busy="busy"
      @close="customDialog = false"
      @save="saveCustom"
    />
    <TaskPortDialog
      v-if="portTask"
      :task="portTask"
      :busy="busy"
      @close="portTask = undefined"
      @save="savePort"
    />
    <AppDialog v-if="conflict" title="A task needs your attention" @close="conflict = undefined"
      ><div class="form-stack">
        <p>{{ conflict.result.message }}</p>
        <p class="muted">Nothing was started in the selected worktree.</p>
        <footer class="dialog-actions">
          <button
            v-tooltip="'Leave the current process running and cancel the new task.'"
            class="button"
            @click="conflict = undefined"
          >
            Cancel</button
          ><button
            v-if="conflict.result.runId"
            v-tooltip="'Read the output of the task already using this port.'"
            class="button"
            @click="inspectConflict"
          >
            Inspect task</button
          ><button
            v-if="conflict.result.runId"
            class="button primary"
            :disabled="busy"
            v-tooltip="'Stop the conflicting task, then start this task in the selected worktree.'"
            @click="transfer"
          >
            Stop there &amp; start here</button
          ><button
            v-else
            v-tooltip="'Inspect the process using this port in Activity.'"
            class="button primary"
            @click="viewConflictActivity"
          >
            View Activity
          </button>
        </footer>
      </div></AppDialog
    >
    <AppPreferences
      v-if="settings"
      :state="state"
      @close="settings = false"
      @choose-app="chooseApp"
    />
  </div>
</template>

<style scoped>
.desktop-shell.sidebar-collapsed {
  grid-template-columns: 64px minmax(0, 1fr);
}
.desktop-shell.has-activity {
  grid-template-rows: 46px minmax(0, 1fr) auto;
}
.has-activity :deep(.sidebar) {
  grid-row: 1 / 3;
}
:deep(.activity-dock) {
  grid-column: 1 / -1;
  grid-row: 3;
  z-index: 2;
}
.titlebar {
  justify-content: flex-start;
  gap: 14px;
}
.sidebar-toggle {
  -webkit-app-region: no-drag;
}
.titlebar .running-indicator {
  margin-left: auto;
  -webkit-app-region: no-drag;
}

.switcher-trigger {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 16px;
  align-items: center;
}
.workspace-main {
  flex-direction: column;
}
.workspace-content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
