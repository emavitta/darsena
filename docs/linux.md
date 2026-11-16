# Darsena headless on Linux

The desktop app's core — projects, worktrees, tasks, runs, listeners, MCP —
as a per-user daemon plus a CLI, for shared Linux servers such as the Mago
lab (`magolab`). No Electron. Background: `docs/linux-feasibility.md`.

## Install

Requires Node ≥ 22 on PATH. Build on any machine with the repo:

```bash
pnpm build:server   # → dist-server/darsena-server-<version>.tar.gz
```

On the server:

```bash
tar -xzf darsena-server-<version>.tar.gz
./darsena-server-<version>/install.sh            # per user: ~/.local/share/darsena, ~/.local/bin/darsena
sudo ./darsena-server-<version>/install.sh --system   # or shared: /opt/darsena, /usr/local/bin/darsena
```

Both lay out `<prefix>/<version>/` and point `<prefix>/current` at it.

Then, **as each user**, a user systemd unit:

```bash
darsena unit > ~/.config/systemd/user/darsena.service
systemctl --user daemon-reload && systemctl --user enable --now darsena
loginctl show-user "$USER" -p Linger   # Linger=yes keeps it up after logout
```

`KillMode=mixed`: on stop, Darsena gets SIGTERM and stops its runs' process
groups itself; systemd kills what is left after 20 s.

## Update

```bash
./darsena-server-<new>/install.sh [--system]   # flips <prefix>/current
systemctl --user restart darsena                # per user
```

Restarting the daemon **stops the runs it owns** (they are its children).
Update at quiet times.

## Per-user isolation

| What | Where | Visible to |
|---|---|---|
| projects, task preferences | `$XDG_CONFIG_HOME/darsena/settings.json` (0600) | the user |
| MCP port + token + grants | `$XDG_CONFIG_HOME/darsena/mcp.json` (0600) | the user |
| MCP endpoint | `127.0.0.1:<20000 + uid % 20000>` | anyone on the host with the token |
| admin socket | `$XDG_RUNTIME_DIR/darsena/admin.sock` (dir 0700, socket 0600) | the user |

Nothing listens beyond 127.0.0.1. Each user's daemon starts and stops only
its own runs. `ports` lists every listener on the host with its owner;
other users' processes and folders are reported as not readable (the
kernel does not show them), never guessed.

## CLI

Every verb takes `--json`. `<project>` is a name, id or path; `<worktree>`
a path, worktree name or branch; `<task>` an id, a name, or `folder:name`
when a name exists in several folders; `<run>` an id or an id prefix.

Person verbs (admin socket — an agent cannot grant itself access over MCP):

```bash
darsena add ~/Code/mago-app --workspace   # register; --workspace adds pnpm/npm workspace folders
darsena share mago-app                    # visible to MCP (read-only)
darsena allow mago-app main services/call:dev   # this task may be started over MCP
darsena allow mago-app main services/call:dev --off
darsena share mago-app --off
darsena status
darsena remove mago-app
```

Agent verbs (through MCP, so the grants above apply):

```bash
darsena projects
darsena worktrees mago-app
darsena tasks mago-app <worktree>
darsena runs
darsena logs <run> -n 200
darsena ports
darsena start mago-app <worktree> <task>
darsena stop <run>
```

`ports` joins each listener with its worktree and run, its portless names
(from `~/.portless/routes.json`; routes whose proxy is not this user's
show «registered, no proxy for this user»), its `darsena.json` pool, and
flags `::1`-only sockets (an IPv4 forward to 127.0.0.1 cannot reach them).

## Claude Code

```bash
claude mcp add-json --scope user darsena "$(darsena mcp-json)"
```

`mcp-json` registers `darsena mcp-header` as the server's `headersHelper`:
Claude Code asks it for the `Authorization` header when it connects. The
token never appears in a command line (on a host without `hidepid`, other
users can read every process's arguments) nor in Claude's config. Grants
are the ones set with `darsena share` / `darsena allow`.

## darsena.json

Committed at a repository's root, read from each project's main worktree.
Names port pools; Darsena itself stays generic.

```json
{
  "ports": [
    { "name": "call service", "range": [5174, 5183] },
    { "name": "WTC UI", "ports": [5190, 5191] },
    { "name": "Admin Console", "port": 8080 }
  ]
}
```

Each entry has a non-empty `name` and exactly one of `port` (one port),
`ports` (an explicit list) or `range` (inclusive `[first, last]`, at most
1000 ports). `pool` is refused: `[5174, 5183]` reads as a range to one
person and as two ports to another. Unknown top-level keys are ignored; a
malformed file shows up as a warning in `ports`, never as a crash.

## Not in v1

- Darsena assigning a pool port to a task (mago-app's dev CLI already
  picks the first free `boardPorts` port itself).
- The Mac app showing a server's runs over SSH; Android tasks through the
  lab's shared adb daemon.
- Windows.
