import path from 'node:path'

export const isWindows = process.platform === 'win32'
export let taskHost = path.resolve('dist-electron/darsena-task-host.exe')
export function setTaskHost(file: string) {
  taskHost = file
}
export const gradleWrapper = isWindows ? 'gradlew.bat' : 'gradlew'
export const gradleCommand = isWindows ? '.\\gradlew.bat' : './gradlew'
