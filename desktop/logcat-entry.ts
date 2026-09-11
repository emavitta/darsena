import { collectLogcat, type LogcatPlan } from './logcat-worker.js'
try {
  await collectLogcat(JSON.parse(process.argv[2]!) as LogcatPlan)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  process.disconnect?.()
}
