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
  Context clicks do not select a project; Nuxt UI handles keyboard navigation and outside dismissal.
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

## Nuxt UI adoption

Preferences → Applications is the first Nuxt UI surface: tabs, application-picker
buttons, tooltips and the lifecycle information notice. `AppPreferences` preserves
its existing state and events; Electron still owns application selection and storage.
MCP settings, worktree and Activity layouts, brand artwork and the story map keep
their dedicated components.

Keep the native `AppDialog` during this stage. The story reader and existing
focus/scroll behavior depend on its `<dialog>` element. Nuxt UI overlays inside it
must remain in that dialog's top layer rather than teleporting to `body`.

Shared controls should use centrally configured sizes and semantic colors instead
of adding new one-off button styles. Both old and new components follow the same
system light/dark preference. Preserve the existing macOS font stack and include
all icons in the static renderer: no fonts or icons should be fetched at runtime.
Do not weaken the desktop Content Security Policy to accommodate UI assets.

The Preferences smoke test exercises choosing and persisting an application,
keyboard tabs, tooltip visibility, dialog focus restoration, both themes, the
minimum window size and the absence of external renderer requests. It also runs
against the packaged app in the macOS build workflow.

References: [Nuxt UI](https://ui.nuxt.com/docs/getting-started/installation/nuxt),
[offline icons](https://nuxt.com/modules/icon).

## Task forms and the Activity dock

`CustomTaskDialog` and `TaskPortDialog` use Nuxt UI fields, inputs, radio controls
and buttons while preserving their existing save contracts and native dialogs.
Folder and interpreter selectors remain native. Port checks accept an integer
from 1 to 65535 or blank; saving a port does not change the server configuration.

`ActivityDock` stays below the workspace, exposes the active count while collapsed,
and provides normal/enlarged panel heights. Its `open` model is the workspace's
existing Activity state. `ActivityPanel` and `ActivityRunList` expose a compact
presentation for the dock, preserving Running/History, stop actions and logs.
Changing project/worktree does not close it or change the selected run. Only the
explicit worktree link in a run navigates to that run's checkout.

## Action menus

Project and selected-worktree actions use Nuxt UI dropdown menus, with shared
readable sizing in app.config.ts. Project context clicks preserve selection.
The worktree menu emits the existing open/copy events; application icons are
bundled locally. Folder launch shortcuts remain directly accessible.

## Global worktree switcher

WorktreeSwitcher presents a Nuxt UI command palette inside the native AppDialog.
It receives project/worktree snapshots and live runs; emits select(projectId,
path) and close. Branches and complete wrapping paths remain visible.
useWorkspace reads all saved projects on opening, ignores stale results after
dismissal and reports failures per project. Selection uses existing IPC actions,
does not change Git branches or the Activity dock, and prevents duplicate submits.
The global shortcut does not open over another dialog. The local list filter
continues to filter only the selected project.

TaskList groups filtered tasks by working folder in both Favorites and All tasks.
Headers use the saved shortcut label plus the complete relative path, with the
worktree root first. Toolchains share the same folder group; filters omit empty groups.

## Android deployment

AndroidLaunchDialog uses Nuxt UI selectors and buttons inside the native dialog;
selector portals stay inside it and Escape closes the selector first.
useAndroidLaunch pins project/worktree context, fetches devices and variants,
and reports local errors. WorkspaceService remains the existing task owner;
Android launches are handled by validated desktop IPC through the shared Runner.

The bundled Android worker builds a selected Gradle variant, validates AGP APK
metadata and output containment, installs to an explicit ADB serial, then starts
the launcher activity. It inherits the managed process group so cancellation and
Quit stop deployment. Run history describes deployment, not the remote app lifetime.
The Android endpoints are not exposed through MCP.

Folder groups use Nuxt UI collapsibles with compact one-line headers. Groups start
open; local collapse choices survive filtering, while active filters reveal matches.
The header retains the folder label, relative path and filtered task count.

ActivityDock is an inset card with its own border and toolbar, separated from
the project sidebar and worktree columns. Its explicit disclosure exposes summary
information while collapsed. WorkspaceApp can hide/show the project sidebar
without changing selection, running tasks or the dock state.

Task tool identifiers use compact 16px bundled color logos and neutral labels,
without colored badge backgrounds or borders. Generic commands retain semantic icons.
Brand artwork attribution is in public/task-logos/README.md.

Android deployment is a synthetic catalog task per Gradle folder, with stable
favorites, filtering and run identity. Its Run action opens the device/variant
dialog pinned to that folder. Generic task execution rejects this action because
it needs interactive device selection; ordinary Gradle commands remain separate tasks.

The project sidebar collapses to a 64px Nuxt UI rail with project monograms,
tooltips, About, Add and Preferences. Activity occupies a separate full-width
row spanning both sidebar and workspace, in either sidebar state.
