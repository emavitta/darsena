import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'
import type { Project } from '../shared/types.js'
const exec = promisify(execFile)
export async function fixture() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "darsena-test '")))
  const root = path.join(directory, 'harbor-project')
  const linked = path.join(directory, 'feature worktree')
  await mkdir(root)
  const git = (args: string[], cwd = root) =>
    exec('git', args, {
      cwd,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    })
  await git(['init', '--initial-branch=main'])
  await git(['config', 'user.email', 'test@example.invalid'])
  await git(['config', 'user.name', 'Darsena Test'])
  await git(['config', 'core.hooksPath', '/dev/null'])
  await writeFile(path.join(root, 'README.md'), 'Fixture repository\n')
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'harbor-project',
      scripts: { check: 'node check.mjs', serve: 'node server.mjs' },
    }),
  )
  await writeFile(
    path.join(root, 'check.mjs'),
    "console.log('Check completed in ' + process.cwd())\n",
  )
  await writeFile(
    path.join(root, 'server.mjs'),
    "import http from 'node:http';const server=http.createServer((req,res)=>res.end(process.cwd()));server.listen(Number(process.env.DARSENA_TEST_PORT)||0,'127.0.0.1',()=>console.log('Ready at http://127.0.0.1:'+server.address().port));\n",
  )
  await mkdir(path.join(root, 'android-app'))
  await writeFile(
    path.join(root, 'android-app/README.md'),
    'A folder shortcut for native projects.\n',
  )
  await git(['add', '.'])
  await git(['commit', '-m', 'fixture'])
  await git(['worktree', 'add', '-b', 'feat/harbor-view', linked])
  const project: Project = {
    id: 'fixture-project',
    name: 'harbor-project',
    root,
    commonDir: path.join(root, '.git'),
    starred: true,
    folders: [
      { id: 'root', path: '.', label: 'Repository' },
      { id: 'android', path: 'android-app', label: 'Android app' },
    ],
    favorites: [],
    customTasks: [],
    taskPreferences: {},
    lastWorktree: root,
  }
  return {
    directory,
    root,
    linked,
    git,
    project,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  }
}
export async function eventually(check: () => boolean | Promise<boolean>, timeout = 6000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Condition did not become true within the timeout.')
}
