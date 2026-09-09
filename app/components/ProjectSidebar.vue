<script setup lang="ts">
import type { Project } from '../../shared/types'
const props = defineProps<{
  projects: Project[]
  selected?: string
  running: number
  activity: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  add: []
  star: [id: string]
  remove: [id: string]
  copy: [path: string]
  reveal: [id: string]
  activity: []
  settings: []
  about: []
}>()
const sorted = computed(() =>
  [...props.projects].sort((a, b) => Number(b.starred) - Number(a.starred)),
)
</script>
<template>
  <aside class="sidebar">
    <button
      class="sidebar-brand"
      aria-label="About Darsena"
      v-tooltip="'View the app version and Darsena artwork.'"
      @click="emit('about')"
    >
      <img class="sidebar-app-icon" src="/brand/icon.png" width="34" height="34" alt="" />
      <span>darsena</span>
    </button>
    <div class="sidebar-content">
      <button
        v-tooltip="'See running tasks, logs and listening ports across all your projects.'"
        class="navigation-button"
        :class="{ selected: activity }"
        @click="emit('activity')"
      >
        <AppIcon name="Activity" /><span>Activity</span
        ><span v-if="running" class="count accent">{{ running }}</span>
      </button>
      <div class="section-caption">
        <span>Projects</span
        ><button
          v-tooltip="'Choose a local Git repository to discover its worktrees.'"
          class="icon-button small"
          aria-label="Add project"
          @click="emit('add')"
        >
          <AppIcon name="Plus" :size="15" />
        </button>
      </div>
      <ProjectSidebarItem
        v-for="project in sorted"
        :key="project.id"
        :project="project"
        :selected="selected === project.id && !activity"
        @select="emit('select', project.id)"
        @star="emit('star', project.id)"
        @remove="emit('remove', project.id)"
        @copy="emit('copy', project.root)"
        @reveal="emit('reveal', project.id)"
      />
      <button
        v-tooltip="'Choose a local Git repository to discover its worktrees.'"
        class="add-project"
        data-project-add
        @click="emit('add')"
      >
        <AppIcon name="Plus" :size="15" />Add project
      </button>
    </div>
    <div class="sidebar-bottom">
      <p
        v-tooltip="'Projects, preferences and task processes are managed on this Mac.'"
        class="local-note"
      >
        <span class="status-dot" />Local to your Mac
      </p>
      <button
        v-tooltip="'Choose folder applications and configure MCP access for AI tools.'"
        class="navigation-button"
        @click="emit('settings')"
      >
        <AppIcon name="Settings2" /><span>Preferences</span><span class="version">0.1</span>
      </button>
    </div>
  </aside>
</template>
