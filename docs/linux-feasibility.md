# Darsena on Linux — feasibility note

Answer to `darsena-linux-requirements.md` (Mago lab session, 2026-11-16).
Spike delivered the same day (§ The spike). **Superseded the same day by
v1** (vitta's go): `desktop/server.ts`, guide in `docs/linux.md`. The
spike files (`headless-spike.ts`, `build-spike.mjs`) are gone; this note
stays as the record of the study and of the lab's decisions.

## Verdict

Feasible, and cheaper than expected: the core already runs headless under
plain Node on Linux. The spike put the real `Store`, `Runner`,
`WorkspaceService` and `McpController` — not reimplementations — behind a
CLI on the lab server, and the asked proofs (`ports --json`, `runs --json`,
MCP `list_listeners` from a headless process, plus a full start→logs→stop
cycle through MCP) all pass. Estimated effort to a packaged v1: **4–5
working days**.

## What runs under plain Node as is

Verified on `magolab` (Ubuntu 24.04, Node 22.23.3), unmodified:

- **Store** (`desktop/store.ts`) — directory is injected; the spike uses
  `$XDG_CONFIG_HOME/darsena-spike` (falls back to `~/.config/…`), files
  written `0600`.
- **Runner** (`desktop/runner.ts`) — `detached` process groups,
  `kill(-pid)` SIGTERM→SIGKILL escalation, log capture, URL sniffing: all
  POSIX, identical on Linux. The demo run's ephemeral port and URL were
  captured correctly.
- **Git discovery** (`desktop/git.ts`) — `identifyProject` +
  `listWorktrees` saw all 38 worktrees of the server's mago-app checkout.
  (`realpath` canonicalized `~/Code` → `~/code`; ids stay consistent.)
- **WorkspaceService** (`desktop/workspace.ts`) — listener→run attribution
  (`isDescendant`) and cwd→worktree matching work as on macOS.
- **McpController** (`desktop/mcp.ts`) — pure `node:http` +
  `@modelcontextprotocol/server`; binds `127.0.0.1` explicitly
  (mcp.ts:579), Bearer token, per-project/task grants. All tools answered
  from the headless process.
- **Task discovery** (`desktop/tasks.ts`) — package.json scripts + custom
  tasks; nothing platform-specific (Gradle discovery untested, not needed
  on the server).

Electron is imported only by `desktop/main.ts` and `desktop/mac-updater.ts`.
The headless entry simply does not import them.

## What needed (and got) a Linux variant

All in `desktop/processes.ts`, done as part of the spike:

- `listeners()` — Linux branch runs `/usr/bin/ss -H -ltnpe`; the parser is
  adapted from mago-app `tools/magolab/core/dev-ports.ts` (PR 1613), with
  tests (`tests/linux-processes.test.ts`, sample lines from the server).
  Multi-user semantics are the kernel's: other users' sockets expose
  `uid:` but no `users:(…)` → rows carry `uid`/`user` and pid 0 /empty
  command, never a guess. IPv4+IPv6 sockets of one holder merge into one
  row; a row bound only to `::1` is flagged `ipv6Only` (an IPv4 forward to
  127.0.0.1 cannot reach it). Root-owned sockets print no `uid:` at all —
  rendered as "owner not readable", not as anyone's.
- `processCwd()` — `readlink /proc/<pid>/cwd`; EACCES on other users'
  processes → undefined, honestly.
- `processParents()` — `ps -eo` on Linux (`-axo` is BSD syntax).
- `shared/types.ts` — `Listener` gained optional `uid`, `user`,
  `ipv6Only`. Additive; the macOS UI ignores them.

## What a real v1 still needs (the effort)

1. **CLI completion** (~0.5 d) — the spike CLI (`desktop/headless-spike.ts`)
   has `serve · register · ports · runs · start · stop · logs`; add
   `projects · worktrees · tasks` (existing MCP tools, trivial) and a
   stable `--json` contract.
2. **Listener scope** (~0.5 d) — add `scope: 'shared' | 'all'` to
   `list_listeners` (mcp.ts:426, filter at :439), default unchanged; the
   CLI's `ports` maps to `'all'`. Replaces the spike's `ports --scan`.
3. **Repo config + port pools** (~1–1.5 d) — read a root `darsena.json`
   per worktree (zod-validated, like the store), let a task bind to a
   named pool, pick the first free port at start; conflict flow unchanged
   and own-runs-only.
4. **portless integration** (~0.5 d) — read `~/.portless/routes.json`
   (honour `PORTLESS_STATE_DIR`), join on port/pid, and mark routes with
   no live proxy for the current user as «registered, no proxy».
5. **Packaging** (~1 d) — below.
6. **Type cleanup + docs** (~0.5 d) — make `Listener.pid`/`command`
   optional instead of the spike's `0`/`''` sentinels; lab guide page.

Out of scope now (as the requirements say): Mac app showing the lab over
SSH, Android tasks via the shared adb daemon. Note for later: the spike
never touches adb; any future Android support must pass
`-H 127.0.0.1 -P 5037` per the lab rules.

## The spike (running now)

- Mac side: `node scripts/build-spike.mjs` → `dist-spike/darsena-spike.mjs`
  (single self-contained ESM file, esbuild target node22, ~1.4 MB).
- Server side: `~/darsena-spike/darsena-spike.mjs`, data in
  `~/.config/darsena-spike/`, daemon started with nohup (pid in
  `~/darsena-spike/serve.pid`, log in `serve.log`), MCP at
  `http://127.0.0.1:21001/mcp` (port = 20000 + uid % 20000 → per user),
  token per user in `mcp.json` (0600).
- Proofs run on 2026-11-16: `ports --scan` (full table, luca/magolab/labbot
  sockets shown owner-only), `ports --json` (= MCP `list_listeners`, rows
  attributed to mago-app worktrees incl. the call service and the portless
  proxy), `runs --json` (`[]`), `start … spike-http` → run in the main
  worktree with branch+head identity, `logs` (URL captured), listener
  35511 attributed `worktree mago-app · run 44352a2d`, `stop` (SIGTERM,
  stopped). A Claude session on the server can register it today with
  `claude mcp add-json` and the usual Bearer header.

## Packaging proposal

- **Artifact**: `darsena-server-<version>.tar.gz` built by the existing
  esbuild pipeline (the spike build is the template): one bundled `.mjs`,
  a `bin/darsena` shim, `VERSION`. No `node_modules`, no install step;
  requires the server's Node ≥ 22.
- **Install**: shared read-only code, per-user state (the magolab model):
  unpack to `/opt/darsena/<version>`, flip a `/opt/darsena/current`
  symlink, `/usr/local/bin/darsena` → `current/bin/darsena`. One sudo at
  install; users never need it.
- **Service**: a *user* systemd unit per person —
  `~/.config/systemd/user/darsena.service` with
  `ExecStart=/usr/bin/node /opt/darsena/current/darsena-server.mjs serve`,
  `Restart=on-failure`, plus `loginctl enable-linger <user>` so it
  survives logout. `systemctl --user enable --now darsena`.
- **Update path**: unpack new version, flip `current`, each user
  `systemctl --user restart darsena`. Caveat: restarting the daemon kills
  the runs it owns (they are its process-group children) — update at quiet
  times; run re-attachment is a later feature if it hurts.
- **MCP registration** per user, as on the Mac:
  `claude mcp add-json --scope user darsena '{"type":"http","url":"http://127.0.0.1:<port>/mcp","headers":{"Authorization":"Bearer <token>"}}'`.

## Decisions (Mago lab session, 2026-11-16)

Answered by «Mago lab dev» after running the spike on magolab. v1 is
**not started**: vitta approved the feasibility study only.

1. **`list_listeners` scope** — optional argument `scope: 'shared' | 'all'`,
   default `'shared'` (today's behaviour). Same meaning on every OS; no
   separate tool, no Linux-only semantics. With `'all'`, every listener
   comes back with its owner; other users' processes stay «not readable».
2. **Port table** — Darsena stays generic and knows no Mago ports. A
   repo-level, per-project config file at the repository root, read from
   the worktree like `package.json`, declares named port pools.
   Lab's sketch: `darsena.json` →
   `{ "ports": [{ "name": "call service", "pool": [5174, 5183] }, { "name": "WTC UI", "pool": [5190, 5191] }, { "name": "Admin Console", "port": 8080 }] }`.
   mago-app commits the file plus a test keeping it equal to
   `tools/magolab/core/dev-ports.ts`. Darsena owes the lab the final
   schema. (Darsena reads no repo-level config today, so the name is free.)
3. **portless on `*:1355`** — known exception, not a Darsena concern:
   portless 0.10.3 calls `server.listen(proxyPort)` with no host and has no
   loopback-only option. Measured unreachable (ufw: SSH only from the
   office LAN; Tailscale: only `tailscale serve` ports). mago-app adopts a
   host option if portless gains one.
4. **portless routes** — `~/.portless/routes.json` per user
   (`PORTLESS_STATE_DIR` overrides), a JSON array of
   `{ hostname, port, pid }`; `proxy.port` / `proxy.pid` sit next to it
   (never read the CA/cert keys there). Join on `port` (or `pid`). On the
   shared server only vitta's proxy (`lab-portless-proxy`, user service)
   serves 1355: another user's routes must show as «registered, no proxy
   for this user», not as working.

Still open, for mago-app/lab: sequencing the retirement of dev-console and
`magolab dev` (the lab will turn `magolab dev` into a view on Darsena's MCP
once a packaged build exists).
