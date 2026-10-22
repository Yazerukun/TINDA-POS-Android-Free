/**
 * ============================================================================
 * 💎 TINDA POS MOBILE & TABLET — VIP PRO CRYPTOGRAPHIC LICENSE SERVICE
 * ============================================================================
 * Author: Ian (Dev Francis)
 * Maya Payment: 0991 225 5156 (₱500 One-Time VIP Pro Lifetime)
 * Facebook: https://www.facebook.com/Ukauru
 *
 * 100% Cryptographically Interoperable with TINDA POS Desktop Keygen (tools/keygen.mjs)
 * Triple-Vault Indestructible Storage:
 *  - Vault 1: Android Native SharedPreferences (@capacitor/preferences)
 *  - Vault 2: Dexie IndexedDB meta store ('tinda-pos-free' db.meta)
 *  - Vault 3: Browser localStorage
 * ============================================================================
 */

import { Device } from '@capacitor/device'
import { Preferences } from '@capacitor/preferences'
import { db } from '../data/db'
import type { LicenseStatus, LicenseTier, StoredLicensePayload } from '@shared/types'

// Cryptographic pepper bytes identical to desktop keygen and service
const PEPPER_BYTES = new Uint8Array([
  0x54, 0x49, 0x4e, 0x44, 0x41, 0x5f, 0x56, 0x49, 0x50, 0x5f,
  0x53, 0x45, 0x43, 0x55, 0x52, 0x45, 0x5f, 0x50, 0x45, 0x50,
  0x50, 0x45, 0x52, 0x5f, 0x32, 0x30, 0x32, 0x36, 0x5f, 0x46,
  0x52, 0x41, 0x4e, 0x43, 0x49, 0x53, 0x5f, 0x4d, 0x41, 0x59,
  0x41, 0x5f, 0x30, 0x39, 0x39, 0x31, 0x32, 0x32, 0x35, 0x35,
  0x31, 0x35, 0x36
])

const MASK_KEY = 0x5a
const PREF_KEY_MACHINE_ID = 'tinda_machine_id'
const PREF_KEY_LICENSE = 'tinda_license_payload'
const MACHINE_ID_REGEX = /^TNDA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

function getInternalSecret(): Uint8Array {
  const buf = new Uint8Array(PEPPER_BYTES.length)
  for (let i = 0; i < PEPPER_BYTES.length; i++) {
    buf[i] = (PEPPER_BYTES[i] ?? 0) ^ (MASK_KEY + (i % 7))
  }
  return buf
}

const textEncoder = new TextEncoder()

async function subtleHmacSha256(secret: Uint8Array, message: string): Promise<string> {
  const cryptoObj = globalThis.crypto
  if (!cryptoObj?.subtle) {
    throw new Error('WebCrypto subtle is not available in this runtime environment.')
  }
  const key = await cryptoObj.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await cryptoObj.subtle.sign('HMAC', key, textEncoder.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function subtleSha256(message: string): Promise<string> {
  const cryptoObj = globalThis.crypto
  if (!cryptoObj?.subtle) {
    throw new Error('WebCrypto subtle is not available in this runtime environment.')
  }
  const digest = await cryptoObj.subtle.digest('SHA-256', textEncoder.encode(message))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Constant-time string equality to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export class LicenseService {
  private static instance: LicenseService | null = null
  private cachedMachineId: string | null = null
  private currentStatus: LicenseStatus | null = null

  public static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService()
    }
    return LicenseService.instance
  }

  /**
   * Tamper-proofing HMAC signature calculation.
   * Matches desktop implementation exactly.
   */
  public async computeTamperHash(
    machineId: string,
    key: string,
    activatedAt: string,
    customerName?: string | null,
    demoExpiresAt?: string | null
  ): Promise<string> {
    const secret = getInternalSecret()
    const base = `FILE_TAMPER_GUARD::${machineId}::${key}::${activatedAt}::${customerName ?? ''}`
    const payloadStr = demoExpiresAt ? `${base}::${demoExpiresAt}` : base
    return subtleHmacSha256(secret, payloadStr)
  }

  /**
   * Generates key for a machine ID.
   * 100% Identical algorithm to tools/keygen.mjs!
   */
  public async generateKeyForMachine(machineId: string, tier: LicenseTier = 'VIP_PRO'): Promise<string> {
    const normMachine = machineId.trim().toUpperCase()
    const secret = getInternalSecret()

    const fullSig = (await subtleHmacSha256(secret, `TINDA_AUTH_V1::${normMachine}::${tier}`)).toUpperCase()

    const chunk1 = fullSig.substring(0, 4)
    const chunk2 = fullSig.substring(4, 8)
    const chunk3 = fullSig.substring(8, 12)

    const checkData =
      tier === 'VIP_DEMO'
        ? `${normMachine}:${chunk1}${chunk2}${chunk3}:${tier}`
        : `${normMachine}:${chunk1}${chunk2}${chunk3}`

    const checksumHash = (await subtleSha256(checkData)).toUpperCase()
    const checksum = checksumHash.substring(0, 4)

    const prefix = tier === 'VIP_DEMO' ? 'DEMO' : 'VIP'
    return `${prefix}-${chunk1}-${chunk2}-${chunk3}-${checksum}`
  }

  /**
   * Verify whether a given key is mathematically valid for this machine.
   */
  public async verifyKey(key: string, machineId: string): Promise<boolean> {
    if (!key || typeof key !== 'string') return false
    const cleanKey = key.trim().toUpperCase()
    const tier: LicenseTier = cleanKey.startsWith('DEMO-') ? 'VIP_DEMO' : 'VIP_PRO'
    const expected = await this.generateKeyForMachine(machineId, tier)

    return constantTimeEqual(cleanKey, expected)
  }

  /**
   * Read permanently anchored Machine ID across all 3 vaults:
   * 1. Preferences (Android SharedPreferences)
   * 2. Dexie IndexedDB meta table
   * 3. Browser localStorage
   */
  public async readAnchoredMachineId(): Promise<string | null> {
    // Vault 1: Capacitor Native Preferences
    try {
      const { value } = await Preferences.get({ key: PREF_KEY_MACHINE_ID })
      if (value && MACHINE_ID_REGEX.test(value.trim().toUpperCase())) {
        return value.trim().toUpperCase()
      }
    } catch {}

    // Vault 2: Dexie meta store
    try {
      const row = await db.meta.get(PREF_KEY_MACHINE_ID)
      if (row && row.value && MACHINE_ID_REGEX.test(row.value.trim().toUpperCase())) {
        return row.value.trim().toUpperCase()
      }
    } catch {}

    // Vault 3: localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(PREF_KEY_MACHINE_ID)
        if (val && MACHINE_ID_REGEX.test(val.trim().toUpperCase())) {
          return val.trim().toUpperCase()
        }
      }
    } catch {}

    return null
  }

  /**
   * Synchronize anchored Machine ID to all 3 vaults for indestructible persistence.
   */
  public async syncAnchoredMachineId(machineId: string): Promise<void> {
    const cleanId = machineId.trim().toUpperCase()

    // Vault 1: Preferences
    try {
      await Preferences.set({ key: PREF_KEY_MACHINE_ID, value: cleanId })
    } catch {}

    // Vault 2: Dexie meta store
    try {
      await db.meta.put({ key: PREF_KEY_MACHINE_ID, value: cleanId })
    } catch {}

    // Vault 3: localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREF_KEY_MACHINE_ID, cleanId)
      }
    } catch {}
  }

  /**
   * Computes an immutable hardware fingerprint for Android/Tablet.
   * Utilizes Capacitor Device ID (Android ID / hardware UUID), device model, manufacturer,
   * platform, screen properties, and crypto entropy if needed.
   */
  public async computeHardwareFingerprint(): Promise<string> {
    const rawParts: string[] = []

    try {
      const idInfo = await Device.getId()
      if (idInfo?.identifier) {
        rawParts.push(`DEV_ID:${idInfo.identifier}`)
      }
    } catch {}

    try {
      const info = await Device.getInfo()
      if (info?.model) rawParts.push(`MODEL:${info.model}`)
      if (info?.manufacturer) rawParts.push(`MFG:${info.manufacturer}`)
      if (info?.platform) rawParts.push(`PLATFORM:${info.platform}`)
      if (info?.osVersion) rawParts.push(`OS:${info.osVersion}`)
    } catch {}

    if (typeof screen !== 'undefined') {
      rawParts.push(`SCREEN:${screen.width}x${screen.height}x${screen.colorDepth}`)
    }

    if (typeof navigator !== 'undefined') {
      rawParts.push(`UA:${navigator.userAgent}`)
      if (navigator.hardwareConcurrency) {
        rawParts.push(`CPU:${navigator.hardwareConcurrency}`)
      }
    }

    if (rawParts.length === 0) {
      // Fallback entropy
      const randomBuf = new Uint8Array(16)
      if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(randomBuf)
      }
      rawParts.push(`ENTROPY:${Array.from(randomBuf).map((b) => b.toString(16).padStart(2, '0')).join('')}`)
    }

    const rawString = rawParts.join(';;;')
    const hash = (await subtleSha256(rawString)).toUpperCase()
    return `TNDA-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`
  }

  /**
   * Derive live Machine Hardware ID.
   * Checks for existing anchored Machine ID across all 3 vaults.
   * If not found, generates a stable hardware fingerprint and anchors it permanently.
   */
  public async getMachineId(): Promise<string> {
    if (this.cachedMachineId) return this.cachedMachineId

    // Priority 1: Permanently anchored Machine ID
    const anchored = await this.readAnchoredMachineId()
    if (anchored) {
      this.cachedMachineId = anchored
      await this.syncAnchoredMachineId(anchored)
      return anchored
    }

    // Priority 2: Compute hardware fingerprint and anchor across all vaults
    const freshId = await this.computeHardwareFingerprint()
    this.cachedMachineId = freshId
    await this.syncAnchoredMachineId(freshId)
    return freshId
  }

  /**
   * Read stored license payload from all 3 vaults:
   * 1. Preferences
   * 2. Dexie IndexedDB meta
   * 3. localStorage
   */
  public async readAllVaults(): Promise<StoredLicensePayload[]> {
    const results: StoredLicensePayload[] = []
    const seenHashes = new Set<string>()

    const tryAdd = (rawStr: string | null | undefined) => {
      if (!rawStr) return
      try {
        const payload = JSON.parse(rawStr) as StoredLicensePayload
        if (payload && payload.licenseKey && payload.machineId && payload.tamperProofHash) {
          const key = `${payload.machineId}::${payload.licenseKey}`
          if (!seenHashes.has(key)) {
            seenHashes.add(key)
            results.push(payload)
          }
        }
      } catch {}
    }

    // Vault 1: Preferences
    try {
      const { value } = await Preferences.get({ key: PREF_KEY_LICENSE })
      tryAdd(value)
    } catch {}

    // Vault 2: Dexie meta store
    try {
      const row = await db.meta.get(PREF_KEY_LICENSE)
      tryAdd(row?.value)
    } catch {}

    // Vault 3: localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        tryAdd(localStorage.getItem(PREF_KEY_LICENSE))
      }
    } catch {}

    return results
  }

  /**
   * Synchronize / heal a valid VIP license payload across all 3 vaults.
   */
  public async syncToAllVaults(payload: StoredLicensePayload): Promise<void> {
    const raw = JSON.stringify(payload)

    // Vault 1: Preferences
    try {
      await Preferences.set({ key: PREF_KEY_LICENSE, value: raw })
    } catch {}

    // Vault 2: Dexie meta store
    try {
      await db.meta.put({ key: PREF_KEY_LICENSE, value: raw })
    } catch {}

    // Vault 3: localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREF_KEY_LICENSE, raw)
      }
    } catch {}
  }

  /**
   * Remove license payload from all 3 vaults.
   */
  public async removeAllVaults(): Promise<void> {
    try {
      await Preferences.remove({ key: PREF_KEY_LICENSE })
    } catch {}

    try {
      await db.meta.delete(PREF_KEY_LICENSE)
    } catch {}

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PREF_KEY_LICENSE)
      }
    } catch {}

    this.currentStatus = null
  }

  /**
   * Load and verify active license status across all vaults.
   */
  public async getStatus(): Promise<LicenseStatus> {
    const canonicalMachineId = await this.getMachineId()
    const vaults = await this.readAllVaults()

    for (const stored of vaults) {
      if (!stored.licenseKey || !stored.machineId) continue

      // 1. Tamper-Proof Signature Check
      const expectedTamperHash = await this.computeTamperHash(
        stored.machineId,
        stored.licenseKey,
        stored.activatedAt,
        stored.customerName,
        stored.demoExpiresAt
      )
      if (!constantTimeEqual(stored.tamperProofHash, expectedTamperHash)) {
        continue // Tampered payload, check next vault
      }

      // 2. Cryptographic Mathematical Key Verification
      const isValid = await this.verifyKey(stored.licenseKey, stored.machineId)
      if (!isValid) {
        continue // Invalid mathematical key, check next vault
      }

      // 3. Demo expiration check
      const isDemo = stored.tier === 'VIP_DEMO' || stored.licenseKey.startsWith('DEMO-')
      if (isDemo && stored.demoExpiresAt) {
        const now = Date.now()
        const expTime = new Date(stored.demoExpiresAt).getTime()
        if (now > expTime) {
          this.currentStatus = {
            tier: 'COMMUNITY',
            isVip: false,
            isDemo: true,
            demoExpiresAt: stored.demoExpiresAt,
            machineId: canonicalMachineId,
            activatedAt: stored.activatedAt,
            customerName: stored.customerName,
            licenseKey: stored.licenseKey,
            statusMessage: '24-Hour VIP Demo Expired. Upgrade to Lifetime VIP Pro (₱500).'
          }
          return this.currentStatus
        }
      }

      // 4. Hardware match check
      if (stored.machineId === canonicalMachineId) {
        // Self-heal all vaults with verified payload
        await this.syncToAllVaults(stored)
        this.currentStatus = {
          tier: isDemo ? 'VIP_DEMO' : 'VIP_PRO',
          isVip: true,
          isDemo,
          demoExpiresAt: stored.demoExpiresAt ?? null,
          machineId: canonicalMachineId,
          activatedAt: stored.activatedAt,
          customerName: stored.customerName,
          licenseKey: stored.licenseKey,
          statusMessage: isDemo
            ? '24-Hour VIP Demo Active'
            : 'VIP Pro Lifetime Activated (Hardware Locked & Multi-Vault Protected)'
        }
        return this.currentStatus
      }
    }

    // Default: Community Edition
    this.currentStatus = {
      tier: 'COMMUNITY',
      isVip: false,
      machineId: canonicalMachineId,
      activatedAt: null,
      customerName: null,
      licenseKey: null,
      statusMessage: 'Community Edition (Active & Free)'
    }
    return this.currentStatus
  }

  /**
   * Activate VIP Pro using a key provided by Dev Ian.
   */
  public async activate(
    key: string,
    customerName?: string
  ): Promise<{ ok: boolean; message: string; status: LicenseStatus }> {
    const cleanKey = (key || '').trim().toUpperCase()

    if (!cleanKey) {
      return {
        ok: false,
        message: 'Please enter a valid VIP License Key.',
        status: await this.getStatus()
      }
    }

    const currentMid = await this.getMachineId()
    const isValid = await this.verifyKey(cleanKey, currentMid)

    if (!isValid) {
      return {
        ok: false,
        message:
          "Invalid VIP License Key. The key does not match this device's Machine ID. Send ₱500 to Maya 09912255156 and message Dev Ian on Facebook with your Machine ID.",
        status: await this.getStatus()
      }
    }

    const isDemoKey = cleanKey.startsWith('DEMO-')
    const activatedAt = new Date().toISOString()
    const normCustomerName = customerName?.trim() || null

    let demoExpiresAt: string | null = null
    let tier: LicenseTier = 'VIP_PRO'
    let successMessage = 'VIP Pro successfully activated! All premium mobile & tablet features are unlocked.'

    if (isDemoKey) {
      tier = 'VIP_DEMO'
      const expDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      demoExpiresAt = expDate.toISOString()
      successMessage = '24-Hour VIP Demo successfully activated! Full premium experience is active.'
    }

    const tamperProofHash = await this.computeTamperHash(
      currentMid,
      cleanKey,
      activatedAt,
      normCustomerName,
      demoExpiresAt
    )

    const payload: StoredLicensePayload = {
      version: 1,
      tier,
      machineId: currentMid,
      licenseKey: cleanKey,
      customerName: normCustomerName,
      activatedAt,
      demoExpiresAt,
      tamperProofHash
    }

    await this.syncToAllVaults(payload)
    const newStatus = await this.getStatus()

    return {
      ok: true,
      message: successMessage,
      status: newStatus
    }
  }

  /**
   * Deactivate license back to Community across all vaults.
   */
  public async deactivate(): Promise<{ ok: boolean; message: string; status: LicenseStatus }> {
    await this.removeAllVaults()
    const status = await this.getStatus()
    return {
      ok: true,
      message: 'License deactivated. System is now running Community Edition.',
      status
    }
  }
}

export const licenseService = LicenseService.getInstance()
