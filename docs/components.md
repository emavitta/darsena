# UI boundaries for the first implementation

- `WorkspaceApp` composes the application shell and connects explicit events to
  `useWorkspace`; it does not implement task or Git services.
- `BrandWelcome` presents the harbor artwork and first-project action; receives desktop-only/busy flags and emits add.
- `BrandIdentity` presents the shared large app icon, wordmark and optional caption.
- `BrandSplash` presents that identity and the startup status while workspace state loads;
  it introduces no timer or artificial startup delay.
- `HarborArtwork` presents the shared blue-and-gray illustration on a light plate
  in both system color schemes. Its panorama follows the user's photograph of the basin;
  the gate and inland oak remain in the distance, with a historic tram on the raised road.
- `v-tooltip` provides shared hover/focus hints in the browser top layer, including
  inside native dialogs; preserves accessible labels, dismisses on Escape and
  cleans up when its trigger is removed. Copy stays with the relevant component.
- `BrandAbout` presents the identity and artwork in a dialog; emits close.
- `ProjectSidebar` receives projects, selected ID and active count; emits
  project selection, favorite, removal, add, activity, settings and about actions.
- `ProjectSidebarItem` owns one project row and its accessible action menu;
  receives a project and selection flag, emits select, star, remove, copy and reveal.
  Context clicks do not select a project; the native popover handles outside dismissal.
- `RemoveProjectDialog` receives the removal target, running count, busy state and
  error; emits confirm, close and activity. `useWorkspace` pins the target by ID,
  keeps errors in the dialog and preserves the backend's active-task guard.
- `WorktreeList` receives worktrees and runs, owns its text filter, and emits
  selection and refresh.
- `WorktreeDetail` composes folder shortcuts and task selection for one worktree.
- `FolderShortcuts` receives relative folder targets and emits open/add/remove.
- `FolderShortcutDialog` presents one directory level, breadcrumbs and saved
  shortcut state; owns its text filter and emits browse/save/close. `useWorkspace`
  pins the dialog to the worktree it opened from, guards stale reads, and keeps
  errors inside the dialog. The desktop API validates both browsing and saving.
- `TaskList` receives the unified task catalog, favorites and runs; owns its filter
  and emits favorite, start, configure, source loading and custom-task removal.
- `TaskToolBadge` receives a task tool descriptor and presents an icon and text
  badge with a tool-specific color. `TaskToolIcon` renders bundled SVG paths or a
  semantic Lucide fallback. `taskTool` derives the identity from the actual package
  manager or the saved executable (including known wrappers); the same descriptor
  drives search and the tool filter. This classification does not change execution.
- `TaskSources` receives source readiness and a loading flag, presents a compact
  disclosure inside Tasks, and emits an explicit load request for a Gradle folder.
  It does not split the task list by toolchain or invoke the desktop bridge.
- `ActivityPanel` receives runs, listening ports and selected logs; emits
  inspect/stop/open actions without changing the selected worktree implicitly.
- `AppDialog`, `CustomTaskDialog` and `TaskPortDialog` own modal presentation
  and forms. `CustomTaskDialog` offers a shell-script preset with an explicit
  interpreter and a relative file path; it saves through the existing custom
  command API. The native dialog element handles modal focus.
- `useWorkspace` owns desktop state, refreshes with stale-result guards, and
  invokes the typed preload API. Children use props down, events up.

Nuxt is a local SPA. Only the Electron backend accesses Git, filesystem,
application launching and task processes. No task data is rendered as HTML.

Tooltip behavior follows the [ARIA tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/),
using the [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)
to avoid clipping at scroll containers and native dialogs.
