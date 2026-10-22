#!/usr/bin/env node
/**
 * ============================================================================
 * 💎 TINDA POS VIP PRO & QR LICENSE GENERATOR (KEYGEN CLI)
 * ============================================================================
 * Author: Ian (Dev Francis)
 * Maya Payment: 0991 225 5156 (₱500 One-Time VIP Pro Lifetime)
 * Facebook: https://www.facebook.com/Ukauru
 *
 * Capabilities:
 *  - Cryptographic HMAC-SHA256 Machine-Locked Key Generation
 *  - Terminal ASCII QR Code Rendering (Scan directly off computer screen)
 *  - High-Resolution PNG QR Image Export (Drag-and-drop into Facebook Messenger)
 * ============================================================================
 */

import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PEPPER_BYTES = Buffer.from([
  0x54, 0x49, 0x4e, 0x44, 0x41, 0x5f, 0x56, 0x49, 0x50, 0x5f,
  0x53, 0x45, 0x43, 0x55, 0x52, 0x45, 0x5f, 0x50, 0x45, 0x50,
  0x50, 0x45, 0x52, 0x5f, 0x32, 0x30, 0x32, 0x36, 0x5f, 0x46,
  0x52, 0x41, 0x4e, 0x43, 0x49, 0x53, 0x5f, 0x4d, 0x41, 0x59,
  0x41, 0x5f, 0x30, 0x39, 0x39, 0x31, 0x32, 0x32, 0x35, 0x35,
  0x31, 0x35, 0x36
])

const MASK_KEY = 0x5a

function getInternalSecret() {
  const buf = Buffer.alloc(PEPPER_BYTES.length)
  for (let i = 0; i < PEPPER_BYTES.length; i++) {
    buf[i] = PEPPER_BYTES[i] ^ (MASK_KEY + (i % 7))
  }
  return buf
}

function generateKeyForMachine(machineId, tier = 'VIP_PRO') {
  const normMachine = machineId.trim().toUpperCase()
  const secret = getInternalSecret()

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(`TINDA_AUTH_V1::${normMachine}::${tier}`)
  const fullSig = hmac.digest('hex').toUpperCase()

  const chunk1 = fullSig.substring(0, 4)
  const chunk2 = fullSig.substring(4, 8)
  const chunk3 = fullSig.substring(8, 12)

  const checksumHash = tier === 'VIP_DEMO'
    ? crypto.createHash('sha256').update(`${normMachine}:${chunk1}${chunk2}${chunk3}:${tier}`).digest('hex').toUpperCase()
    : crypto.createHash('sha256').update(`${normMachine}:${chunk1}${chunk2}${chunk3}`).digest('hex').toUpperCase()
  const checksum = checksumHash.substring(0, 4)

  const prefix = tier === 'VIP_DEMO' ? 'DEMO' : 'VIP'
  return `${prefix}-${chunk1}-${chunk2}-${chunk3}-${checksum}`
}

function verifyKey(key, machineId) {
  if (!key || !machineId) return false
  const cleanKey = key.trim().toUpperCase()
  if (cleanKey.startsWith('DEMO-')) {
    const expected = generateKeyForMachine(machineId, 'VIP_DEMO')
    return cleanKey === expected
  }
  const expected = generateKeyForMachine(machineId, 'VIP_PRO')
  return cleanKey === expected
}

function renderQr(key, machineId) {
  try {
    const ansiQr = execSync(`qrencode -t ANSIUTF8 "${key}"`, { encoding: 'utf8' })
    console.log('\n>>> 📱 SCAN LICENSE QR CODE DIRECTLY OFF SCREEN:')
    console.log(ansiQr)

    const licensesDir = path.resolve(process.cwd(), 'licenses')
    if (!fs.existsSync(licensesDir)) {
      fs.mkdirSync(licensesDir, { recursive: true })
    }

    const cleanMid = machineId.replace(/[^A-Z0-9]/gi, '_')
    const imgPath = path.join(licensesDir, `QR_${cleanMid}.png`)
    execSync(`qrencode -s 12 -m 2 -o "${imgPath}" "${key}"`)
    console.log(`📸 Official QR Code Image saved to: ${imgPath}`)
    return imgPath
  } catch (e) {
    return null
  }
}

function printUsage() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║     💎 TINDA POS VIP PRO — DEVELOPER KEY & QR GENERATOR (CLI)       ║
║     Author: Ian (Dev Francis) · Maya: 0991 225 5156                   ║
╚═══════════════════════════════════════════════════════════════════════╝

Usage:
  node tools/keygen.mjs generate --machine <MACHINE_ID> [--name <CUSTOMER_NAME>]
  node tools/keygen.mjs demo --machine <MACHINE_ID> [--name <CUSTOMER_NAME>]
  node tools/keygen.mjs verify --machine <MACHINE_ID> --key <VIP_KEY>
  node tools/keygen.mjs qr --key <VIP_KEY>

Examples:
  node tools/keygen.mjs generate --machine TNDA-407B-8C8B-C657-3D72 --name "Aling Nena Store"
  node tools/keygen.mjs demo --machine TNDA-407B-8C8B-C657-3D72
  node tools/keygen.mjs verify --machine TNDA-407B-8C8B-C657-3D72 --key VIP-A238-EE4B-0AEE-46EC
`)
}

const args = process.argv.slice(2)
const cmd = args[0]

if (!cmd || cmd === '--help' || cmd === '-h') {
  printUsage()
  process.exit(0)
}

function getArg(flag) {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1]
  }
  return null
}

if (cmd === 'generate') {
  const machine = getArg('--machine') || getArg('-m')
  const name = getArg('--name') || getArg('-n') || 'Valued Store Owner'

  if (!machine) {
    console.error('❌ Error: Missing --machine argument.')
    console.error('Example: node tools/keygen.mjs generate --machine TNDA-407B-8C8B-C657-3D72')
    process.exit(1)
  }

  const key = generateKeyForMachine(machine)
  const qrImagePath = renderQr(key, machine)

  console.log(`
========================================================================
💎 TINDA POS VIP PRO LIFETIME LICENSE GENERATED
========================================================================
Customer Name : ${name}
Machine ID    : ${machine.toUpperCase()}
License Tier  : VIP PRO LIFETIME (100% Offline, Hardware Locked)
Payment Verified: ₱500 Maya (0991 225 5156)

>>> VIP LICENSE KEY:
    ${key}
${qrImagePath ? `>>> QR IMAGE FILE : ${qrImagePath}\n` : ''}
------------------------------------------------------------------------
Copy-Paste Message to Customer on Facebook (https://www.facebook.com/Ukauru):
------------------------------------------------------------------------
Thank you for purchasing TINDA POS VIP Pro Lifetime, ${name}!
Here is your official, cryptographically signed VIP license:

🔑 VIP LICENSE KEY: ${key}

How to activate (2 Easy Ways):
OPTION 1 (Instant 1-Tap QR Scan):
1. Open TINDA POS on your tablet or phone -> Tap "More" -> "VIP Pro".
2. Tap "Scan License QR" and point your camera at this QR code image!
3. Activated instantly in 150ms!

OPTION 2 (Manual Paste):
1. Copy the key: ${key}
2. Open Settings -> "VIP License" -> Paste the key.
3. Click "Activate VIP Pro Lifetime".

Permanent Benefits Unlocked:
• Tablet Dual-Pane Counter Mode with Side-by-Side Live Ticket
• Desktop SQLite Database Importer & Universal Cloudless Backup
• Royal Bank-Grade Digital Certificate of Authenticity
• 100% Offline Operations — Zero Internet or Cloud Servers Required

Thank you for choosing TINDA POS! Have a prosperous store business!
========================================================================
`)
} else if (cmd === 'demo') {
  const machine = getArg('--machine') || getArg('-m')
  const name = getArg('--name') || getArg('-n') || 'Valued Store Owner'

  if (!machine) {
    console.error('❌ Error: Missing --machine argument.')
    console.error('Example: node tools/keygen.mjs demo --machine TNDA-407B-8C8B-C657-3D72')
    process.exit(1)
  }

  const key = generateKeyForMachine(machine, 'VIP_DEMO')
  const qrImagePath = renderQr(key, machine)

  console.log(`
========================================================================
⏱️ TINDA POS 24-HOUR VIP DEMO KEY GENERATED
========================================================================
Customer Name : ${name}
Machine ID    : ${machine.toUpperCase()}
License Tier  : 24-HOUR VIP DEMO
Duration      : 24 Hours from Moment of Activation

>>> 24-HOUR DEMO LICENSE KEY:
    ${key}
${qrImagePath ? `>>> QR IMAGE FILE : ${qrImagePath}\n` : ''}
------------------------------------------------------------------------
Copy-Paste Message to Customer on Facebook (https://www.facebook.com/Ukauru):
------------------------------------------------------------------------
Hello ${name}! Here is your 24-Hour VIP Demo Access for TINDA POS:

🔑 24-HOUR DEMO KEY: ${key}

How to activate:
1. Open TINDA POS -> Tap "More" -> "VIP Pro".
2. Tap "Scan License QR" to scan the attached QR code image (or paste the key).
3. Tap "Activate VIP Demo" to start your 24-hour full unlocked experience!

Enjoy testing! To keep all VIP features lifetime permanent after 24 hours, Maya ₱500 to 0991 225 5156.
========================================================================
`)
} else if (cmd === 'verify') {
  const machine = getArg('--machine') || getArg('-m')
  const key = getArg('--key') || getArg('-k')

  if (!machine || !key) {
    console.error('❌ Error: Both --machine and --key are required.')
    process.exit(1)
  }

  const ok = verifyKey(key, machine)
  if (ok) {
    console.log(`\n✅ VALID KEY! The key ${key.toUpperCase()} is mathematically authentic for machine ${machine.toUpperCase()}.\n`)
  } else {
    console.log(`\n❌ INVALID KEY! The key ${key.toUpperCase()} DOES NOT match machine ${machine.toUpperCase()}.\n`)
  }
} else if (cmd === 'qr') {
  const key = getArg('--key') || getArg('-k')
  if (!key) {
    console.error('❌ Error: Missing --key argument.')
    process.exit(1)
  }
  renderQr(key, 'MANUAL')
} else {
  printUsage()
  process.exit(1)
}
