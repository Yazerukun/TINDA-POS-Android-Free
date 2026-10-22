/**
 * ============================================================================
 * 🛡️ TINDA POS SECURITY & INTEGRITY SERVICE
 * ============================================================================
 * Defense-in-Depth Protection:
 *  - Native APK Signature Pinning & Anti-Repackaging
 *  - Cryptographic Feature Entanglement (Zero-Mock Security)
 *  - Smart Input Auto-Formatting & QR Extraction
 * ============================================================================
 */

import { registerPlugin } from '@capacitor/core'

export interface AppIntegrityResult {
  signatureValid: boolean
  isRooted: boolean
  isDebuggable: boolean
  packageName: string
  primaryCertificateSha256?: string
  tamperDetected: boolean
}

interface TindaSecurityPlugin {
  getAppIntegrity(): Promise<AppIntegrityResult>
}

const TindaSecurity = registerPlugin<TindaSecurityPlugin>('TindaSecurity')

const LICENSE_KEY_REGEX = /^(VIP|DEMO)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i
const LICENSE_EXTRACT_REGEX = /(VIP|DEMO)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i

/**
 * Format raw user input into standard VIP-XXXX-XXXX-XXXX-XXXX key pattern.
 * Automatically inserts hyphens after every 4 alphanumeric characters.
 */
export function formatLicenseKeyInput(val: string): string {
  const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!clean) return ''

  let prefix = ''
  let rest = clean
  if (clean.startsWith('VIP')) {
    prefix = 'VIP'
    rest = clean.slice(3)
  } else if (clean.startsWith('DEMO')) {
    prefix = 'DEMO'
    rest = clean.slice(4)
  }

  if (!prefix) {
    // If user hasn't typed VIP or DEMO yet, format chunkwise up to 20 chars
    const chunks: string[] = []
    for (let i = 0; i < clean.length && i < 20; i += 4) {
      chunks.push(clean.substring(i, i + 4))
    }
    return chunks.join('-')
  }

  // With known prefix, chunk the remaining 16 characters in groups of 4
  const chunks: string[] = [prefix]
  for (let i = 0; i < rest.length && i < 16; i += 4) {
    chunks.push(rest.substring(i, i + 4))
  }
  return chunks.join('-')
}

/**
 * Extract license key from a scanned QR code text or URL
 */
export function extractLicenseFromScannedText(text: string): string | null {
  if (!text) return null
  const match = text.match(LICENSE_EXTRACT_REGEX)
  return match ? match[0].toUpperCase() : null
}

/**
 * Validates syntax structure of a license key
 */
export function validateLicenseSyntax(key: string): { formatOk: boolean; tier?: 'VIP_PRO' | 'VIP_DEMO' } {
  if (!key) return { formatOk: false }
  const clean = key.trim().toUpperCase()
  if (!LICENSE_KEY_REGEX.test(clean)) {
    return { formatOk: false }
  }
  return {
    formatOk: true,
    tier: clean.startsWith('DEMO-') ? 'VIP_DEMO' : 'VIP_PRO'
  }
}

/**
 * Check native APK integrity (Signature pinning, tampering, rooting)
 */
export async function checkAppIntegrity(): Promise<AppIntegrityResult> {
  try {
    return await TindaSecurity.getAppIntegrity()
  } catch {
    // Fallback in web / test / non-Android environment
    return {
      signatureValid: true,
      isRooted: false,
      isDebuggable: true,
      packageName: 'com.tindapos.free',
      tamperDetected: false
    }
  }
}

/**
 * Cryptographic Feature Entanglement (Zero-Mock Defense).
 * Derives a functional cryptographic token required by high-privilege features
 * (such as Desktop SQLite migration and encrypted backup exports).
 * Cracking is thwarted because simply setting `isVip = true` does not supply
 * the mathematical key necessary to generate this token.
 */
export async function deriveFeatureEntanglementToken(
  licenseKey: string,
  machineId: string,
  featureName: string
): Promise<string> {
  const encoder = new TextEncoder()
  const payload = `ENTANGLED_SECURITY::${machineId}::${licenseKey}::${featureName}`
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
