import { mkdir, mkdtemp, writeFile, chmod, rm, realpath } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { TaskDiscovery } from '../desktop/tasks.ts'
import { Runner, active } from '../desktop/runner.ts'
import { eventually } from './fixture.ts'

// Supply an installed distribution and compatible JDK; no project build or download is needed.
const binary = process.env.DARSENA_TEST_GRADLE
if (!binary || !process.env.JAVA_HOME)
  throw new Error(
    'Set DARSENA_TEST_GRADLE to a Gradle executable and JAVA_HOME to a compatible JDK.',
  )
const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'darsena-gradle-smoke-')))
const runner = new Runner()
const previousHome = process.env.GRADLE_USER_HOME
process.env.GRADLE_USER_HOME = path.join(dir, 'cache')
try {
  await mkdir(path.join(dir, 'app'))
  await writeFile(
    path.join(dir, 'settings.gradle'),
    "rootProject.name = 'gradle-smoke'\ninclude ':app'\n",
  )
  await writeFile(
    path.join(dir, 'build.gradle'),
    "tasks.register('rootCheck') { doLast { println('Root checked') } }\n",
  )
  await writeFile(
    path.join(dir, 'app/build.gradle'),
    "tasks.register('hello') { doLast { println('Darsena Gradle task ran') } }\n",
  )
  // shell quoting is applied to the executable; arguments remain distinct.
  const quoted = "'" + binary.replaceAll("'", "'\\''") + "'"
  await writeFile(path.join(dir, 'gradlew'), `#!/bin/sh\nexec ${quoted} --no-daemon "$@"\n`)
  await chmod(path.join(dir, 'gradlew'), 0o755)
  const project = {
    id: 'gradle',
    name: 'Gradle smoke',
    root: dir,
    commonDir: dir,
    starred: false,
    folders: [{ id: 'root', path: '.', label: 'Root' }],
    favorites: [],
    customTasks: [],
    taskPreferences: {},
  }
  const discovery = new TaskDiscovery()
  await discovery.loadGradle(dir, '.')
  const tasks = (await discovery.list(project, dir)).tasks
  const task = tasks.find((t) => t.name === ':app:hello')
  assert.ok(task)
  assert.ok(tasks.some((t) => t.name === ':rootCheck'))
  const run = runner.start(
    project,
    {
      path: dir,
      name: 'gradle-smoke',
      branch: 'main',
      head: '',
      main: true,
      exists: true,
      bare: false,
    },
    task,
    dir,
  )
  await eventually(() => !active(runner.list()[0]), 60000)
  assert.equal(runner.list()[0].status, 'succeeded', runner.logs(run.id))
  assert.match(runner.logs(run.id), /Darsena Gradle task ran/)
  console.log(
    `PASS: Gradle discovered ${tasks.length} qualified tasks and ran :app:hello in an isolated build.`,
  )
} finally {
  await runner.shutdown()
  if (previousHome) process.env.GRADLE_USER_HOME = previousHome
  else delete process.env.GRADLE_USER_HOME
  await rm(dir, { recursive: true, force: true })
}
