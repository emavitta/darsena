import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, selectUpdate } from '../desktop/updates.js'
const release = (tag_name: string, prerelease = false) => ({ tag_name, prerelease, draft: false, body: 'Notes', assets: [{ name: `Darsena-${tag_name}-arm64.dmg`, state: 'uploaded', browser_download_url: `https://github.com/emavitta/darsena/releases/download/${tag_name}/Darsena-${tag_name}-arm64.dmg` }] })
test('updates compare numeric versions and prerelease precedence', () => {
  assert.ok(compareVersions('v0.1.10', '0.1.9') > 0)
  assert.ok(compareVersions('1.0.0', '1.0.0-rc.9') > 0)
  assert.ok(compareVersions('1.0.0-rc.10', '1.0.0-rc.9') > 0)
  assert.equal(compareVersions('v1.0.0', '1.0.0+build'), 0)
})
test('updates honor channels, exclude drafts, select architecture and restrict download URLs', () => {
  const data = [release('v0.1.4', true), { ...release('v9.0.0'), draft: true }, release('v0.1.3')]
  assert.equal(selectUpdate(data, '0.1.3', 'arm64', 'darwin').release?.version, 'v0.1.4')
  assert.ok(selectUpdate(data, '0.1.3', 'arm64', 'darwin').release?.downloadUrl)
  assert.equal(selectUpdate(data, '0.1.3', 'x64', 'darwin').release?.downloadUrl, undefined)
  assert.equal(selectUpdate([release('v1.1.0', true)], '1.0.0', 'arm64', 'darwin').release, undefined)
  assert.equal(selectUpdate([release('v0.1.3')], '0.1.3', 'arm64', 'darwin').release, undefined)
  const bad = release('v0.1.4'); bad.assets[0]!.browser_download_url = 'https://example.com/file.dmg'
  assert.equal(selectUpdate([bad], '0.1.3', 'arm64', 'darwin').release?.downloadUrl, undefined)
})
