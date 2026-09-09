import type { Task } from '../../shared/types'
import type { toolIconPaths } from '../assets/tool-icon-paths'

export type TaskToolIcon = keyof typeof toolIconPaths | 'shell' | 'command' | 'build' | 'recipe'

export interface TaskTool {
  id: string
  label: string
  tone: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'gradle' | 'custom' | 'neutral'
  icon: TaskToolIcon
  hint: string
}

const managers = {
  npm: { label: 'npm', tone: 'npm', icon: 'npm' },
  pnpm: { label: 'pnpm', tone: 'pnpm', icon: 'pnpm' },
  yarn: { label: 'Yarn', tone: 'yarn', icon: 'yarn' },
  bun: { label: 'Bun', tone: 'bun', icon: 'bun' },
} as const

type Identity = Omit<TaskTool, 'hint'>
const customTools: Record<string, Identity> = {
  gradle: { id: 'gradle', label: 'Gradle', tone: 'gradle', icon: 'gradle' },
  python: { id: 'python', label: 'Python', tone: 'neutral', icon: 'python' },
  cargo: { id: 'cargo', label: 'Cargo', tone: 'neutral', icon: 'rust' },
  go: { id: 'go', label: 'Go', tone: 'neutral', icon: 'go' },
  uv: { id: 'uv', label: 'uv', tone: 'custom', icon: 'uv' },
  node: { id: 'node', label: 'Node.js', tone: 'neutral', icon: 'nodedotjs' },
  mvn: { id: 'maven', label: 'Maven', tone: 'neutral', icon: 'apachemaven' },
  docker: { id: 'docker', label: 'Docker', tone: 'neutral', icon: 'docker' },
  make: { id: 'make', label: 'Make', tone: 'neutral', icon: 'build' },
  just: { id: 'just', label: 'Just', tone: 'neutral', icon: 'recipe' },
  task: { id: 'task', label: 'Task', tone: 'neutral', icon: 'task' },
  npx: { id: 'npx', label: 'npx', tone: 'npm', icon: 'npm' },
}
const shellTool: Identity = { id: 'shell', label: 'Shell', tone: 'custom', icon: 'shell' }
const fallback: Identity = { id: 'custom', label: 'Custom', tone: 'custom', icon: 'command' }

function customTool(command: string): Identity {
  // Presentation only: never inspect a script body or reinterpret shell arguments.
  const executable = (command.trim().split(/[\\/]/).at(-1) || '')
    .toLowerCase()
    .replace(/\.(exe|cmd|bat)$/u, '')
  if (Object.hasOwn(managers, executable))
    return { id: `script:${executable}`, ...managers[executable as keyof typeof managers] }
  if (
    ['bash', 'sh', 'zsh', 'fish', 'dash', 'ksh', 'powershell', 'pwsh', 'cmd'].includes(
      executable,
    ) ||
    /\.(sh|bash|zsh|ps1)$/u.test(executable)
  )
    return shellTool
  if (/^python(?:[23](?:\.\d+)*)?$/u.test(executable) || executable.endsWith('.py'))
    return customTools.python!
  const aliases: Record<string, string> = {
    gradlew: 'gradle',
    mvnw: 'mvn',
    gmake: 'make',
    'docker-compose': 'docker',
  }
  const name = Object.hasOwn(aliases, executable) ? aliases[executable]! : executable
  return Object.hasOwn(customTools, name)
    ? customTools[name]!
    : /\.(bat|cmd)$/iu.test(command)
      ? shellTool
      : fallback
}

export function taskTool(task: Pick<Task, 'kind' | 'manager' | 'command'>): TaskTool {
  if (task.kind === 'script' && task.manager) {
    const manager = Object.hasOwn(managers, task.manager)
      ? managers[task.manager as keyof typeof managers]
      : { label: task.manager, tone: 'neutral' as const, icon: 'command' as const }
    return {
      id: `script:${task.manager}`,
      ...manager,
      hint: `This package.json script runs with ${manager.label}, as detected for its folder.`,
    }
  }
  if (task.kind === 'gradle')
    return {
      id: 'gradle',
      label: 'Gradle',
      tone: 'gradle',
      icon: 'gradle',
      hint: 'Runs with the Gradle wrapper in this task’s folder.',
    }
  if (task.kind === 'custom')
    return {
      ...customTool(task.command),
      hint: `Saved custom command.\nExecutable: ${task.command}`,
    }
  return {
    id: 'script',
    label: 'Script',
    tone: 'neutral',
    icon: 'command',
    hint: 'A package.json script. Its package manager is not available in this worktree.',
  }
}
