// Real Gradle regression: DARSENA_TEST_GRADLE=/absolute/path/to/gradle node --import tsx tests/gradle-discovery-smoke.mjs
import assert from 'node:assert/strict'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fixture } from './fixture.ts'
import { TaskDiscovery } from '../desktop/tasks.ts'

if (!process.env.DARSENA_TEST_GRADLE) throw new Error('Set DARSENA_TEST_GRADLE to an installed Gradle executable.')
const f = await fixture()
try {
  await writeFile(path.join(f.root, 'gradlew'), '#!/bin/sh\nexec "$DARSENA_TEST_GRADLE" "$@"\n', { mode: 0o755 })
  await writeFile(path.join(f.root, 'settings.gradle'), "rootProject.name = 'discovery-test'\ninclude 'app'\n")
  await writeFile(path.join(f.root, 'build.gradle'), '')
  await mkdir(path.join(f.root, 'app'))
  await writeFile(path.join(f.root, 'app/build.gradle'), "tasks.register('installDemoDebug') { description = 'Install demo debug' }\ntasks.register('assembleDemoDebug')\n")
  const properties = 'org.gradle.configuration-cache=true\norg.gradle.configuration-cache.problems=fail\n'
  await writeFile(path.join(f.root, 'gradle.properties'), properties)
  // Reproduce the original failure by simulating the old invocation without the override.
  await writeFile(path.join(f.root, 'gradlew'), '#!/bin/sh\nif [ "$1" = "--no-configuration-cache" ]; then shift; fi\nexec "$DARSENA_TEST_GRADLE" "$@"\n', { mode: 0o755 })
  await assert.rejects(new TaskDiscovery().loadGradle(f.root, '.'), /unsupported with the configuration cache/)
  await writeFile(path.join(f.root, 'gradlew'), '#!/bin/sh\nexec "$DARSENA_TEST_GRADLE" "$@"\n', { mode: 0o755 })
  const discovery = new TaskDiscovery()
  for (let attempt = 0; attempt < 2; attempt++) {
    await discovery.loadGradle(f.root, '.')
    const catalog = await discovery.list(f.project, f.root)
    const variant = catalog.tasks.find(task => task.name === ':app:installDemoDebug')
    assert.equal(variant?.android?.variant, 'demoDebug')
    assert.equal(variant?.android?.assembleTask, ':app:assembleDemoDebug')
    assert.deepEqual(variant?.args, [':app:installDemoDebug'])
    assert.equal(await readFile(path.join(f.root, 'gradle.properties'), 'utf8'), properties)
  }
  console.log('PASS: real Gradle discovery with configuration cache enabled, Android variant extraction and unchanged project properties/build arguments.')
} finally { await f.cleanup() }
