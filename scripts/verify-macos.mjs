import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const directory = path.resolve(process.argv[2] || 'release')
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })
const verify = app => {
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app])
  if (process.env.DARSENA_REQUIRE_NOTARIZATION === '1') {
    run('/usr/bin/codesign', ['--verify', '-R=anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists', app])
    run('/usr/bin/xcrun', ['stapler', 'validate', app])
    run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=2', app])
  }
}
verify(path.join(directory, 'mac-arm64/Darsena.app'))
for (const file of readdirSync(directory).filter(name => /^Darsena-.*\.(dmg|zip)$/.test(name))) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'darsena-signature-'))
  const mount = path.join(temporary, 'volume')
  let mounted = false
  try {
    if (file.endsWith('.dmg')) {
      run('/usr/bin/hdiutil', ['verify', path.join(directory, file)])
      mkdirSync(mount)
      run('/usr/bin/hdiutil', ['attach', path.join(directory, file), '-readonly', '-nobrowse', '-mountpoint', mount])
      mounted = true
      verify(path.join(mount, 'Darsena.app'))
    } else {
      run('/usr/bin/ditto', ['-x', '-k', path.join(directory, file), temporary])
      verify(path.join(temporary, 'Darsena.app'))
    }
  } finally {
    if (mounted) run('/usr/bin/hdiutil', ['detach', mount])
    rmSync(temporary, { recursive: true, force: true })
  }
}
