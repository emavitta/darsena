<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { AppState, AppId } from '../../shared/types'
defineProps<{ state: AppState }>()
const emit = defineEmits<{ close: []; chooseApp: [app: Exclude<AppId, 'finder'>] }>()
const tab = shallowRef('apps')
const openTooltip = shallowRef<string | null>(null)
function dismissTooltip(event: KeyboardEvent) {
  // Consume Escape before the browser dispatches a cancel event to the native dialog.
  event.preventDefault()
  event.stopPropagation()
  openTooltip.value = null
}
const dialogId = `preferences-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const sections = [
  { label: 'Applications', value: 'apps', slot: 'applications' },
  { label: 'MCP', value: 'mcp', slot: 'mcp' },
] satisfies TabsItem[]
const applications = [
  { id: 'vscode', label: 'VS Code' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'android-studio', label: 'Android Studio' },
] as const
</script>

<template>
  <AppDialog :id="dialogId" class="preferences-dialog" title="Preferences" wide @close="emit('close')">
    <UTabs
      v-model="tab"
      :items="sections"
      class="preference-tabs"
      color="primary"
      variant="pill"
      size="md"
      activation-mode="automatic"
      :ui="{ list: 'nuxt-ui-scope w-fit self-start mb-5', trigger: 'min-h-10 px-4 text-[13px]', content: 'outline-none' }"
    >
      <template #applications>
        <section class="application-preferences nuxt-ui-scope" aria-label="Application shortcuts">
          <p class="application-intro">Choose the applications used by folder shortcuts.</p>
          <div v-for="entry in applications" :key="entry.id" class="application-choice">
            <img :src="`/apps/${entry.id}.png`" alt="" width="32" height="32" draggable="false" />
            <div class="application-identity">
              <strong class="application-name">{{ entry.label }}</strong>
              <span class="application-path mono">{{ state.apps[entry.id] || 'Default application' }}</span>
            </div>
            <UTooltip
              :text="`Choose the macOS application used for ${entry.label} folder shortcuts. Saved immediately.`"
              :portal="`#${dialogId}`"
              :delay-duration="350"
              :content="{ side: 'top', onEscapeKeyDown: dismissTooltip }"
              :open="openTooltip === entry.id"
              @update:open="openTooltip = $event ? entry.id : openTooltip === entry.id ? null : openTooltip"
              :ui="{ content: 'nuxt-ui-scope max-w-72 h-auto py-2 text-[13px]', text: 'whitespace-normal' }"
            >
              <UButton
                color="neutral"
                variant="outline"
                size="md"
                class="min-h-8 text-[13px]"
                :aria-label="`Choose ${entry.label} application`"
                @click="emit('chooseApp', entry.id)"
              >Choose…</UButton>
            </UTooltip>
          </div>
          <UAlert
            class="application-lifecycle"
            color="neutral"
            variant="soft"
            title="Your tasks stay with Darsena"
            description="Closing the window keeps your tasks running. Quitting Darsena stops the tasks it started. External processes stay independent."
            :ui="{ title: 'text-[13px] font-medium', description: 'text-[13px] leading-relaxed' }"
          >
            <template #leading><AppIcon name="Info" :size="18" /></template>
          </UAlert>
        </section>
      </template>
      <template #mcp><McpSettings :projects="state.projects" /></template>
    </UTabs>
  </AppDialog>
</template>

<style scoped>
:deep(.dialog-header) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg);
}
.application-intro {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}
.application-choice {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}
.application-choice > img { flex-shrink: 0; }
.application-identity { min-width: 0; flex: 1; }
.application-name { display: block; font-size: 15px; font-weight: 600; }
.application-path {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.application-lifecycle { margin-top: 24px; }
</style>
