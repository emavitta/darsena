import { command } from './io.js'
import path from 'node:path'

export const powershell = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
)
export function powershellArgs(script: string) {
  return [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    Buffer.from(
      `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); ${script}`,
      'utf16le',
    ).toString('base64'),
  ]
}
export async function ps(script: string, timeout = 15000) {
  return command(powershell, powershellArgs(script), undefined, timeout)
}
export async function windowsListeners() {
  const output = await ps(
    `$names=@{}; Get-Process | ForEach-Object { $names[$_.Id]=$_.ProcessName }; $rows=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object { @{pid=[int]$_.OwningProcess;command=[string]$names[[int]$_.OwningProcess];port=[int]$_.LocalPort;address=([string]$_.LocalAddress+':'+$_.LocalPort)} }); ConvertTo-Json -InputObject $rows -Compress`,
  )
  return JSON.parse(output) as { pid: number; command: string; port: number; address: string }[]
}
export async function windowsParents() {
  const rows = JSON.parse(
    await ps(
      `$rows=@(Get-CimInstance Win32_Process | ForEach-Object { @{pid=[int]$_.ProcessId;parent=[int]$_.ParentProcessId} }); ConvertTo-Json -InputObject $rows -Compress`,
    ),
  ) as { pid: number; parent: number }[]
  return new Map(rows.map((row) => [row.pid, row.parent]))
}
export async function windowsStartTime(pid: number) {
  return (await ps(`(Get-Process -Id ${pid}).StartTime.ToUniversalTime().Ticks.ToString()`)).trim()
}
export async function stopWindowsProcess(pid: number, startedAt: string) {
  if (!/^\d+$/.test(startedAt)) throw new Error('Invalid process identity.')
  // Keep the process handle open across identity validation and termination.
  await ps(
    `$p=Get-Process -Id ${pid}; $handle=$p.Handle; if($p.StartTime.ToUniversalTime().Ticks.ToString() -ne '${startedAt}') { throw 'The process changed. Refresh and try again.' }; $p.Kill(); $p.WaitForExit(5000) | Out-Null`,
  )
}
