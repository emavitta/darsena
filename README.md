<p align="center">
  <img src="public/brand/icon.png" width="80" height="80" alt="Darsena app icon">
</p>

<h1 align="center">Darsena</h1>

<p align="center">
  <strong>A harbor for your worktrees.</strong><br>
  Find the right checkout. Open your tools. Know what’s running, and where.
</p>

<p align="center">
  <a href="#download">Download for macOS</a> ·
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

## Download

**[Download Darsena v0.1.0 for macOS — Apple Silicon (DMG)](https://github.com/emavitta/darsena/releases/download/v0.1.0/Darsena-0.1.0-arm64.dmg)**

The first public preview is available on [GitHub Releases](https://github.com/emavitta/darsena/releases/tag/v0.1.0).
Open the DMG and drag **Darsena** into **Applications**. A
[ZIP containing the same app](https://github.com/emavitta/darsena/releases/download/v0.1.0/Darsena-0.1.0-arm64-mac.zip)
is also available. Choose a DMG or app ZIP from the release assets; GitHub's
automatic **Source code** archives are for development.

This preview supports **Apple Silicon Macs (M-series)**. It is unsigned and not
notarized, so macOS may display a security warning when opening it. Intel Mac
and Windows installers are not available yet.

Each release includes [SHA-256 checksums](https://github.com/emavitta/darsena/releases/download/v0.1.0/SHA256SUMS-macos-arm64.txt)
and a [build manifest](https://github.com/emavitta/darsena/releases/download/v0.1.0/build-macos-arm64.json)
recording the version, target and exact source commit. Install updates manually
from [Releases](https://github.com/emavitta/darsena/releases); in-app updating is
not implemented yet.

Git and your projects' toolchains need to be installed separately. To run
Darsena from source, see [Development and checks](#development-and-checks).

## Use

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

The public preview targets macOS on Apple Silicon. Developer ID signing,
notarization and additional build architectures remain future work.

## Development and checks

From a checkout of this repository, use Node 24+ and the pnpm version declared
in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Available development and build commands:

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

`pnpm pack:mac` writes `release/mac-arm64/Darsena.app`. `pnpm dist:mac` also
creates versioned DMG and ZIP installers under `release/`. These commands build
locally; they do not upload files or create a GitHub Release.

The desktop smoke test uses isolated repositories and settings.
`DARSENA_DATA_DIR` selects a separate settings profile, including in packaged builds. It verifies
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

The [v0.1.0 macOS preview](https://github.com/emavitta/darsena/releases/tag/v0.1.0)
was built and tested on GitHub Actions and is publicly downloadable. The
following workflows are already active:

| Workflow | Trigger | Result |
| --- | --- | --- |
| [CI](https://github.com/emavitta/darsena/actions/workflows/ci.yml) | PRs targeting `main`, pushes to `main`, or a manual run | Type checks, backend tests, application build and desktop checks. **Validate macOS** must pass before a PR can merge. |
| [Build macOS](https://github.com/emavitta/darsena/actions/workflows/build-macos.yml) | Manual run, or called by the release workflow | Tested Apple Silicon DMG and ZIP, checksums and source manifest in the `darsena-macos-arm64` artifact. Retained for **14 days**. |
| [Prepare release](https://github.com/emavitta/darsena/actions/workflows/release.yml) | Push a `v*` version tag | Runs Build macOS, verifies the downloaded checksums and creates a **draft pre-release** with the installers and release notes. |

Build macOS tests the **packaged application**, including task execution, port
conflicts, window close, cleanup on Quit and project removal. Tests use
disposable repositories and isolated settings.

To publish the next version:

1. Update `package.json` and add `docs/releases/vX.Y.Z.md` through a PR to `main`.
2. After merging, tag the release commit and push the tag. The tag must match
   the package version, for example `v0.1.1` for version `0.1.1`.
3. Wait for **Prepare release** to finish, then review the notes and try the
   installers attached to its draft.
4. Publish the draft from [GitHub Releases](https://github.com/emavitta/darsena/releases).
   A published pre-release is publicly downloadable; a draft is not.

Actions artifacts are temporary and require a GitHub login to download. Use
published Releases for public download links. Changed installers get a new
version: the workflow refuses to replace an already published release.

Local `pnpm dist:mac` builds can also be attached to a release draft. See the
[distribution guide](docs/distribution.md) for the commands, checksum generation
and both distribution paths.

Windows is deferred; the unfinished port is preserved on
[`feat/windows-preview`](https://github.com/emavitta/darsena/tree/feat/windows-preview).
It is not part of the current downloads.

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
