export type ScriptShell = 'bash' | 'zsh' | 'sh' | 'powershell' | 'pwsh'

export function shellScriptCommand(file: string, shell: ScriptShell, args: string[]) {
  const relative = file
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/u, '')
  if (
    !relative ||
    relative === '.' ||
    relative.startsWith('/') ||
    /^[A-Za-z]:/.test(relative) ||
    relative.split('/').includes('..')
  )
    throw new Error('Use a script path inside the working folder, such as scripts/dev.sh.')
  return {
    command: shell,
    args: ['powershell', 'pwsh'].includes(shell)
      ? ['-NoProfile', '-File', `./${relative}`, ...args]
      : ['--', `./${relative}`, ...args],
  }
}
