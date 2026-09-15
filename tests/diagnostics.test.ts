import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { executablePath } from '../desktop/diagnostics.js'

test('diagnostics respects PATH precedence and excludes non-executable files and directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'darsena-diagnostics-'))
  try {
    const first = path.join(root, 'first'),
      second = path.join(root, 'second')
    await mkdir(first)
    await mkdir(second)
    await writeFile(path.join(first, 'tool'), '')
    await writeFile(path.join(second, 'tool'), '')
    await chmod(path.join(second, 'tool'), 0o755)
    assert.equal(
      await executablePath('tool', root, `${first}:${second}`),
      path.join(second, 'tool'),
    )
    await chmod(path.join(first, 'tool'), 0o755)
    assert.equal(await executablePath('tool', root, `${first}:${second}`), path.join(first, 'tool'))
    assert.equal(await executablePath('./second/tool', root, ''), path.join(second, 'tool'))
    assert.equal(await executablePath('missing', root, first), undefined)
    assert.equal(await executablePath('./first', root, ''), undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
