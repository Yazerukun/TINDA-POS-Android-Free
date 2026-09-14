/**
 * TINDA POS — in-app update logic.
 *
 * Pure, dependency-free module shared between main and renderer. Everything in
 * here must be testable with plain Node (no electron, no network). Business
 * rules enforced here:
 *   - Semver comparison (not string) for update eligibility.
 *   - Stable-only: drafts, prereleases, and invalid tags are ignored.
 *   - Official source only: https github.com/Yazerukun/TINDA-POS URLs.
 *   - Auto-check throttle (default once per 24h).
 */

export type UpdateStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'UP_TO_DATE'
  | 'UPDATE_AVAILABLE'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'READY_TO_INSTALL'
  | 'DISMISSED'
  | 'OFFLINE'
  | 'UNABLE_TO_CHECK'
  | 'ERROR'

export interface ReleaseAsset {
  name: string
  url: string
  size: number
}

export interface ReleaseInfo {
  version: string
  tag: string
  title: string
  publishedAt: string
  releaseNotes: string
  stable: boolean
  assets: ReleaseAsset[]
}

export interface UpdateProgress {
  downloaded: number
  total: number
  percent: number
}

export interface UpdateStatusEvent {
  status: UpdateStatus
  installedVersion: string
  portable: boolean
  available: ReleaseInfo | null
  progress: UpdateProgress | null
  message: string | null
  lastCheckedAt: string | null
}

export const UPDATE_CHECK_THROTTLE_MS = 24 * 60 * 60 * 1000
export const UPDATE_OWNER = 'Yazerukun'
export const UPDATE_REPO = 'TINDA-POS-Android-Free'

const MAX_RELEASE_NOTES_LENGTH = 20000
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/

export interface ParsedSemver {
  major: number
  minor: number
  patch: number
  prerelease: string | null
  build: string | null
  raw: string
}

export function parseSemver(value: string | null | undefined): ParsedSemver | null {
  if (!value || typeof value !== 'string') return null
  const v = value.trim().replace(/^[vV]/, '')
  const m = SEMVER_RE.exec(v)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
    build: m[5] ?? null,
    raw: v
  }
}

function comparePrerelease(a: string, b: string): number {
  if (a === b) return 0
  const left = a.split('.')
  const right = b.split('.')
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i++) {
    const x = left[i]
    const y = right[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) {
      const d = Number(x) - Number(y)
      if (d !== 0) return d < 0 ? -1 : 1
      continue
    }
    if (xn) return -1
    if (yn) return 1
    const c = x < y ? -1 : 1
    return c
  }
  return 0
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return 0
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1
  if (pa.prerelease === pb.prerelease) return 0
  if (pa.prerelease === null) return 1
  if (pb.prerelease === null) return -1
  return comparePrerelease(pa.prerelease, pb.prerelease)
}

export function isValidVersion(value: string): boolean {
  return parseSemver(value) !== null
}

/** True when the version is a normal release (no prerelease suffix). */
export function isStableVersion(value: string): boolean {
  const p = parseSemver(value)
  return p !== null && p.prerelease === null
}

function assetUrlOf(name: string, url: string, size: number): ReleaseAsset | null {
  if (!name || !url || typeof url !== 'string') return null
  const http = /^https?:\/\//i
  if (!http.test(url)) return null
  return { name, url, size: Number.isFinite(size) && size > 0 ? size : 0 }
}

/**
 * Parse a single GitHub release object from the REST API (`/releases`).
 * Returns null when the tag is not a valid semver version.
 */
export function parseGitHubRelease(json: unknown): ReleaseInfo | null {
  if (!json || typeof json !== 'object') return null
  const r = json as Record<string, unknown>
  const tag = typeof r.tag_name === 'string' ? r.tag_name : ''
  const parsed = parseSemver(tag)
  if (!parsed) return null
  const draft = r.draft === true
  const prerelease = r.prerelease === true
  const assets: ReleaseAsset[] = []
  if (Array.isArray(r.assets)) {
    for (const a of r.assets) {
      if (!a || typeof a !== 'object') continue
      const asset = assetUrlOf(
        String((a as Record<string, unknown>).name ?? ''),
        String((a as Record<string, unknown>).browser_download_url ?? ''),
        Number((a as Record<string, unknown>).size ?? 0)
      )
      if (asset) assets.push(asset)
    }
  }
  return {
    version: parsed.raw,
    tag: tag === '' ? `v${parsed.raw}` : tag,
    title: typeof r.name === 'string' && r.name ? r.name : tag,
    publishedAt: typeof r.published_at === 'string' ? r.published_at : '',
    releaseNotes: safeReleaseNotes(typeof r.body === 'string' ? r.body : ''),
    stable: !draft && !prerelease && parsed.prerelease === null,
    assets
  }
}

export function parseGitHubReleases(input: unknown): ReleaseInfo[] {
  if (!Array.isArray(input)) return []
  const out: ReleaseInfo[] = []
  for (const item of input) {
    const release = parseGitHubRelease(item)
    if (release) out.push(release)
  }
  return out.sort((a, b) => compareSemver(b.version, a.version))
}

export function filterStable(releases: ReleaseInfo[]): ReleaseInfo[] {
  return releases.filter((r) => r.stable)
}

export function latestStable(releases: ReleaseInfo[]): ReleaseInfo | null {
  let best: ReleaseInfo | null = null
  for (const r of filterStable(releases)) {
    if (!best || compareSemver(r.version, best.version) > 0) best = r
  }
  return best
}

export type UpdateAssetKind = 'setup' | 'portable' | 'apk'

const ASSET_PATTERNS: Record<UpdateAssetKind, RegExp> = {
  setup: /^TindaPOS-Setup-\d+\.\d+\.\d+[^.]*\.exe$/i,
  portable: /^TindaPOS-Portable-\d+\.\d+\.\d+[^.]*\.exe$/i,
  apk: /^TindaPOS-Free-\d+\.\d+\.\d+[^.]*\.apk$/i
}

/**
 * Android updater: official APK release asset, plus the expected local install
 * path on the device. Pure (Node-testable) — the renderer/native bridge maps
 * this to the platform download+install flow.
 */
export function pickApk(release: ReleaseInfo): ReleaseAsset | null {
  return pickAsset(release, 'apk')
}

export function pickAsset(release: ReleaseInfo, kind: UpdateAssetKind): ReleaseAsset | null {
  const re = ASSET_PATTERNS[kind]
  for (const a of release.assets) {
    if (re.test(a.name)) return a
  }
  return null
}

/**
 * Official-source guard. Only URLs under the official repo are allowed:
 *   - https://github.com/Yazerukun/TINDA-POS/...  (release asset download pages)
 *   - https://api.github.com/repos/Yazerukun/TINDA-POS/...  (REST API)
 * Redirect targets of a github.com asset URL live on a githubusercontent.com
 * host and are only reachable through the prereqs above; the renderer never
 * sees those raw URLs directly.
 */
export function isOfficialUpdateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.origin === 'https://github.com') {
    return parsed.pathname.startsWith(`/${UPDATE_OWNER}/${UPDATE_REPO}/`)
  }
  if (parsed.origin === 'https://api.github.com') {
    return parsed.pathname.startsWith(`/repos/${UPDATE_OWNER}/${UPDATE_REPO}/`)
  }
  return false
}

export function githubReleasesApiUrl(): string {
  return `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases`
}

export function githubLatestApiUrl(): string {
  return `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`
}

export interface UpdateCheckPlan {
  readonly ok: boolean
  readonly code: 'OK' | 'NO_OFFICIAL_REPO' | 'NOT_STABLE' | 'UP_TO_DATE' | 'NO_APK_ASSET' | 'INVALID_RESPONSE'
  readonly current: string
  readonly latest: ReleaseInfo | null
  readonly apk: ReleaseAsset | null
  readonly reason: string
}

/**
 * Pure orchestrator for a single in-app check: fetch the official releases,
 * require stable, compare semver against the installed current version, and pick
 * the APK asset. Everything here is injectable+deterministic and testable with
 * plain Node (no network, no device). The native bridge only maps
 * `ok === true` to the user-facing "update available" experience.
 */
export function planUpdateCheck(
  input: unknown,
  currentVersion: string,
  pick: (a: ReleaseInfo) => ReleaseAsset | null = (r) => pickApk(r)
): UpdateCheckPlan {
  const releases = parseGitHubReleases(input)
  const latest = latestStable(releases)
  if (!latest) {
    return { ok: false, code: 'NO_OFFICIAL_REPO', current: currentVersion, latest: null, apk: null, reason: 'No official stable release found.' }
  }
  if (compareSemver(latest.version, currentVersion) <= 0) {
    return { ok: false, code: 'UP_TO_DATE', current: currentVersion, latest, apk: null, reason: `Already up to date (${currentVersion}).` }
  }
  const apk = pick(latest)
  if (!apk) {
    return { ok: false, code: 'NO_APK_ASSET', current: currentVersion, latest, apk: null, reason: `Release ${latest.version} has no APK asset.` }
  }
  return { ok: true, code: 'OK', current: currentVersion, latest, apk, reason: `Update ${latest.version} available.` }
}

/** Throttle gate: auto checks run at most once per throttle window. */
export function shouldAutoCheck(lastCheckedAt: number | null, now: number, throttleMs: number = UPDATE_CHECK_THROTTLE_MS): boolean {
  if (!lastCheckedAt || !Number.isFinite(lastCheckedAt)) return true
  return now - lastCheckedAt >= throttleMs
}

/** True when running inside an electron-builder portable executable. */
export function portableRuntime(env: Record<string, string | undefined> = {}): boolean {
  const dir = env.PORTABLE_EXECUTABLE_DIR?.trim()
  return Boolean(dir)
}

/** Strips control characters and truncates release notes. Rendered as plain text. */
export function safeReleaseNotes(body: string, maxLength: number = MAX_RELEASE_NOTES_LENGTH): string {
  if (!body || typeof body !== 'string') return ''
  let cleaned = ''
  for (const ch of body) {
    const code = ch.charCodeAt(0)
    if (code === 0x09 || code === 0x0a || code === 0x0d || code > 0x1f) cleaned += ch
  }
  if (cleaned.length > maxLength) cleaned = `${cleaned.slice(0, maxLength)}…`
  return cleaned
}

/** Pick the correct Windows download target name for a release. */
export function downloadAssetName(release: ReleaseInfo, portable: boolean): string | null {
  const asset = pickAsset(release, portable ? 'portable' : 'setup')
  return asset ? asset.name : null
}
