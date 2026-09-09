# Windows integration

**Paused work in progress.** This branch is not a validated Windows release.
The user deferred Windows while shipping macOS.

The compiler path issue in the first run was fixed. In
[the second run](https://github.com/emavitta/darsena/actions/runs/34356198031),
Windows timed out in the orphaned-descendant/control-pipe test
(`tests/windows.test.ts`, waiting for the child-process notice). The remaining
Windows backend checks passed, but packaging and installed-app checks were
skipped. Investigate that test and host lifecycle before resuming distribution.
Later terminal-path tests and release automation in this branch have not run on Windows.

Darsena targets Windows 10/11 x64 and local Windows repositories. Git for Windows
and each project's toolchains must be installed separately. After changing PATH,
restart Darsena so newly launched tasks inherit the updated environment.

## Applications and commands

VS Code is detected in its standard user/system location; Android Studio is
detected under Program Files. Preferences can select another `.exe`. Folder
arguments are passed separately, without expanding shell syntax. Windows Terminal
is preferred; PowerShell is the fallback. Preferences also accepts PowerShell 7
or cmd.exe for the terminal shortcut.

npm, pnpm, Yarn and Bun retain the same task identities as macOS. Windows resolves
`.exe`, `.com`, `.cmd` and `.bat` executables, using a quoted CMD invocation only
for batch wrappers. Custom executables are separate from their argument list.
Shell script presets support PowerShell (`.ps1`), PowerShell 7 and the existing
Bash/Zsh/Sh choices when installed. Bash is not bundled; select an explicit
interpreter path with Custom command if it is not on PATH. WSL is not integrated.

Gradle discovery requires `gradlew.bat`. Generated Windows invocations include
`--no-daemon`: a new persistent daemon would otherwise keep its task job active.
Shared services started outside a job are not owned by Darsena.

## Task ownership

`desktop/windows/TaskHost.cs` is compiled by the Windows .NET Framework compiler
at build time, and shipped as an unpacked executable beside the desktop backend.
The installed app does not need a compiler, Node or PowerShell to supervise tasks.
The .NET Framework runtime is included with the supported Windows versions.

Each host creates a named, private Job Object with `KILL_ON_JOB_CLOSE`. It creates
the task suspended, assigns it to the job, and resumes it only after successful
assignment. The job handle is not inheritable. Output is forwarded directly;
the task does not inherit the host's stdin control pipe. The host waits until the
job is empty, retaining descendants even after the initial command exits.

Stop closes the control pipe, which terminates the job. Losing the supervising
app also closes that pipe; if the host itself is terminated, closing its last
job handle terminates its remaining members. Queries use job membership rather
than guessed process ancestry. Windows Stop is forceful, not a POSIX signal.

Microsoft documents these semantics in [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).

## Listening ports and lifecycle

PowerShell queries TCP listeners and process metadata. Managed listeners are
matched by job membership and show their task's working folder. Arbitrary external
processes' working folders are not inferred on Windows. An external process can
be terminated after confirmation; its identity is checked again before stopping.

Closing the window hides it and keeps tasks alive. The notification-area icon
reopens the window and exposes Quit. Starting Darsena again reopens the existing
instance. Settings normally live in `%APPDATA%/Darsena/settings.json`.
`DARSENA_DATA_DIR` selects a separate settings profile on both platforms, including
packaged builds; the test suite uses disposable profiles.

## Checks

The Actions build runs unit tests, packages and silently installs the Windows
installer, then launches that installed app for the same lifecycle and removal
tests used on macOS. Windows-specific tests cover literal arguments, batch
wrappers, Gradle discovery, orphaned descendants and control-pipe loss.

Build with `pnpm dist:win` on Windows; generated files appear in `release/`.
