export type BackupSourcePlatform = 'windows' | 'android'

export interface TindaBackupManifest {
  format: 'tinda-pos-backup'
  formatVersion: 1
  source: {
    platform: BackupSourcePlatform
    appVersion: string
    schemaVersion: number
  }
  createdAt: string
}

export interface TindaBackupTable {
  name: string
  rows: Record<string, unknown>[]
}

export interface TindaBackupData {
  settings: Record<string, unknown> | null
  tables: TindaBackupTable[]
}

export interface TindaBackupFile {
  manifest: TindaBackupManifest
  data: TindaBackupData
  checksum: string
}

export interface ValidationIssue {
  code: string
  table?: string
  row?: number
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

export interface UnsupportedFieldReport {
  unsupportedTables: { name: string; reason: string }[]
  summary: string
}