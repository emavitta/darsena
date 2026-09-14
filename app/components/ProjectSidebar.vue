<script setup lang="ts">
import type { Project } from '../../shared/types'
const props = defineProps<{
  collapsed?: boolean
  projects: Project[]
  selected?: string
}>()
const emit = defineEmits<{
  select: [id: string]
  add: []
  star: [id: string]
  remove: [id: string]
  copy: [path: string]
  reveal: [id: string]
  settings: []
  about: []
}>()
const sorted = computed(() =>
  [...props.projects].sort((a, b) => Number(b.starred) - Number(a.starred)),
)
</script>
<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div v-if="collapsed" class="sidebar-rail nuxt-ui-scope">
      <AppTooltip :text="'About Darsena'"><UButton
        color="neutral"
        variant="ghost"
        class="rail-button"
        aria-label="About Darsena"
        
        @click="emit('about')"
        ><img src="/brand/icon.png" width="28" height="28" alt=""
      /></UButton></AppTooltip>
      <div class="rail-projects">
        <AppTooltip :text="project.name + '\n' + project.root" v-for="project in sorted"><UButton
          
          :key="project.id"
          color="neutral"
          :variant="selected === project.id ? 'soft' : 'ghost'"
          class="rail-button rail-project"
          :class="{ current: selected === project.id }"
          :aria-label="project.name"
          :aria-pressed="selected === project.id"
          :data-project-selected="selected === project.id"
          
          @click="emit('select', project.id)"
        >
          {{
            project.name
              .replace(/[^a-z0-9]/gi, '')
              .slice(0, 2)
              .toUpperCase()
          }}
          <span v-if="project.starred" class="rail-star" aria-hidden="true">•</span>
        </UButton></AppTooltip>
        <AppTooltip :text="'Add project'"><UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-plus"
          class="rail-button"
          aria-label="Add project"
          data-project-add
          
          @click="emit('add')"
        /></AppTooltip>
      </div>
      <AppTooltip :text="'Preferences'"><UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-settings-2"
        class="rail-button rail-settings"
        aria-label="Preferences 0.1"
        
        @click="emit('settings')"
      /></AppTooltip>
    </div>
    <template v-else>
      <AppTooltip :text="'About Darsena: app version, artwork and the story behind the icon.'"><button
        class="sidebar-brand"
        aria-label="About Darsena"
        
        @click="emit('about')"
      >
        <img class="sidebar-app-icon" src="/brand/icon.png" width="34" height="34" alt="" />
        <span>darsena</span>
      </button></AppTooltip>
      <div class="sidebar-content">
        <div class="section-caption">
          <span>Projects</span
          ><AppTooltip :text="'Choose a local Git repository to discover its worktrees.'"><button
            
            class="icon-button small"
            aria-label="Add project"
            @click="emit('add')"
          >
            <AppIcon name="Plus" :size="15" />
          </button></AppTooltip>
        </div>
        <ProjectSidebarItem
          v-for="project in sorted"
          :key="project.id"
          :project="project"
          :selected="selected === project.id"
          @select="emit('select', project.id)"
          @star="emit('star', project.id)"
          @remove="emit('remove', project.id)"
          @copy="emit('copy', project.root)"
          @reveal="emit('reveal', project.id)"
        />
        <AppTooltip :text="'Choose a local Git repository to discover its worktrees.'"><button
          
          class="add-project"
          data-project-add
          @click="emit('add')"
        >
          <AppIcon name="Plus" :size="15" />Add project
        </button></AppTooltip>
      </div>
      <div class="sidebar-bottom">
        <AppTooltip :text="'Projects, preferences and task processes are managed on this Mac.'"><p
          
          class="local-note"
        >
          <span class="status-dot" />Local to your Mac
        </p></AppTooltip>
        <AppTooltip :text="'Choose folder applications and configure MCP access for AI tools.'"><button
          
          class="navigation-button"
          @click="emit('settings')"
        >
          <AppIcon name="Settings2" /><span>Preferences</span><span class="version">0.1</span>
        </button></AppTooltip>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.sidebar-rail {
  display: flex;
  align-items: center;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
  padding: 14px 8px 10px;
}
.rail-projects {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
}
.rail-button {
  width: 40px;
  min-height: 40px;
  justify-content: center;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}
.rail-project {
  position: relative;
  font-size: 13px;
  font-weight: 600;
}
.rail-project.current {
  color: var(--accent);
  box-shadow: inset 2px 0 var(--accent);
}
.rail-star {
  position: absolute;
  right: 4px;
  top: 0;
  color: var(--terracotta);
}
</style>
