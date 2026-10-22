import { describe, it, expect } from 'vitest'
import {
  formatLicenseKeyInput,
  extractLicenseFromScannedText,
  validateLicenseSyntax,
  deriveFeatureEntanglementToken
} from '../securityService'

describe('securityService', () => {
  it('formats unhyphenated input into standard 4-chunk groups', () => {
    expect(formatLicenseKeyInput('VIPA238EE4B0AEE46EC')).toBe('VIP-A238-EE4B-0AEE-46EC')
    expect(formatLicenseKeyInput('vipa238ee4b0aee46ec')).toBe('VIP-A238-EE4B-0AEE-46EC')
    expect(formatLicenseKeyInput('DEMO86F820183DA1BC61')).toBe('DEMO-86F8-2018-3DA1-BC61')
  })

  it('handles partial typing correctly without mangling characters', () => {
    expect(formatLicenseKeyInput('VIP')).toBe('VIP')
    expect(formatLicenseKeyInput('VIPA238')).toBe('VIP-A238')
    expect(formatLicenseKeyInput('VIPA238EE')).toBe('VIP-A238-EE')
  })

  it('extracts license key from raw QR code text or URL', () => {
    const rawQr = 'https://tindapos.com/activate?key=VIP-A238-EE4B-0AEE-46EC&store=AlingNena'
    expect(extractLicenseFromScannedText(rawQr)).toBe('VIP-A238-EE4B-0AEE-46EC')

    const jsonQr = '{"machineId":"TNDA-407B-8C8B-C657-3D72","key":"VIP-A238-EE4B-0AEE-46EC"}'
    expect(extractLicenseFromScannedText(jsonQr)).toBe('VIP-A238-EE4B-0AEE-46EC')

    const plainKey = 'DEMO-86F8-2018-3DA1-BC61'
    expect(extractLicenseFromScannedText(plainKey)).toBe('DEMO-86F8-2018-3DA1-BC61')

    expect(extractLicenseFromScannedText('Random invalid barcode')).toBeNull()
  })

  it('validates syntax structure accurately', () => {
    expect(validateLicenseSyntax('VIP-A238-EE4B-0AEE-46EC').formatOk).toBe(true)
    expect(validateLicenseSyntax('VIP-A238-EE4B-0AEE-46EC').tier).toBe('VIP_PRO')

    expect(validateLicenseSyntax('DEMO-86F8-2018-3DA1-BC61').formatOk).toBe(true)
    expect(validateLicenseSyntax('DEMO-86F8-2018-3DA1-BC61').tier).toBe('VIP_DEMO')

    expect(validateLicenseSyntax('INVALID-KEY').formatOk).toBe(false)
    expect(validateLicenseSyntax('').formatOk).toBe(false)
  })

  it('computes deterministic cryptographic entanglement token', async () => {
    const token1 = await deriveFeatureEntanglementToken(
      'VIP-A238-EE4B-0AEE-46EC',
      'TNDA-407B-8C8B-C657-3D72',
      'DESKTOP_SQLITE_MIGRATION'
    )
    const token2 = await deriveFeatureEntanglementToken(
      'VIP-A238-EE4B-0AEE-46EC',
      'TNDA-407B-8C8B-C657-3D72',
      'DESKTOP_SQLITE_MIGRATION'
    )
    const diffFeature = await deriveFeatureEntanglementToken(
      'VIP-A238-EE4B-0AEE-46EC',
      'TNDA-407B-8C8B-C657-3D72',
      'UNIVERSAL_BACKUP_EXPORT'
    )

    expect(token1).toBe(token2)
    expect(token1).not.toBe(diffFeature)
    expect(token1).toMatch(/^[a-f0-9]{64}$/)
  })
})
