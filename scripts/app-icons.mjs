import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { promisify } from 'node:util'

// Export the actual macOS application artwork, without redrawing the logos.
const icons = {
  vscode: '/Applications/Visual Studio Code.app/Contents/Resources/Code.icns',
  terminal: '/System/Applications/Utilities/Terminal.app/Contents/Resources/Terminal.icns',
  'android-studio': '/Applications/Android Studio.app/Contents/Resources/studio.icns',
}

await mkdir('public/apps', { recursive: true })
for (const [name, source] of Object.entries(icons)) {
  await promisify(execFile)('/usr/bin/sips', [
    '-s',
    'format',
    'png',
    '-Z',
    '128',
    source,
    '--out',
    `public/apps/${name}.png`,
  ])
}
