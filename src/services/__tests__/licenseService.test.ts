import { beforeEach, describe, expect, it } from 'vitest'
import { licenseService } from '../licenseService'
import { db } from '../../data/db'
import { Preferences } from '@capacitor/preferences'

describe('LicenseService Cryptographic Verification', () => {
  beforeEach(async () => {
    await db.meta.clear()
    await Preferences.clear()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('generates a stable Machine ID in TNDA-XXXX-XXXX-XXXX-XXXX format', async () => {
    const mid1 = await licenseService.getMachineId()
    const mid2 = await licenseService.getMachineId()

    expect(mid1).toMatch(/^TNDA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(mid1).toBe(mid2)
  })

  it('generates a valid VIP key identical to Desktop keygen algorithm', async () => {
    const machineId = 'TNDA-8F42-99B1-204A-E7C1'
    const key = await licenseService.generateKeyForMachine(machineId, 'VIP_PRO')

    // From our earlier verification with node:crypto and tools/keygen.mjs:
    // TNDA-8F42-99B1-204A-E7C1 -> VIP-40BC-4AE6-2FE6-1938
    expect(key).toBe('VIP-40BC-4AE6-2FE6-1938')

    const isValid = await licenseService.verifyKey(key, machineId)
    expect(isValid).toBe(true)
  })

  it('generates a valid 24-Hour VIP Demo key matching Desktop keygen algorithm', async () => {
    const machineId = 'TNDA-8F42-99B1-204A-E7C1'
    const demoKey = await licenseService.generateKeyForMachine(machineId, 'VIP_DEMO')

    expect(demoKey.startsWith('DEMO-')).toBe(true)
    const isValid = await licenseService.verifyKey(demoKey, machineId)
    expect(isValid).toBe(true)
  })

  it('rejects keys created for different machines', async () => {
    const machineA = 'TNDA-AAAA-AAAA-AAAA-AAAA'
    const machineB = 'TNDA-BBBB-BBBB-BBBB-BBBB'

    const keyA = await licenseService.generateKeyForMachine(machineA, 'VIP_PRO')
    const isValidForB = await licenseService.verifyKey(keyA, machineB)

    expect(isValidForB).toBe(false)
  })

  it('rejects malformed or forged keys', async () => {
    const machineId = await licenseService.getMachineId()
    expect(await licenseService.verifyKey('VIP-0000-0000-0000-0000', machineId)).toBe(false)
    expect(await licenseService.verifyKey('RANDOM-GARBAGE-STRING', machineId)).toBe(false)
    expect(await licenseService.verifyKey('', machineId)).toBe(false)
  })

  it('activates VIP Pro successfully with a valid key and updates status', async () => {
    const machineId = await licenseService.getMachineId()
    const validKey = await licenseService.generateKeyForMachine(machineId, 'VIP_PRO')

    const result = await licenseService.activate(validKey, 'Test Store Mobile')
    expect(result.ok).toBe(true)
    expect(result.status.isVip).toBe(true)
    expect(result.status.tier).toBe('VIP_PRO')
    expect(result.status.customerName).toBe('Test Store Mobile')

    // Verify status persists on subsequent query
    const status = await licenseService.getStatus()
    expect(status.isVip).toBe(true)
    expect(status.tier).toBe('VIP_PRO')
  })

  it('detects tamper when stored payload hash does not match content', async () => {
    const machineId = await licenseService.getMachineId()
    const validKey = await licenseService.generateKeyForMachine(machineId, 'VIP_PRO')
    await licenseService.activate(validKey, 'Original Store')

    // Tamper with customer name directly in storage
    const vaults = await licenseService.readAllVaults()
    expect(vaults.length).toBeGreaterThan(0)
    const tampered = { ...vaults[0]!, customerName: 'HACKED STORE' }
    await licenseService.syncToAllVaults(tampered)

    // Should fall back to Community because tamper proof hash failed
    const status = await licenseService.getStatus()
    expect(status.isVip).toBe(false)
    expect(status.tier).toBe('COMMUNITY')
  })

  it('deactivates back to Community Edition cleanly', async () => {
    const machineId = await licenseService.getMachineId()
    const validKey = await licenseService.generateKeyForMachine(machineId, 'VIP_PRO')
    await licenseService.activate(validKey)

    const deact = await licenseService.deactivate()
    expect(deact.ok).toBe(true)
    expect(deact.status.isVip).toBe(false)
    expect(deact.status.tier).toBe('COMMUNITY')
  })
})
