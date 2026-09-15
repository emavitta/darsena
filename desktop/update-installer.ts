import type { InstallStatus } from '../shared/types.js'

export interface InstallerAdapter {
  prepare(): Promise<void>
  download(): Promise<void>
  install(): void
}
export class UpdateInstaller {
  status: InstallStatus = { phase: 'idle', percent: 0 }
  constructor(private adapter: InstallerAdapter) {}
  progress(percent: number) {
    if (this.status.phase === 'downloading')
      this.status.percent = Math.max(0, Math.min(100, percent))
  }
  fail(error: unknown) {
    this.status = {
      ...this.status,
      phase: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
  async download() {
    if (['downloading', 'ready', 'installing'].includes(this.status.phase)) return
    this.status = { phase: 'downloading', percent: 0 }
    try {
      await this.adapter.prepare()
      await this.adapter.download()
      this.status = { phase: 'ready', percent: 100 }
    } catch (error) {
      this.fail(error)
    }
  }
  install(activeRuns: number) {
    if (activeRuns) throw new Error('Stop running tasks before installing the update.')
    if (this.status.phase !== 'ready') throw new Error('Download the update first.')
    this.status.phase = 'installing'
    try {
      this.adapter.install()
    } catch (error) {
      this.fail(error)
      throw error
    }
  }
}
