export const logLevels = ['V', 'D', 'I', 'W', 'E', 'F'] as const
export type LogLevel = (typeof logLevels)[number]
export function filterLogcat(text: string, query = '', level: LogLevel = 'V') {
  const minimum = logLevels.indexOf(level)
  text = text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\r(?!\n)/g, '\n')
  return text
    .split('\n')
    .filter((line) => {
      const severity = line.match(/^\d\d-\d\d\s+\S+\s+\d+\s+\d+\s+([VDIWEF])\s/)?.[1] as
        LogLevel | undefined
      return (
        (!severity || logLevels.indexOf(severity) >= minimum) &&
        line.toLowerCase().includes(query.toLowerCase())
      )
    })
    .join('\n')
}
