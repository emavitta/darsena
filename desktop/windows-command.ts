import { statSync } from 'node:fs'
import path from 'node:path'

export function windowsExecutable(file: string, cwd = process.cwd()): string {
  const roots = /[\\/]/.test(file) ? [''] : [cwd, ...(process.env.PATH || '').split(path.delimiter)]
  const extensions = /\.(exe|com|cmd|bat)$/i.test(file) ? [''] : ['.exe', '.com', '.cmd', '.bat']
  for (const root of roots) {
    for (const extension of extensions) {
      const candidate = path.resolve(cwd, root.replace(/^"|"$/g, ''), file + extension)
      try {
        if (statSync(candidate).isFile()) return candidate
      } catch {}
    }
  }
  throw new Error(
    `Cannot find ${file}. Install its toolchain or choose its executable in Preferences.`,
  )
}

// Windows argv quoting. CMD escaping follows cross-spawn (MIT); see public/third-party/cross-spawn.
const meta = /([()\][%!^"`<>&|;, *?])/g
function quote(arg: string) {
  return '"' + arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"'
}
export function windowsInvocation(file: string, args: string[], cwd?: string) {
  const executable = windowsExecutable(file, cwd)
  if (/\.(cmd|bat)$/i.test(executable)) {
    if ([executable, ...args].some((value) => /[\r\n\0]/.test(value)))
      throw new Error('Batch file arguments must be single lines.')
    const doubleEscape = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i.test(executable)
    const escaped = args.map((arg) => {
      const value = quote(arg).replace(meta, '^$1')
      return doubleEscape ? value.replace(meta, '^$1') : value
    })
    const cmd =
      process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/cmd.exe')
    return {
      file: cmd,
      line: `${quote(cmd)} /d /s /v:off /c "${[executable.replace(meta, '^$1'), ...escaped].join(' ')}"`,
    }
  }
  return { file: executable, line: [executable, ...args].map(quote).join(' ') }
}
