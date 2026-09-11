import { deploy, type AndroidPlan } from './android-worker.js'
try {
  await deploy(JSON.parse(process.argv[2]!) as AndroidPlan)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
