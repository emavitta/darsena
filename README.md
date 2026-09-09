<p align="center">
  <img src="public/brand/icon.png" width="80" height="80" alt="Darsena app icon">
</p>

<h1 align="center">Darsena</h1>

<p align="center">
  <strong>A harbor for your worktrees.</strong><br>
  Find the right checkout. Open your tools. Know what’s running, and where.
</p>

<p align="center">
  <a href="#use">Get started</a> ·
  <a href="https://github.com/emavitta/darsena/releases">Releases</a> ·
  <a href="docs/distribution.md">Build &amp; distribute</a>
</p>

<p align="center">
  <img src="public/brand/waterfront-v12.png" width="880" alt="Milan’s Darsena illustrated in blue, with Porta Ticinese, the oak and a historic tram">
</p>

<p align="center">
  <sub>Named after Milan’s Darsena. Made for the work happening on your Mac.</sub><br>
  <sub>macOS · Apple Silicon · Early preview</sub>
</p>

---

Darsena brings your Git worktrees, folder shortcuts and running tasks together.
Work on branches created by you, a teammate or an agent, using the tools you already know.

Built with **Electron, Nuxt 4, Vue 3 and TypeScript**.

## Use

Open `release/mac-arm64/Darsena.app`, or run from source with Node 24+ and pnpm:

```sh
pnpm install
pnpm dev
```

1. **Add project**: choose a Git repository or one of its linked worktrees.
2. Select a worktree. Discovery uses Git’s registry, regardless of who created it.
3. **Add shortcut**: browse subfolders inside that worktree using the built-in
   picker. Breadcrumbs stay within the worktree; folders already added are marked.
   The relative shortcut follows you across worktrees. Open it in VS Code,
   Terminal or Android Studio. This saves a shortcut, without creating or copying folders.
4. **Tasks → All tasks**: browse scripts, loaded Gradle tasks and custom commands
   together. **Sources** shows their folders and any sources still to load. Star the ones
   you use. Favorites belong to the project; definitions come from the selected
   worktree. Missing favorites remain visible as unavailable.
   Each row has an icon and readable tool badge; **All tools** filters by the
   recognized tool, including saved commands. Search also matches tool names.
5. **Run**: execute inside Darsena. **Activity** shows command, folder, worktree,
   status, output and Stop across all projects.

Pause over a control for a short explanation, or focus it with **Tab**.
Tooltips also explain Git states and unavailable actions. **Esc** dismisses a hint;
inside a dialog, press Esc again to close the dialog.

For mago-app, add `shells/wtc-android` and the service folders whose scripts you
want to browse. Adding projects or folders does not install or execute anything.

## Tasks and listening ports

- Reads package.json scripts and detects npm, pnpm, Yarn or Bun from each folder's
  `packageManager` field or lockfile, walking up to the worktree root as needed.
  Nested npm packages with their own lockfile do not inherit an outer pnpm/Yarn runner.
- **Tasks → Sources → Load tasks** on a folder containing `gradlew` gets a structured task report,
  including subprojects. This explicitly evaluates the Gradle build and requires
  a compatible JDK and working wrapper.
- **Custom command** supports an executable, separate arguments (one per line)
  and a relative folder for other toolchains and setup scripts. **Shell script**
  accepts a file path such as `scripts/dev.sh` and an explicit Bash, Zsh or Sh
  interpreter; executable permission is not required in this mode. Paths and
  arguments with spaces do not need surrounding quotes. Saving does not run it.
  Recognized executables get a tool icon; `.sh` files get a Shell icon and unknown
  commands keep a generic terminal icon. Recognition does not check installation
  or add automatic discovery. See [tool coverage and next steps](docs/task-tools.md).
- The task settings button declares an optional **exclusive TCP port**. Darsena
  checks for conflicts before launching; this does not configure the server or
  infer the port of an arbitrary script.
- When a managed task holds that port, **Stop there & start here** stops it
  before attempting the new execution. Failed starts remain visible with logs.
- **Activity → Listening ports** lists visible TCP listeners and associates
  them with worktrees when possible. Stopping an external process asks for
  confirmation and signals only that PID.

## Lifecycle and settings

Closing the window keeps Darsena and its tasks running. Reopen from the Dock.
**Quit Darsena** stops managed process groups before exiting. External processes
remain independent. Up to 30 completed runs and 524,288 characters of output per run are
retained during the app session.

Personal settings are saved atomically under Electron’s user data folder,
normally `~/Library/Application Support/Darsena/settings.json` on macOS.
**Preferences** configures alternative application bundles for folder shortcuts.
The app reads PATH and JAVA_HOME from your login shell when available.

Use **…** beside a project, or right-click its row, for **Show in Finder**,
**Copy project path** and **Remove from Darsena…**. Removal asks for confirmation
with the project's name and path. It forgets Darsena's saved settings for that
project; repository files and Git worktrees remain on disk. If the project has
active tasks, the dialog directs you to Activity to stop them first.

## First-version scope

No worktree creation/deletion, Git diff viewer, automatic worktree preparation,
shared `.darsena.json` import, interactive PTY or portless hostname management.
The file in `examples/` is an earlier design example, not a supported import format.

The commands you run require their own toolchains on your Mac. Darsena does not
install dependencies, Node, Java, or environment files. Interactive commands
should be run in the external Terminal for now.

Tasks should stay attached to their launching process group. Independent,
detached daemons and shared services such as a Gradle daemon are not claimed
as managed just because a task contacted or started them.

The current `.app` targets this Apple Silicon Mac for local use. Public
signing/notarization and additional build architectures are later delivery work.

## Development and checks

```sh
pnpm dev                 # Nuxt + Electron; frontend HMR
pnpm typecheck           # UI and desktop TypeScript
pnpm test                # Real Git, filesystem and process tests
pnpm build               # Static Nuxt UI + bundled desktop backend
pnpm start               # Run the built app
node --import tsx tests/ui-smoke.mjs
node --import tsx tests/tooltip-smoke.mjs
node --import tsx tests/folder-smoke.mjs
node --import tsx tests/task-sources-smoke.mjs
node --import tsx tests/task-readability-smoke.mjs
node --import tsx tests/project-removal-smoke.mjs
pnpm pack:mac            # Generate a local Apple Silicon .app
pnpm dist:mac            # Generate Apple Silicon DMG and ZIP; never uploads/publishes
node scripts/icons.mjs   # Regenerate Dock PNG and ICNS from the SVG master
```

`release/Darsena-0.1.0-arm64.dmg` installs by dragging Darsena to Applications.
`release/Darsena-0.1.0-arm64-mac.zip` contains the same app. These local builds are unsigned and not notarized;
Developer ID signing/notarization and Intel builds remain future distribution work.

The desktop smoke test uses isolated repositories and settings. It verifies
execution, a cross-worktree port conflict, transfer, window close and cleanup
on quit. It never runs mago-app tasks.

An optional real Gradle smoke test takes a local distribution and compatible
JDK, creates its own tiny multiproject build, and removes it afterward:

```sh
DARSENA_TEST_GRADLE=/path/to/gradle/bin/gradle JAVA_HOME=/path/to/jdk \
  node --import tsx tests/gradle-smoke.mjs
```

Backend edits require restarting `pnpm dev`. Frontend edits hot reload.
The development server uses `127.0.0.1:3141`.

## Builds and releases

[Build macOS](https://github.com/emavitta/darsena/actions/workflows/build-macos.yml)
is a manual GitHub Actions workflow: choose **Run workflow** to check the code,
test the desktop app and generate a DMG and ZIP on an Apple Silicon runner.
The download includes SHA-256 checksums and the source commit; artifacts are kept
for 14 days. The workflow does not publish a release.

For downloads you want to share, attach the installers to a
[GitHub Release](https://github.com/emavitta/darsena/releases). They can come from
Actions or a local `pnpm dist:mac` build. See the
[distribution guide](docs/distribution.md) for both paths and the exact CLI commands.

## Structure and design

- `app/`: Vue components and the workspace composable.
- `desktop/`: Git, discovery, process supervision, listeners and Electron bridge.
- `shared/`: typed bridge contracts.
- `public/brand/`: desktop icon master, small vector mark and harbor illustration.
- `design/`: independent identity proposals, comparison board and selected direction.
- `tests/`: isolated behavioral and desktop tests.

The app icon is a flat map of the Darsena basin and its two canals,
using ultramarine, off-white and neutral city blocks. It has gently curved banks,
no labels and three progressively shorter canal segments at each end. The basin
extends northwest; the canals join at its southeast end. The welcome and About
screens share an illustrated view of the basin, Porta Ticinese and a historic
Milan tram, in blue and pale gray. The working UI uses neutral surfaces in light/dark
appearance. Compare [the three new studies](design/proposals/cartografica-v2/preview.png)
or read [the current design notes](design/final/README.md).
Click **Darsena** at the top of the sidebar to view the illustration and app identity
at any time, including when projects are already present.

Earlier design discussion: [analysis](docs/analysis.md),
[task discovery](docs/task-discovery.md), [component boundaries](docs/components.md).
This README describes the implemented version; those documents retain proposals
that may belong to later increments.
