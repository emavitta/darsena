import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { isWindows, taskHost } from './platform.js'
import { windowsInvocation } from './windows-command.js'

const exec = promisify(execFile)
export async function command(file: string, args: string[], cwd?: string, timeout = 12000) {
  if (isWindows) {
    const invocation = windowsInvocation(file, args, cwd)
    args = [`darsena-${randomUUID()}`, invocation.file, invocation.line]
    file = taskHost
  }
  const { stdout } = await exec(file, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  })
  return stdout
}
export function inside(root: string, target: string) {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel))
}
export async function resolveFolder(worktree: string, relative: string) {
  if (path.isAbsolute(relative) || relative.includes('\0'))
    throw new Error('Choose a folder inside this worktree.')
  const root = await realpath(worktree)
  const target = await realpath(path.resolve(root, relative))
  if (!inside(root, target)) throw new Error('This folder resolves outside the selected worktree.')
  if (!(await stat(target)).isDirectory()) throw new Error('The selected path is not a folder.')
  return target
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
export async function importShellEnvironment() {
  if (isWindows) return
  const shell = process.env.SHELL || '/bin/zsh'
  if (!['zsh', 'bash', 'sh'].includes(path.basename(shell))) return
  try {
    const out = await command(
      shell,
      ['-ilc', 'printf "\\036%s\\037%s\\036" "$PATH" "${JAVA_HOME-}"'],
      undefined,
      5000,
    )
    const values = out.match(/\x1e([^\x1e]+)\x1e/)?.[1]?.split('\x1f')
    if (values?.[0]) process.env.PATH = values[0]
    if (values?.[1]) process.env.JAVA_HOME = values[1]
  } catch {
    /* Keep the launching environment if shell startup fails. */
  }
}
