# Darsena MCP

Darsena exposes a local Model Context Protocol server so AI clients can inspect
your worktrees and use the same task runner as the desktop interface. MCP is
included in v0.1.1 and later; the older v0.1.0 installers do not include it.

## Connect a client

1. Run Darsena and open **Preferences → MCP**.
2. Turn on **Enable local MCP**. The default endpoint is
   `http://127.0.0.1:3142/mcp`. If that port is occupied, choose another under
   **Connection settings**.
3. Share the projects the client should see. Shared projects initially allow
   reading only; all other projects remain unavailable.
4. Use **Copy client configuration** and paste the result into your client's
   MCP settings. Choose an HTTP/Streamable HTTP connection. The copied JSON
   contains the URL and an `Authorization` header with a private bearer token.
5. Under a shared project's **Task permissions**, choose the tasks clients may
   start and stop. The worktree selector chooses where to read the task list;
   permissions apply to that task ID across all worktrees of the project.

The generic JSON configuration has this shape:

```json
{
  "mcpServers": {
    "darsena": {
      "url": "http://127.0.0.1:3142/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_YOUR_DARSENA_TOKEN"
      }
    }
  }
}
```

Clients may use a different settings format. Use the copied endpoint and header
in their HTTP server fields; a URL by itself is not enough. This endpoint is
reachable only from clients on the same Mac. Browser-origin requests and remote
cloud connections are not supported. No separate Node installation is needed
for the MCP server inside the packaged app.

All clients using this token share the same project and task permissions. Keep
the copied configuration out of repositories. **Replace connection token**
revokes the old token immediately; copy the new configuration into each client.

## Available tools

| Tool             | Inputs                            | Behavior                                                                                            |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `list_projects`  | None                              | Lists shared project IDs, names and root paths.                                                     |
| `list_worktrees` | `projectId`                       | Reads registered worktrees, branch/HEAD, paths and changed-file counts.                             |
| `list_tasks`     | `projectId`, `worktree`           | Returns the task catalog and sources, including availability and `mcpAllowed`.                      |
| `list_runs`      | None                              | Lists runs in shared projects, with status, worktree, command, source, URLs and port.               |
| `read_logs`      | `runId`, optional `lines`         | Reads the latest 100 lines by default; at most 500 lines and 32,768 characters. Reports truncation. |
| `list_listeners` | None                              | Lists TCP listeners associated with shared projects, including identifiable external servers.       |
| `start_task`     | `projectId`, `worktree`, `taskId` | Starts an authorized task, returning a run or a conflict.                                           |
| `stop_run`       | `runId`                           | Stops a managed run and its process group, provided its project and task are authorized.            |

Use the exact IDs and worktree paths returned by the discovery tools. Requests
are independent of the worktree selected in the desktop window. They do not
change Git branches or select a different worktree in the interface.

For example, a client can list mago-app's worktrees and running tasks, find a
particular task with `list_tasks`, then call `start_task` in the desired
checkout. It receives a run ID immediately and can inspect `list_runs` and
`read_logs` afterward. A running process is not a guarantee that its server is
ready; inspect its output or check the returned URL.

## Task permissions and conflicts

In shared projects, favorites are automatically authorized for MCP. Removing a
favorite revokes that task's permission, including a previous explicit grant;
it does not stop an existing run. Non-favorites can be authorized from the MCP
menu beside each task or Preferences → MCP. Existing explicit grants are kept.
Removing project access also removes its explicit task grants. Sharing it again
authorizes its current favorites. Private projects remain inaccessible.

An authorized task runs its **current definition in the requested checkout**.
This is permission to execute project code, not a sandbox or approval of a fixed
script body. Share projects and authorize tasks whose code you trust. Reading
task definitions and logs can also expose application secrets; output is
bounded and terminal escape sequences are removed, but secrets are not
automatically redacted.

`list_tasks` reads package scripts and cached Gradle discovery results. To make
Gradle tasks available, explicitly load that source in the workspace, then
refresh Task permissions. Loading Gradle evaluates the build and is not exposed
as a read-only MCP operation. Saved shell scripts and custom commands use the
same permission system as other tasks.

The UI and every MCP client share one start queue and one runner. Duplicate
starts and declared TCP-port conflicts are checked together. A conflict does
not stop another task automatically. A client may explicitly stop a conflicting
managed run only if that task is also authorized; it cannot stop external PIDs.
Conflicts with unshared projects reveal no private project/run details.

Revoking a permission blocks future starts and stops, including pending starts
that have not spawned yet. Already running tasks remain visible and stoppable
from Darsena's Activity. Runs started by MCP show an **MCP** label.

## Lifecycle and storage

- Closing the window keeps MCP and managed tasks running.
- Disconnecting an MCP client keeps its started tasks running.
- Disabling MCP or rotating the token does not stop running tasks.
- **Quit Darsena** closes the endpoint and stops managed process groups.
- On the next launch, MCP restores its enabled state, port and permissions.
  Task runs and output belong to the current app session.

Connection settings, project grants and the token are stored atomically in
`mcp.json` beside `settings.json` in Electron's user data directory, with file
permissions limited to the current user. The token is excluded from the normal
workspace state and MCP status response. `DARSENA_DATA_DIR` also isolates MCP
settings for development and tests.

The server uses the official TypeScript SDK and stateless Streamable HTTP,
supporting both the 2025 initialization flow and the 2026-07-28 protocol.
Requests require the bearer token and a valid local Host header. Incoming
Origin headers are rejected. JSON request bodies are limited to 256 KiB, with
at most 16 concurrent requests.

## Validation

```sh
pnpm test
pnpm build
node --import tsx tests/mcp-smoke.mjs
```

Backend tests use real MCP clients and disposable Git repositories to verify
authentication, project filtering, permissions, bounded logs, concurrent starts,
port conflicts, revocation and persistence. The desktop smoke test uses isolated
settings to exercise the Preferences controls, configuration copy, an MCP-started
task visible in Activity, window close and Quit cleanup. GitHub CI runs it too;
the macOS build workflow also runs it against the packaged app.

## Inspecting completion

Use `get_run` with `{ "runId": "..." }` for a single run, or
`wait_for_run` with `{ "runId": "...", "timeoutMs": 25000 }` to wait.
Both return `run` (including exit code and signal), `completed`, `outcome`,
`durationMs` and `successScope`. Outcomes are `pending`, `succeeded`, `failed`
or `stopped`; stopping a task is not success. `read_logs` provides error output.

Waiting accepts 0–25000 ms and returns `timedOut: true` while the process is
still active. Repeat the call to continue waiting. Timeout or cancellation never
stops the process. Project access and connection credentials are rechecked during
the wait. These are read-only tools and need no task execution grant.

Success describes the managed process, not application health. For Android runs,
a successful deployment does not prove the installed app remains alive. No application health guarantees, automatic retries or webhook callbacks are provided.
Optional Logcat collection can observe process presence, as described below.

Copied connection configuration now includes `"type": "http"` for clients such
as Claude Code that require an explicit transport type.

## Android Logcat

After a deployment or app operation finishes, `start_logcat` accepts its `runId`.
The application ID and device come from that run: clients cannot request arbitrary
packages or devices. Installation metadata is captured by new Darsena deployments;
older runs without it cannot start collection. Project sharing is required; no
permission to execute shell tasks is needed for log collection.

- `start_logcat { runId }` returns a managed Logcat run, reusing an active reader
  for the same project/device/package.
- `read_logcat { runId, lines?, query?, level? }` returns up to 500 lines / 32 Ki
  characters, the run metadata and `collecting`. Levels: V, D, I, W, E, F (minimum).
- `stop_logcat { runId }` stops the reader only. The device app is untouched.
- `list_runs`, `get_run`, `wait_for_run` and `read_logs` also work for Logcat.
  Waiting follows the reader's lifetime, not the device application's lifetime.

`run.logcat` reports sampled process state (`running`, `not-running`, `unknown`),
PIDs and `checkedAt`. Sampling is approximately every two seconds; short process
lifetimes can be missed. A running process is not proof of application health.
After collection stops, observations are historical. `lastCrashAt` is when a
crash-like message was observed, not its original timestamp: the initial 200
recent records may include old crashes. Inspect the actual log timestamps.

Collection uses the package's Android UID, so it survives PID changes and includes
app subprocesses. Packages sharing a UID are rejected to avoid including another
app's logs. Device disconnects, user/UID changes or missing packages fail the
reader; restart it after resolving the problem. No automatic reinstall/relaunch,
log-buffer clearing, or app stop occurs. Closing the window keeps readers alive;
quitting Darsena stops them. Logs are bounded to 512 Ki characters per run and
retained only in this Darsena session.

The worktree identifies the originating operation, not the installed binary:
Android Studio or another worktree can replace the package afterward. Logs may
contain secrets and are readable by clients with access to the originating project.
