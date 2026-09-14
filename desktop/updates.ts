import { z } from 'zod'
import type { UpdateStatus } from '../shared/types.js'

const releaseSchema = z.array(z.object({
  tag_name: z.string(), draft: z.boolean(), prerelease: z.boolean(),
  body: z.string().nullable(),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.string(), state: z.string() })),
}))
function version(value: string) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z.-]+))?(?:\+[\da-zA-Z.-]+)?$/.exec(value)
  return match ? { numbers: match.slice(1, 4).map(Number), pre: match[4]?.split('.') } : undefined
}
export function compareVersions(a: string, b: string): number {
  const left = version(a), right = version(b)
  if (!left || !right) return 0
  for (let i = 0; i < 3; i++) if (left.numbers[i] !== right.numbers[i]) return left.numbers[i]! - right.numbers[i]!
  if (!left.pre || !right.pre) return left.pre ? -1 : right.pre ? 1 : 0
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i], y = right.pre[i]
    if (x === y) continue
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y)
    return nx && ny ? Number(x) - Number(y) : nx !== ny ? (nx ? -1 : 1) : x < y ? -1 : 1
  }
  return 0
}
export function selectUpdate(data: unknown, currentVersion: string, arch: string, platform: string): UpdateStatus {
  const includePrereleases = currentVersion.startsWith('0.') || currentVersion.includes('-')
  const releases = releaseSchema.parse(data).filter(r => !r.draft && version(r.tag_name) &&
    (includePrereleases || (!r.prerelease && !version(r.tag_name)?.pre)) && compareVersions(r.tag_name, currentVersion) > 0)
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))
  const release = releases[0]
  const result: UpdateStatus = { currentVersion, includePrereleases, checkedAt: Date.now() }
  if (!release) return result
  const base = 'https://github.com/emavitta/darsena/releases/'
  const asset = platform === 'darwin' ? release.assets.find(a => a.state === 'uploaded' &&
    a.name.endsWith(`-${arch}.dmg`) && a.browser_download_url.startsWith(`${base}download/${encodeURIComponent(release.tag_name)}/`)) : undefined
  result.release = { version: release.tag_name, notes: (release.body || '').slice(0, 20000),
    url: `${base}tag/${encodeURIComponent(release.tag_name)}`, downloadUrl: asset?.browser_download_url }
  return result
}
export function createUpdateChecker(currentVersion: string, arch: string, platform: string) {
  let cached: UpdateStatus | undefined
  let inFlight: Promise<UpdateStatus> | undefined
  return async (force = false): Promise<UpdateStatus> => {
    if (inFlight) return inFlight
    if (cached && Date.now() - cached.checkedAt < (force ? 60000 : 3600000)) return cached
    inFlight = (async () => {
      try {
        const response = await fetch('https://api.github.com/repos/emavitta/darsena/releases?per_page=100', {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Darsena/${currentVersion}` },
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? 'GitHub request limit reached. Try again later.' : `GitHub returned HTTP ${response.status}.`)
        cached = selectUpdate(await response.json(), currentVersion, arch, platform)
      } catch (error) {
        cached = { currentVersion, includePrereleases: currentVersion.startsWith('0.') || currentVersion.includes('-'), checkedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Unable to check GitHub releases.' }
      }
      return cached
    })()
    try { return await inFlight } finally { inFlight = undefined }
  }
}
