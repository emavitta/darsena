export function usePlatform() {
  const isWindows = import.meta.client && window.darsena?.platform === 'win32'
  return {
    isWindows,
    platformName: isWindows ? 'Windows' : 'macOS',
    fileManager: isWindows ? 'File Explorer' : 'Finder',
    shortcutKey: isWindows ? 'Ctrl' : '⌘',
  }
}
