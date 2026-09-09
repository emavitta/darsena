import { spawn } from 'node:child_process'
import electron from 'electron'
import net from 'node:net'
const probe = net.createServer()
await new Promise((resolve, reject) => {
  probe.once('error', reject)
  probe.listen(3141, '127.0.0.1', resolve)
})
await new Promise((resolve) => probe.close(resolve))
const pnpm = process.env.npm_execpath
if (!pnpm) throw new Error('Start development with pnpm dev.')
const build = spawn(process.execPath, [pnpm, 'build:desktop'], { stdio: 'inherit' })
if (await new Promise((resolve) => build.once('exit', resolve))) process.exit(1)
const ui = spawn(process.execPath, [pnpm, 'dev:ui'], {
  stdio: 'inherit',
  detached: process.platform !== 'win32',
})
let desktop
let closing = false
function close() {
  if (closing) return
  closing = true
  if (ui.pid)
    try {
      if (process.platform === 'win32')
        spawn('taskkill.exe', ['/pid', String(ui.pid), '/t', '/f'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      else process.kill(-ui.pid, 'SIGTERM')
    } catch {}
  desktop?.kill('SIGTERM')
}
process.on('SIGINT', close)
process.on('SIGTERM', close)
for (let i = 0; i < 180 && !closing; i++) {
  if (ui.exitCode !== null) {
    close()
    throw new Error('The Nuxt development server exited before it was ready.')
  }
  try {
    if ((await fetch('http://127.0.0.1:3141')).ok) break
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (i === 179) {
    close()
    throw new Error('Nuxt did not start on port 3141.')
  }
}
if (!closing) {
  desktop = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, DARSENA_DEV_URL: 'http://127.0.0.1:3141' },
  })
  desktop.once('exit', close)
}
