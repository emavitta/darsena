export type ScriptShell = 'bash' | 'zsh' | 'sh'

export function shellScriptCommand(file: string, shell: ScriptShell, args: string[]) {
  const relative = file.trim().replace(/^(\.\/)+/u, '')
  if (
    !relative ||
    relative === '.' ||
    relative.startsWith('/') ||
    relative.split('/').includes('..')
  )
    throw new Error('Use a script path inside the working folder, such as scripts/dev.sh.')
  return { command: shell, args: ['--', `./${relative}`, ...args] }
}
