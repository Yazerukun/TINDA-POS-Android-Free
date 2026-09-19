import { FORMAT_ID, FORMAT_VERSION } from './canonical'
import type { TindaBackupData, TindaBackupFile, TindaBackupManifest } from './types'

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export async function sha256(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function computeChecksum(data: TindaBackupData): Promise<string> {
  return sha256(stableStringify(data))
}

export function buildManifest(source: {
  platform: 'windows' | 'android'
  appVersion: string
  schemaVersion: number
  createdAt?: string
}): TindaBackupManifest {
  return {
    format: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    source: {
      platform: source.platform,
      appVersion: source.appVersion,
      schemaVersion: source.schemaVersion
    },
    createdAt: source.createdAt ?? new Date().toISOString()
  }
}

export async function buildBackupFile(
  data: TindaBackupData,
  source: { platform: 'windows' | 'android'; appVersion: string; schemaVersion: number; createdAt?: string }
): Promise<TindaBackupFile> {
  return {
    manifest: buildManifest(source),
    data,
    checksum: await computeChecksum(data)
  }
}

export function serializeBackupFile(file: TindaBackupFile): string {
  return JSON.stringify(file)
}

export function parseBackupFile(text: string): TindaBackupFile {
  return JSON.parse(text) as TindaBackupFile
}