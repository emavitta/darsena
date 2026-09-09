import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

if (process.platform === 'win32') {
  mkdirSync('dist-electron', { recursive: true })
  const compiler = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'Microsoft.NET/Framework64/v4.0.30319/csc.exe',
  )
  execFileSync(
    compiler,
    [
      '/nologo',
      '/optimize+',
      '/platform:x64',
      '/target:exe',
      `/out:${path.resolve('dist-electron/darsena-task-host.exe')}`,
      path.resolve('desktop/windows/TaskHost.cs'),
    ],
    { stdio: 'inherit' },
  )
}
