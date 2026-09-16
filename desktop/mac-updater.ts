import { app } from 'electron'
import { MacUpdater } from 'electron-updater'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { command } from './io.js'
import { UpdateInstaller } from './update-installer.js'
import type { UpdateStatus } from '../shared/types.js'

export function createMacInstaller(check: () => Promise<UpdateStatus>, onError: () => void) {
  let updater: MacUpdater | undefined
  const installer = new UpdateInstaller({
    async prepare() {
      if (process.platform !== 'darwin' || !app.isPackaged)
        throw new Error('In-app installation requires an installed macOS release.')
      const bundle = path.resolve(process.execPath, '../../..')
      await access(path.dirname(bundle), constants.W_OK)
      await command('/usr/bin/codesign', [
        '--verify',
        '--deep',
        '--strict',
        '-R=identifier "app.darsena.desktop" and anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists and certificate leaf[subject.OU] = "78RVT54LX5"',
        bundle,
      ])
      const status = await check()
      if (!status.release?.downloadUrl)
        throw new Error(status.error || 'No compatible update available.')
      const url = `https://github.com/emavitta/darsena/releases/download/${encodeURIComponent(status.release.version)}/`
      updater ??= new MacUpdater()
      updater.autoDownload = false
      updater.autoInstallOnAppQuit = false
      updater.allowDowngrade = false
      updater.allowPrerelease = status.includePrereleases
      updater.disableDifferentialDownload = true
      updater.setFeedURL({
        provider: 'generic',
        url,
        channel: process.arch,
        useMultipleRangeRequest: false,
      })
      updater.removeAllListeners('download-progress')
      updater.removeAllListeners('error')
      updater.on('download-progress', (progress) => installer.progress(progress.percent))
      updater.on('error', (error) => {
        installer.fail(error)
        onError()
      })
      const result = await updater.checkForUpdates()
      if (!result || result.updateInfo.version !== status.release.version.replace(/^v/, ''))
        throw new Error('Update metadata does not match the selected release.')
    },
    async download() {
      await updater!.downloadUpdate()
    },
    install() {
      updater!.quitAndInstall()
    },
  })
  return installer
}
