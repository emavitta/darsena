<p align="center">
  <img src="public/brand/icon.png" width="80" height="80" alt="Darsena: a harbor, canals, a gate, an oak and a tram seen from above">
</p>

<h1 align="center">Darsena</h1>

<p align="center">
  <strong>A harbor for your worktrees.</strong><br>
  Find the right checkout. Open your tools. Know what’s running, and where.
</p>

<p align="center">
  <a href="#download">Download for macOS</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="#android">Android</a> ·
  <a href="#connect-an-ai-client">Connect an AI client</a>
</p>

<p align="center">
  <img src="public/brand/waterfront-v12.png" width="880" alt="Milan’s Darsena, with Porta Ticinese, an oak and a historic tram">
</p>

<p align="center"><sub>macOS · Apple Silicon &amp; Intel</sub></p>

## Why Darsena?

Working on several branches often means juggling folders, editor windows and
terminals. When each checkout has its own development server, it becomes easy to
lose track of which version is running or where a command was started.

Darsena brings your Git worktrees, project folders and development tasks into one
place. A worktree is a separate checkout of a repository, usually on a different
branch. Whether you work alone, with teammates or with coding agents, Darsena helps
you move between those checkouts and keep their running processes in view.

Keep using your editor, terminal and Android Studio. Use Darsena to open them in
the right folder, start frequent tasks and inspect their output without losing
your place.

## Download

**[Download Darsena 1.0.0-rc.2](https://github.com/emavitta/darsena/releases/tag/v1.0.0-rc.2)** — a macOS release candidate.

| Your Mac | Installer |
| --- | --- |
| Apple Silicon (M-series) | [Download DMG](https://github.com/emavitta/darsena/releases/download/v1.0.0-rc.2/Darsena-1.0.0-rc.2-arm64.dmg) |
| Intel | [Download DMG](https://github.com/emavitta/darsena/releases/download/v1.0.0-rc.2/Darsena-1.0.0-rc.2-x64.dmg) |

Both installers are signed with Developer ID and notarized by Apple.
Open the DMG and drag Darsena into **Applications**. If you already have Darsena,
quit it completely before replacing it; your saved projects and settings are kept.
ZIP downloads are also available on the release page.

You need Git and the tools your projects use, such as Node.js or a Java JDK,
installed on your Mac. Darsena does not install these for you. Windows and Linux
installers are not currently available.

### Updates

Darsena checks GitHub Releases for newer versions. Open **About** to check manually
and read release notes. The RC2 download above uses manual installation: download
the matching DMG, quit Darsena and replace the app in Applications.

Release candidates also check for newer prereleases. Stable versions check for
stable releases. Checking for updates does not interrupt running tasks.

## Get started

1. **Add a project.** Choose a Git repository or one of its linked worktrees.
   Darsena finds the worktrees registered with Git.
2. **Choose a worktree.** See its branch, path and local changes. Press **⌘K**
   to search across all your saved projects and worktrees.
3. **Open a folder.** Launch VS Code, Terminal or Android Studio in the selected
   checkout. Add shortcuts for folders you visit often; the same relative shortcut
   follows you when you switch worktrees. In supported monorepos, Darsena can
   suggest folders from pnpm, npm, Yarn or Bun workspace settings.
4. **Find your tasks.** Open **Tasks → All tasks**, search or filter by tool,
   and star the commands you use most. Favorites belong to the project, while
   their commands come from the selected worktree.
5. **Run and inspect.** Start a task and open **Activity** at the bottom to see
   its status, working folder and output.

Adding a project or folder does not execute its scripts. Removing a project from
Darsena leaves its repository and worktrees on disk.

## Tasks, logs and ports

Darsena reads `package.json` scripts and recognizes npm, pnpm, Yarn and Bun.
For Gradle projects, explicitly load tasks from a folder containing `gradlew`;
this evaluates the Gradle build and needs a compatible Java installation.

Use **Custom command** for other tools or shell scripts. Choose the executable,
arguments and working folder, then save it for reuse. **Prepare worktree** lets
you save a setup command for the project and run it explicitly in a checkout.

The **Activity** panel stays available as you navigate. Collapsed, it shows a
brief summary; expanded, it shows runs, logs and listening ports. You can follow
output, open links printed by a task, stop an individual run or stop all managed
tasks. Collapsing the panel does not stop anything.

If a task needs an exclusive TCP port, declare it in the task’s settings. Darsena
checks for conflicts before starting it. When another managed task holds the
port, **Stop there & start here** lets you move the execution to the selected
worktree. This setting checks the port; it does not change the server’s own
configuration.

**Listening ports** also shows visible servers started outside Darsena, with
worktree associations when they can be determined. Stopping an external process
requires confirmation.

### Check your environment

Expand **Environment** in a worktree and choose **Check environment** to inspect
tool paths available to Darsena, including Java and Android platform-tools when
relevant. Missing tools include guidance on what to configure. Finding an
executable does not guarantee that its version is compatible with your project.

### Closing the app

Closing the window leaves Darsena and its tasks running. Reopen it from the Dock.
**Quit Darsena (⌘Q)** stops tasks managed by Darsena before exiting. External
processes and independent services remain separate. Completed runs and their
output are kept for the current app session.

## Git at a glance

See branches, upstream tracking and local changes for the main checkout and
linked worktrees. **Branches** shows local and remote branches and the worktrees
using them.

- **Fetch** refreshes remote references without changing working files.
- **Pull (ff-only)** updates the selected worktree only when it can fast-forward.
  Commit or stash local changes and stop its running tasks first.

Darsena does not automatically merge, rebase or stash changes. Resolve divergent
branches and unfinished Git operations in your usual Git tool. Worktree creation,
deletion and diff viewing are not part of Darsena.

## Android

Choose **Run on Android** in a folder containing a Gradle wrapper. Load the
available modules and build variants, select an authorized device or an already
running emulator, then **Build, install & launch**.

Darsena remembers the last variant and device for that project folder across
worktrees. If either is unavailable, you choose a replacement explicitly.
Deployment logs appear in Activity. After deployment succeeds, the Android app
runs independently on the device; stopping the deployment task does not close
an already installed app.

Use the device actions to start, stop or restart an installed app. Clearing app
data and uninstalling require confirmation. **Follow Logcat** shows app logs with
search, severity filtering and text export; stopping Logcat leaves the app running.

Installing the same application ID from another worktree updates the existing
app on that device. Darsena supports a single universal APK; use Android Studio
for split-only APKs, starting emulators and attaching a debugger.

## Connect an AI client

Darsena includes an optional local **MCP server**, so a compatible AI client can
inspect your worktrees, tasks, runs and logs, and run commands you authorize.

1. Open **Preferences → MCP** and enable the server.
2. Share the projects the client may access.
3. Copy the generated connection configuration into your client.

Favorites in shared projects are also authorized for execution through MCP.
Use the MCP menu beside a task to grant access to other tasks. Agent-started runs
appear in Activity with an **MCP** label and use the same runner and port-conflict
checks as tasks started from the interface.

MCP is disabled by default, stays local to your Mac and uses a private access
token. Closing the window keeps the connection available; quitting stops it.
See [MCP connection and permissions](docs/mcp.md) for client setup and available tools.

## Your projects, your tools

Darsena saves project shortcuts and preferences locally. It does not copy your
repositories or install project dependencies automatically. Configure preferred
applications in **Preferences** and continue using the tools you already know.

Commands needing interactive input, password prompts or a terminal interface
should run in the external Terminal. Detached daemons and shared services are
not treated as managed tasks merely because a command started or contacted them.

## Why the name?

Milan’s Darsena is a harbor at the meeting of the Navigli: a place of arrivals,
departures and work in progress. Darsena brings that idea to your projects.

The icon depicts the basin and canals from above, with Porta Ticinese, the oak
and a small Milanese tram. Click **Darsena** in the sidebar to see the illustration
and explore the story behind the name and its landmarks.
