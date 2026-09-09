import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taskTool } from '../app/utils/taskTools.js'
import { shellScriptCommand } from '../app/utils/customCommands.js'

test('tool identity follows the actual runner, recognizes wrappers, and leaves unknown commands generic', () => {
  const custom = (command: string) => taskTool({ kind: 'custom', command })
  const script = taskTool({ kind: 'script', manager: 'pnpm', command: 'pnpm' })
  assert.equal(custom('/opt/homebrew/bin/pnpm').id, script.id)
  assert.equal(custom('/opt/homebrew/bin/pnpm').icon, script.icon)
  assert.equal(custom('./gradlew').id, taskTool({ kind: 'gradle', command: './gradlew' }).id)
  assert.equal(custom('C:\\Android app\\gradlew.bat').id, 'gradle')
  assert.equal(custom('pnpm.cmd').id, 'script:pnpm')
  assert.equal(custom('powershell.exe').id, 'shell')
  assert.equal(custom('./mvnw').label, 'Maven')
  assert.equal(custom('.venv/bin/python3.13').label, 'Python')
  assert.equal(custom('gmake').label, 'Make')
  assert.equal(custom('docker-compose').label, 'Docker')
  for (const command of ['bash', '/bin/zsh', './scripts/start server.sh']) {
    assert.equal(custom(command).label, 'Shell')
    assert.equal(custom(command).icon, 'shell')
  }
  for (const command of ['my-pnpm-wrapper', 'pnpm run dev', './scripts/unknown', 'constructor']) {
    assert.equal(custom(command).label, 'Custom')
    assert.equal(custom(command).icon, 'command')
  }
  assert.equal(taskTool({ kind: 'script', command: '' }).label, 'Script')
  assert.equal(
    taskTool({ kind: 'script', manager: 'future-tool', command: '' }).label,
    'future-tool',
  )
})

test('shell preset keeps path and argument boundaries and requires a relative script path', () => {
  assert.deepEqual(shellScriptCommand('scripts/start server.sh', 'bash', ['a b', '$HOME', '&&']), {
    command: 'bash',
    args: ['--', './scripts/start server.sh', 'a b', '$HOME', '&&'],
  })
  for (const file of ['', '.', './', '/tmp/dev.sh', '../dev.sh', 'scripts/../../dev.sh'])
    assert.throws(() => shellScriptCommand(file, 'sh', []), /inside the working folder/)
  assert.deepEqual(shellScriptCommand('./-dev.sh', 'zsh', []), {
    command: 'zsh',
    args: ['--', './-dev.sh'],
  })
})
