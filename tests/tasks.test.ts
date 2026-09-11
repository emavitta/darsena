import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseGradleReport, TaskDiscovery, taskId } from '../desktop/tasks.js'
import { Store } from '../desktop/store.js'
import { fixture } from './fixture.js'

test('favorites retain task identity while scripts resolve from the selected worktree', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  const id = taskId('script', '.', 'check')
  f.project.favorites = [id]
  const discovery = new TaskDiscovery()
  const original = (await discovery.list(f.project, f.root)).tasks.find((task) => task.id === id)!
  await writeFile(
    path.join(f.linked, 'package.json'),
    JSON.stringify({
      scripts: { check: 'echo different', build: 'echo build' },
      packageManager: 'pnpm@10.0.0',
    }),
  )
  const linked = (await discovery.list(f.project, f.linked)).tasks.find((task) => task.id === id)!
  assert.deepEqual(original.args, ['run', 'check'])
  assert.equal(linked.description, 'echo different')
  assert.equal(linked.command, 'pnpm')
  assert.equal(original.description, 'node check.mjs')
  await writeFile(path.join(f.linked, 'package.json'), '{"scripts":{}}')
  assert.equal(
    (await discovery.list(f.project, f.linked)).tasks.find((task) => task.id === id)?.available,
    false,
  )
})
test('Gradle discovery accepts qualified task reports and rejects malformed task identities', () => {
  const tasks = parseGradleReport(
    'plugin output\n__DARSENA_TASKS__[{"name":":app:assembleDebug","description":"Build debug"}]\n',
  )
  assert.equal(tasks[0]?.name, ':app:assembleDebug')
  assert.throws(() => parseGradleReport('build failed'), /did not return/)
  assert.throws(() => parseGradleReport('__DARSENA_TASKS__[{"name":"--init-script=untrusted"}]'))
})
test('scripts use their own folder’s npm, pnpm, Yarn or Bun configuration without duplicate tasks', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  await writeFile(
    path.join(f.root, 'package.json'),
    JSON.stringify({
      packageManager: 'pnpm@10.0.0',
      scripts: { dev: 'echo root' },
    }),
  )
  const packages = [
    { folder: 'npm-package', manager: 'npm', lock: 'package-lock.json' },
    { folder: 'yarn-package', manager: 'yarn', lock: 'yarn.lock' },
    { folder: 'bun-package', manager: 'bun', lock: 'pnpm-lock.yaml', declared: 'bun@1.0.0' },
    { folder: 'inherited-package', manager: 'pnpm' },
  ]
  for (const pkg of packages) {
    await mkdir(path.join(f.root, pkg.folder))
    await writeFile(
      path.join(f.root, pkg.folder, 'package.json'),
      JSON.stringify({
        packageManager: pkg.declared,
        scripts: { dev: 'echo nested' },
      }),
    )
    if (pkg.lock) await writeFile(path.join(f.root, pkg.folder, pkg.lock), '{}')
    f.project.folders.push({ id: pkg.folder, label: pkg.folder, path: pkg.folder })
  }
  const catalog = await new TaskDiscovery().list(f.project, f.root)
  assert.equal(catalog.tasks.length, 5)
  assert.equal(catalog.tasks.find((task) => task.folder === '.')?.manager, 'pnpm')
  for (const pkg of packages) {
    const tasks = catalog.tasks.filter((task) => task.folder === pkg.folder)
    assert.equal(tasks.length, 1)
    assert.equal(tasks[0]?.command, pkg.manager)
    assert.equal(tasks[0]?.manager, pkg.manager)
    assert.deepEqual(tasks[0]?.args, ['run', 'dev'])
  }
})
test('settings survive concurrent saves and invalid input is preserved rather than overwritten', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  const dir = path.join(f.directory, 'settings')
  const store = new Store(dir)
  await store.load()
  store.state.projects.push(f.project)
  const first = store.save()
  store.state.projects[0]!.favorites.push(taskId('script', '.', 'check'))
  const second = store.save()
  await Promise.all([first, second])
  const restored = new Store(dir)
  await restored.load()
  assert.equal(restored.state.projects[0]!.favorites.length, 1)
  await writeFile(path.join(dir, 'settings.json'), 'bad data')
  await assert.rejects(new Store(dir).load(), /preserved/)
  assert.equal(await readFile(path.join(dir, 'settings.json'), 'utf8'), 'bad data')
})

test('Gradle discovery disables configuration cache only for its temporary report', async (t) => {
  const f = await fixture()
  t.after(f.cleanup)
  await writeFile(path.join(f.root, 'gradlew'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (!args.includes('--no-configuration-cache')) throw Error('Discovery needs configuration cache disabled');
const script = args[args.indexOf('--init-script') + 1];
if (!fs.readFileSync(script, 'utf8').includes('rootProject.allprojects')) throw Error('Missing report');
console.log('__DARSENA_TASKS__' + JSON.stringify([{name: ':app:installDebug', buildDirectory: process.cwd() + '/app/build'}]));
`, { mode: 0o755 })
  const properties = 'org.gradle.configuration-cache=true\n'
  await writeFile(path.join(f.root, 'gradle.properties'), properties)
  const discovery = new TaskDiscovery()
  await discovery.loadGradle(f.root, '.')
  const catalog = await discovery.list(f.project, f.root)
  const task = catalog.tasks.find(task => task.name === ':app:installDebug')!
  assert.equal(task.android?.variant, 'debug')
  assert.deepEqual(task.args, [':app:installDebug'])
  assert.equal(await readFile(path.join(f.root, 'gradle.properties'), 'utf8'), properties)
})
