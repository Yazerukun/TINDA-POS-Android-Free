import { describe, expect, it } from 'vitest'
import {
  compareSemver,
  downloadAssetName,
  filterStable,
  githubReleasesApiUrl,
  isOfficialUpdateUrl,
  isStableVersion,
  isValidVersion,
  latestStable,
  parseGitHubRelease,
  parseGitHubReleases,
  parseSemver,
  pickAsset,
  portableRuntime,
  safeReleaseNotes,
  shouldAutoCheck,
  UPDATE_CHECK_THROTTLE_MS
} from '../update'

describe('semver parsing and comparison', () => {
  it('parses plain and prefixed versions', () => {
    expect(parseSemver('1.0.3')).toEqual({ major: 1, minor: 0, patch: 3, prerelease: null, build: null, raw: '1.0.3' })
    expect(parseSemver('v1.0.2-hotfix.1')?.prerelease).toBe('hotfix.1')
    expect(parseSemver('V2.1.0-x.7+build-42')?.build).toBe('build-42')
  })

  it('rejects garbage', () => {
    expect(parseSemver(null)).toBeNull()
    expect(parseSemver('latest')).toBeNull()
    expect(parseSemver('1.0.3.4')).toBeNull()
    expect(parseSemver('')).toBeNull()
    expect(parseSemver('v')).toBeNull()
  })

  it('compares numerically, not lexicographically', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1)
    expect(compareSemver('1.0.10', '1.0.9')).toBe(1)
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1)
  })

  it('places release versions above prereleases of the same version', () => {
    expect(compareSemver('1.0.3', '1.0.3-rc.1')).toBe(1)
    expect(compareSemver('1.0.3-rc.1', '1.0.3')).toBe(-1)
    expect(compareSemver('1.0.3', '1.0.3')).toBe(0)
  })

  it('orders prerelease identifiers by standard rules', () => {
    expect(compareSemver('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1)
    expect(compareSemver('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBe(-1)
    expect(compareSemver('1.0.0-beta.2', '1.0.0-beta.11')).toBe(-1)
    expect(compareSemver('1.0.0-hotfix.10', '1.0.0-hotfix.2')).toBe(1)
  })

  it('validates stability and format', () => {
    expect(isValidVersion('1.0.3')).toBe(true)
    expect(isValidVersion('nope')).toBe(false)
    expect(isStableVersion('1.0.3')).toBe(true)
    expect(isStableVersion('1.0.3-rc.1')).toBe(false)
  })
})

describe('GitHub release parsing', () => {
  const release = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    tag_name: 'v1.0.4',
    name: 'TINDA POS v1.0.4',
    published_at: '2026-01-01T00:00:00Z',
    draft: false,
    prerelease: false,
    body: 'Adds update system',
    assets: [
      { name: 'TindaPOS-Setup-1.0.4.exe', browser_download_url: 'https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.4/TindaPOS-Setup-1.0.4.exe', size: 900 },
      { name: 'TindaPOS-Portable-1.0.4.exe', browser_download_url: 'https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.4/TindaPOS-Portable-1.0.4.exe', size: 800 }
    ],
    ...overrides
  })

  it('parses a stable release', () => {
    const r = parseGitHubRelease(release())
    expect(r).not.toBeNull()
    expect(r?.version).toBe('1.0.4')
    expect(r?.tag).toBe('v1.0.4')
    expect(r?.stable).toBe(true)
    expect(r?.assets).toHaveLength(2)
  })

  it('rejects invalid tags', () => {
    expect(parseGitHubRelease(release({ tag_name: 'not-a-version' }))).toBeNull()
    expect(parseGitHubRelease(null)).toBeNull()
    expect(parseGitHubRelease(42)).toBeNull()
  })

  it('marks drafts and prereleases as non-stable', () => {
    expect(parseGitHubRelease(release({ draft: true }))?.stable).toBe(false)
    expect(parseGitHubRelease(release({ prerelease: true }))?.stable).toBe(false)
    expect(parseGitHubRelease(release({ tag_name: 'v1.0.4-rc.1' }))?.stable).toBe(false)
  })

  it('ignores assets with missing or non-http urls', () => {
    const r = parseGitHubRelease(release({ assets: [
      { name: 'x.exe', browser_download_url: 'file:///tmp/x.exe', size: 1 },
      { name: 'y.exe', browser_download_url: '', size: 1 },
      { name: 'z.exe', browser_download_url: 'https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.4/z.exe', size: 5 }
    ] }))
    expect(r?.assets).toEqual([{ name: 'z.exe', url: 'https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.4/z.exe', size: 5 }])
  })

  it('sorts releases by version descending and filters stable', () => {
    const list = parseGitHubReleases([
      release({ tag_name: 'v1.0.5' }),
      release({ tag_name: 'v1.0.4-rc.1' }),
      release({ tag_name: 'v1.0.3', prerelease: true }),
      release({ tag_name: 'v1.0.9' }),
      release({ tag_name: 'v0.9.0' })
    ])
    expect(list.map((r) => r.version)).toEqual(['1.0.9', '1.0.5', '1.0.4-rc.1', '1.0.3', '0.9.0'])
    const stable = filterStable(list).map((r) => r.version)
    expect(stable).toEqual(['1.0.9', '1.0.5', '0.9.0'])
    expect(latestStable(list)?.version).toBe('1.0.9')
    expect(latestStable([])).toBeNull()
  })

  it('picks setup and portable assets by kind', () => {
    const r = parseGitHubRelease(release())!
    expect(pickAsset(r, 'setup')?.name).toBe('TindaPOS-Setup-1.0.4.exe')
    expect(pickAsset(r, 'portable')?.name).toBe('TindaPOS-Portable-1.0.4.exe')
    expect(downloadAssetName(r, false)).toBe('TindaPOS-Setup-1.0.4.exe')
    expect(downloadAssetName(r, true)).toBe('TindaPOS-Portable-1.0.4.exe')
  })
})

describe('official update source guard', () => {
  it('allows only official repo URLs over https', () => {
    expect(isOfficialUpdateUrl('https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.4/TindaPOS-Setup-1.0.4.exe')).toBe(true)
    expect(isOfficialUpdateUrl(githubReleasesApiUrl())).toBe(true)
    expect(isOfficialUpdateUrl(githubReleasesApiUrl() + '/2')).toBe(true)
  })

  it('rejects arbitrary domains, other repos, and non-https', () => {
    expect(isOfficialUpdateUrl('https://evil.example.com/TindaPOS-Setup-1.0.4.exe')).toBe(false)
    expect(isOfficialUpdateUrl('https://github.com/SomeOtherRepo/TINDA-POS/releases/download/x.exe')).toBe(false)
    expect(isOfficialUpdateUrl('https://github.com/FrancisIanMuyco/other/releases/download/x.exe')).toBe(false)
    expect(isOfficialUpdateUrl('http://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/x.exe')).toBe(false)
    expect(isOfficialUpdateUrl('javascript:alert(1)')).toBe(false)
    expect(isOfficialUpdateUrl('')).toBe(false)
  })
})

describe('auto-check throttle', () => {
  const now = 1_900_000_000_000
  it('runs when never checked', () => {
    expect(shouldAutoCheck(null, now)).toBe(true)
  })
  it('runs after the 24h window', () => {
    expect(shouldAutoCheck(now - UPDATE_CHECK_THROTTLE_MS - 1, now)).toBe(true)
  })
  it('skips when checked recently', () => {
    expect(shouldAutoCheck(now - 60_000, now)).toBe(false)
  })
  it('respects a custom throttle window', () => {
    expect(shouldAutoCheck(now - 3_600_000, now, 3_600_000)).toBe(true)
    expect(shouldAutoCheck(now - 600_000, now, 3_600_000)).toBe(false)
  })
})

describe('portable runtime detection', () => {
  it('detects the electron-builder portable runtime', () => {
    expect(portableRuntime({ PORTABLE_EXECUTABLE_DIR: 'D:\\TindaPOS' })).toBe(true)
    expect(portableRuntime({ PORTABLE_EXECUTABLE_DIR: '' })).toBe(false)
    expect(portableRuntime({})).toBe(false)
  })
})

describe('release notes sanitization', () => {
  it('strips control characters and truncates', () => {
    const out = safeReleaseNotes('Line one\n\x00\x1fLine two', 4)
    expect(out).toContain('Line')
    expect(out.startsWith('Line')).toBe(true)
    expect(out).not.toContain('\u0000')
    expect(safeReleaseNotes('', 10)).toBe('')
    expect(safeReleaseNotes('    ', 10)).toBe('    ')
    expect(safeReleaseNotes(undefined as unknown as string, 10)).toBe('')
  })
})