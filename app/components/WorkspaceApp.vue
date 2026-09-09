<script setup lang="ts">
const {
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
const about = shallowRef(false)
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
  <div class="desktop-shell">
    <div class="titlebar">
      <span class="titlebar-label">Workspace</span
      ><button
        v-if="activeRuns.length"
        v-tooltip="'Open Activity to inspect or stop running tasks across all projects.'"
        class="running-indicator"
        @click="activity = true"
      >
        <span class="status-dot" />{{ activeRuns.length }} running
      </button>
    </div>
    <ProjectSidebar
      :projects="state.projects"
      :selected="project?.id"
      :running="activeRuns.length"
      :activity="activity"
      @select="selectProject"
      @add="addProject"
      @star="starProject"
      @remove="requestRemoval"
      @copy="copy"
      @reveal="revealProject"
      @activity="activity = true"
      @settings="settings = true"
      @about="about = true"
    />
    <div class="workspace-main">
      <BrandSplash v-if="!ready" />
      <BrandWelcome v-else-if="!bridge" desktop-only />
      <ActivityPanel
        v-else-if="activity"
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
      <BrandWelcome v-else :busy="busy" @add="addProject" />
    </div>
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
    <BrandAbout v-if="about" @close="about = false" />
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
    <AppDialog v-if="settings" title="Preferences" @close="settings = false"
      ><div class="form-stack">
        <p class="muted">Choose the applications used by folder shortcuts.</p>
        <div
          v-for="entry in [
            { id: 'vscode' as const, label: 'VS Code' },
            { id: 'terminal' as const, label: 'Terminal' },
            { id: 'android-studio' as const, label: 'Android Studio' },
          ]"
          :key="entry.id"
          class="preference-row"
        >
          <div>
            <strong>{{ entry.label }}</strong
            ><span
              v-tooltip="state.apps[entry.id] || `Use the default ${entry.label} application.`"
              class="mono muted"
              >{{ state.apps[entry.id] || 'Default application' }}</span
            >
          </div>
          <button
            v-tooltip="
              `Choose the application used for ${entry.label} folder shortcuts. Saved immediately.`
            "
            class="button small"
            @click="chooseApp(entry.id)"
          >
            Choose…
          </button>
        </div>
        <div class="preference-note">
          <AppIcon name="Info" :size="17" />
          <p>
            Closing the window keeps your tasks running. Quitting Darsena stops the tasks it
            started. External processes stay independent.
          </p>
        </div>
      </div></AppDialog
    >
  </div>
</template>
