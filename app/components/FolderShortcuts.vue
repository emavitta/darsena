<script setup lang="ts">
import type { AppId, Folder } from '../../shared/types'
defineProps<{ folders: Folder[] }>()
const emit = defineEmits<{ open: [folder: string, app: AppId]; add: []; remove: [id: string] }>()
</script>
<template>
  <section class="detail-section">
    <div class="section-title">
      <h3>Open a folder</h3>
      <AppTooltip :text="'Choose a subfolder inside this worktree and save a shortcut for the project.'"><button
        
        class="text-button"
        @click="emit('add')"
      >
        <AppIcon name="Plus" :size="14" />Add shortcut
      </button></AppTooltip>
    </div>
    <div class="folder-list">
      <div v-for="folder in folders" :key="folder.id" class="folder-row">
        <div class="folder-symbol"><AppIcon name="FolderOpen" :size="19" /></div>
        <div class="folder-info">
          <strong>{{ folder.label }}</strong
          ><AppTooltip :text="
              folder.path === '.'
                ? 'The root folder of the selected worktree.'
                : `Relative to the selected worktree.\n${folder.path}`
            "><span
            
            class="mono truncate"
            >{{ folder.path === '.' ? 'Worktree root' : folder.path }}</span
          ></AppTooltip>
        </div>
        <div class="folder-actions">
          <AppTooltip :text="`Open ${folder.label} from the selected worktree in VS Code.`"><button
            class="icon-button folder-launch-button"
            :aria-label="`Open ${folder.label} in VS Code`"
            
            @click="emit('open', folder.path, 'vscode')"
          >
            <img
              class="application-icon"
              src="/apps/vscode.png"
              alt=""
              width="28"
              height="28"
              draggable="false"
            />
          </button></AppTooltip>
          <AppTooltip :text="`Open Terminal at ${folder.label} in the selected worktree.`"><button
            class="icon-button folder-launch-button"
            :aria-label="`Open ${folder.label} in Terminal`"
            
            @click="emit('open', folder.path, 'terminal')"
          >
            <img
              class="application-icon"
              src="/apps/terminal.png"
              alt=""
              width="28"
              height="28"
              draggable="false"
            />
          </button></AppTooltip>
          <AppTooltip :text="`Open ${folder.label} from the selected worktree in Android Studio.`"><button
            class="icon-button folder-launch-button"
            :aria-label="`Open ${folder.label} in Android Studio`"
            
            @click="emit('open', folder.path, 'android-studio')"
          >
            <img
              class="application-icon"
              src="/apps/android-studio.png"
              alt=""
              width="28"
              height="28"
              draggable="false"
            />
          </button></AppTooltip>
          <AppTooltip :text="'Remove this shortcut across the project. The folder stays on disk.'" v-if="folder.id !== 'root'"><button
            
            class="icon-button subtle"
            :aria-label="`Remove ${folder.label} shortcut`"
            
            @click="emit('remove', folder.id)"
          >
            <AppIcon name="X" :size="13" />
          </button></AppTooltip>
        </div>
      </div>
    </div>
    <p class="section-hint">
      Shortcuts open the same relative folder in whichever worktree you select.
    </p>
  </section>
</template>

<style scoped>
.folder-actions {
  display: grid;
  grid-template-columns: repeat(3, 34px) 30px;
}
.folder-actions .folder-launch-button {
  width: 34px;
  height: 34px;
  padding: 0;
}
.application-icon {
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}
</style>
