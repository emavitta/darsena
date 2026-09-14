# Task discovery and identity

`desktop/tasks.ts` resolves tasks from the selected worktree. A task ID contains
its source kind, relative folder and name; favorites store this ID rather than a
copy of the command. Changing branches therefore uses the script defined in that
checkout. Missing favorites remain visible as unavailable instead of silently
running another command.

## Sources

- **Package scripts:** read `package.json` in the project's saved folders. The
  package manager is resolved from `packageManager` or lockfiles, walking toward
  the worktree root, with npm as the fallback.
- **Gradle:** detect `gradlew`, then load the task report only on explicit request.
  Loading executes Gradle project configuration. The temporary init script uses
  `--no-configuration-cache` for discovery only and is removed afterward. Results
  are cached in memory by worktree and folder. Qualified task names preserve
  module identity; Android assemble tasks also provide variant information.
- **Custom commands:** use the saved executable, arguments and relative folder.
  Scripts are not discovered by scanning every shell file in the repository.

Folder suggestions are handled separately by `desktop/workspace-folders.ts`,
using pnpm workspace patterns or npm/Yarn/Bun `workspaces` declarations. Suggested
folders become task sources when added to the project. Paths are resolved within
the selected worktree, with traversal and escaping symlinks rejected.

## Execution and access

`desktop/workspace.ts` resolves the selected task again before execution;
`desktop/runner.ts` owns each run's process, output and completion status. A run
keeps its working directory and command even if the user changes the selected
worktree. Task discovery does not imply that a command is installed or that its
service is healthy.

Favorites are shared across a project's worktrees. For projects explicitly
shared with MCP, favorites also grant task execution; other tasks require an
explicit grant. See [MCP access](mcp.md) for the permission model and
[task tools](task-tools.md) for executable recognition and custom commands.
