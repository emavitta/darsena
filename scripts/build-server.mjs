// Builds the Darsena headless release for Linux servers:
//   dist-server/darsena-server-<version>.tar.gz
// One bundled ESM file (Node >= 22, no node_modules), a POSIX shim, VERSION
// and install.sh. See docs/linux.md.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { desktopBuildOptions } from './desktop-build-options.mjs'

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
let sha = ''
try {
  sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {}
const version = sha ? `${pkg.version}+${sha}` : pkg.version
const name = `darsena-server-${version}`
const out = path.join('dist-server', name)

await rm('dist-server', { recursive: true, force: true })
await mkdir(path.join(out, 'bin'), { recursive: true })
await build({
  entryPoints: ['desktop/server.ts'],
  ...desktopBuildOptions,
  target: 'node22',
  define: { __DARSENA_VERSION__: JSON.stringify(version) },
  outfile: path.join(out, 'darsena.mjs'),
})
await writeFile(path.join(out, 'VERSION'), `${version}\n`)

await writeFile(
  path.join(out, 'bin', 'darsena'),
  `#!/bin/sh
# Darsena headless. Installed as <prefix>/<version>/bin/darsena and reached
# through <prefix>/current and a symlink on PATH, so updates flip one link.
self=$(readlink -f "$0")
root=$(dirname "$(dirname "$self")")
DARSENA_BIN=\${DARSENA_BIN:-$0}
export DARSENA_BIN
exec "\${DARSENA_NODE:-node}" "$root/darsena.mjs" "$@"
`,
)
await chmod(path.join(out, 'bin', 'darsena'), 0o755)

await writeFile(
  path.join(out, 'install.sh'),
  `#!/bin/sh
# Installs this release and points <prefix>/current at it.
#   ./install.sh            per user: ~/.local/share/darsena, ~/.local/bin/darsena
#   sudo ./install.sh --system   shared: /opt/darsena, /usr/local/bin/darsena
# Then, as each user: darsena unit > ~/.config/systemd/user/darsena.service
#   systemctl --user daemon-reload && systemctl --user enable --now darsena
set -eu
here=$(cd "$(dirname "$0")" && pwd)
version=$(cat "$here/VERSION")
if [ "\${1:-}" = "--system" ]; then
  prefix=/opt/darsena; bindir=/usr/local/bin
else
  prefix="$HOME/.local/share/darsena"; bindir="$HOME/.local/bin"
fi
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$node_major" -lt 22 ]; then
  echo "darsena needs Node >= 22 on PATH (found: $node_major)" >&2; exit 1
fi
mkdir -p "$prefix/$version/bin" "$bindir"
cp "$here/darsena.mjs" "$here/VERSION" "$prefix/$version/"
cp "$here/bin/darsena" "$prefix/$version/bin/"
chmod 755 "$prefix/$version/bin/darsena"
ln -sfn "$version" "$prefix/current"
ln -sf "$prefix/current/bin/darsena" "$bindir/darsena"
echo "darsena $version installed in $prefix (current -> $version); command: $bindir/darsena"
echo "Running daemons keep the old code until: systemctl --user restart darsena (this stops their runs)."
`,
)
await chmod(path.join(out, 'install.sh'), 0o755)

execFileSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: 'dist-server' })
console.log(`dist-server/${name}.tar.gz`)
