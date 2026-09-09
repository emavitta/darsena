<script setup lang="ts">
import type { Project } from '../../shared/types'
defineProps<{ projects: Project[] }>()
const { status, busy, error, notice, perform, copyConfiguration, rotateToken } = useMcpSettings()
const port = shallowRef('3142')
watch(
  () => status.value?.port,
  (value) => {
    if (value) port.value = String(value)
  },
)
const validPort = computed(
  () => /^\d+$/.test(port.value) && Number(port.value) >= 1024 && Number(port.value) <= 65535,
)
</script>

<template>
  <div class="mcp-settings" :aria-busy="busy">
    <div class="mcp-intro">
      <h3>Connect your AI tools</h3>
      <p>Let MCP clients find your worktrees, inspect activity and run the tasks you allow.</p>
    </div>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="mcp-notice" role="status">{{ notice }}</p>
    <template v-if="status">
      <div class="mcp-connection">
        <label class="checkbox-label"
          ><input
            type="checkbox"
            :checked="status.enabled"
            :disabled="busy"
            @change="
              perform('mcpConfigure', {
                enabled: ($event.target as HTMLInputElement).checked,
                port: status.port,
              })
            "
          />Enable local MCP</label
        >
        <span class="mcp-state"
          ><span class="status-dot" :class="{ neutral: !status.listening }" />{{
            status.listening ? 'Listening' : status.enabled ? 'Unavailable' : 'Off'
          }}</span
        >
      </div>
      <p v-if="status.error" role="alert" class="inline-error">{{ status.error }}</p>
      <div class="mcp-endpoint">
        <code>{{ status.url || `http://127.0.0.1:${status.port}/mcp` }}</code
        ><button
          class="button small"
          :disabled="busy || !status.listening"
          @click="copyConfiguration"
        >
          Copy client configuration
        </button>
      </div>
      <p class="section-hint">
        Paste the HTTP configuration into your MCP client. It includes a private token; only share
        it with clients you trust. Clients running on another computer cannot reach this local
        endpoint.
      </p>
      <details class="mcp-advanced">
        <summary>Connection settings</summary>
        <div class="mcp-advanced-body">
          <form
            class="mcp-port"
            @submit.prevent="
              perform('mcpConfigure', { enabled: status.enabled, port: Number(port) })
            "
          >
            <label
              >Local port<input
                v-model="port"
                type="number"
                min="1024"
                max="65535"
                required /></label
            ><button
              class="button small"
              :disabled="busy || !validPort || Number(port) === status.port"
            >
              Save port
            </button>
          </form>
          <button class="text-button" :disabled="busy" @click="rotateToken">
            Replace connection token
          </button>
          <p class="section-hint">
            Replacing the token revokes every existing client configuration. Copy the new one to
            reconnect.
          </p>
        </div>
      </details>
      <div class="mcp-access-heading">
        <h3>Shared projects</h3>
        <p>
          Sharing permits reading worktrees, task definitions, logs and associated ports. Task
          execution starts disabled.
        </p>
      </div>
      <McpProjectAccess
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :allowed="Object.hasOwn(status.projects, project.id)"
        :task-ids="status.projects[project.id]?.tasks || []"
        :busy="busy"
        @access="perform('mcpProject', { projectId: project.id, allowed: $event })"
        @task="perform('mcpTask', $event)"
      />
      <p v-if="!projects.length" class="section-hint">
        Add a project to Darsena, then choose whether to share it here.
      </p>
      <p class="section-hint">
        Authorized tasks execute the code in the requested worktree. Logs can contain application
        secrets. Share projects whose code and output you trust.
      </p>
      <div class="preference-note">
        <AppIcon name="Info" :size="17" />
        <p>
          MCP stays available when you close the window. Quit Darsena stops MCP and managed tasks.
          Disabling MCP or replacing its token leaves running tasks available in Activity.
        </p>
      </div>
    </template>
    <p v-else-if="busy" role="status" class="muted">Loading MCP settings…</p>
  </div>
</template>

<style scoped>
.mcp-settings {
  display: grid;
  gap: 18px;
}
.mcp-settings p,
.mcp-settings h3 {
  margin: 0;
}
.mcp-intro,
.mcp-access-heading {
  display: grid;
  gap: 8px;
}
.mcp-intro p,
.mcp-access-heading p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.mcp-connection,
.mcp-endpoint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.mcp-connection {
  margin-top: 4px;
}
.mcp-state {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}
.mcp-endpoint {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--pane);
  flex-wrap: wrap;
}
.mcp-endpoint code {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.mcp-advanced {
  font-size: 13px;
  color: var(--muted);
}
.mcp-advanced summary {
  cursor: pointer;
}
.mcp-advanced-body {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding-top: 16px;
}
.mcp-port {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.mcp-port label {
  display: grid;
  gap: 7px;
}
.mcp-port input {
  width: 110px;
}
.mcp-access-heading {
  border-top: 1px solid var(--line);
  padding-top: 20px;
}
.mcp-notice {
  color: var(--accent);
  font-size: 13px;
}
</style>
