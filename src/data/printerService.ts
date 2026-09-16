import { registerPlugin } from '@capacitor/core'
import type { PrinterChoice, PrintResult, Sale, StoreSettings } from '@shared/ipc'
import { receiptHtml } from '@shared/receiptHtml'
import { db } from './db'
import { buildReceiptLines } from './sales'

export interface TindaPrinterNative {
  listPrinters(): Promise<{
    printers: PrinterChoice[]
    bluetoothAvailable: boolean
    bluetoothEnabled: boolean
    hasBluetoothPermission: boolean
  }>
  requestBluetoothPermission(): Promise<{ granted: boolean }>
  printReceipt(options: {
    printerName: string
    lines: string[]
    rawHtml: string
    paperWidth: '58mm' | '80mm'
    copies: number
    title: string
  }): Promise<PrintResult>
  shareReceipt(options: { text: string; title: string }): Promise<{ ok: boolean }>
  openBluetoothSettings(): Promise<{ ok: boolean }>
}

const TindaPrinter = registerPlugin<TindaPrinterNative>('TindaPrinter')

export const SYSTEM_PRINT_NAME = 'SYSTEM_PRINT'

/**
 * Lists available printer choices on Android:
 * - Android System Print (WiFi, Mopria, Save as PDF)
 * - Paired Bluetooth thermal printers
 */
export async function listPrinters(): Promise<PrinterChoice[]> {
  try {
    const res = await TindaPrinter.listPrinters()
    if (res && Array.isArray(res.printers) && res.printers.length > 0) {
      return res.printers
    }
  } catch (err) {
    console.warn('TindaPrinter.listPrinters native call failed:', err)
  }

  return [
    {
      name: SYSTEM_PRINT_NAME,
      displayName: 'Android System Print (WiFi, Mopria, Save as PDF)',
      isDefault: true
    }
  ]
}

/**
 * Requests Bluetooth permission on Android 12+.
 */
export async function requestBluetoothPermission(): Promise<boolean> {
  try {
    const res = await TindaPrinter.requestBluetoothPermission()
    return !!res.granted
  } catch {
    return false
  }
}

/**
 * Opens Android device Bluetooth settings.
 */
export async function openBluetoothSettings(): Promise<void> {
  try {
    await TindaPrinter.openBluetoothSettings()
  } catch (err) {
    console.warn('Could not open Bluetooth settings:', err)
  }
}

/**
 * Shares the plain text receipt through Android's share sheet (e.g. Messenger, SMS, Viber).
 */
export async function shareReceipt(lines: string[], title = 'TINDA POS Receipt'): Promise<void> {
  const text = lines.join('\n')
  try {
    await TindaPrinter.shareReceipt({ text, title })
  } catch (err) {
    // Web fallback if running in browser
    if (navigator.share) {
      await navigator.share({ title, text }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(text).catch(() => undefined)
    }
  }
}

/**
 * Test print lines generator matching the desktop format.
 */
export function testPrintLines(settings: StoreSettings, printer: string, now = new Date()): string[] {
  return [
    settings.store_name || 'TINDA POS',
    'PRINTER TEST',
    '',
    `Printer: ${printer || 'Android System Print'}`,
    `Paper Width: ${settings.receipt_paper_width || '58mm'}`,
    `Copies: ${settings.receipt_copies || 1}`,
    `Date: ${now.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`,
    '--------------------------------',
    'Printer configuration successful!',
    'Ready for TINDA POS receipt printing.',
    '--------------------------------',
    'Thank you for using TINDA POS!'
  ]
}

/**
 * Executes a print job using the configured settings and provided lines.
 */
export async function printReceipt(
  lines: string[],
  title: string,
  settingsOverride?: StoreSettings
): Promise<PrintResult> {
  const settings: StoreSettings = settingsOverride ?? ((await db.settings.get(1)) as StoreSettings) ?? {
    store_name: 'TINDA POS',
    receipt_printer: SYSTEM_PRINT_NAME,
    auto_print_after_sale: false,
    receipt_paper_width: '58mm',
    receipt_copies: 1,
    currency: 'PHP'
  }

  const printerName = (settings.receipt_printer || '').trim() || SYSTEM_PRINT_NAME
  const paperWidth = settings.receipt_paper_width || '58mm'
  const copies = Math.max(1, Math.min(settings.receipt_copies || 1, 5))
  const currency = settings.currency || 'PHP'
  const html = receiptHtml(lines, paperWidth, currency)

  try {
    const result = await TindaPrinter.printReceipt({
      printerName,
      lines,
      rawHtml: html,
      paperWidth,
      copies,
      title
    })
    return result
  } catch (err) {
    // If running in pure web browser preview
    if (typeof window !== 'undefined' && typeof window.print === 'function' && printerName === SYSTEM_PRINT_NAME) {
      try {
        window.print()
        return { ok: true, code: 'PRINTED', message: 'Browser print invoked.' }
      } catch (browserErr) {
        return { ok: false, code: 'FAILED', message: String(browserErr) }
      }
    }
    return {
      ok: false,
      code: 'FAILED',
      message: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Prints the receipt for a completed sale.
 */
export async function printSaleReceipt(saleId: number, cachedLines?: string[]): Promise<PrintResult> {
  const sale = await db.sales.get(saleId)
  if (!sale) {
    return { ok: false, code: 'UNAVAILABLE', message: `Sale #${saleId} not found.` }
  }

  const settings = ((await db.settings.get(1)) as StoreSettings) ?? {}
  const lines = cachedLines ?? (await buildReceiptLines(sale))
  return printReceipt(lines, `Receipt ${sale.transaction_no}`, settings)
}

/**
 * Helper to auto-print after checkout if enabled in settings.
 */
export async function autoPrintAfterCheckout(
  settings: StoreSettings,
  sale: Sale,
  receiptLines: string[]
): Promise<PrintResult> {
  if (!settings.auto_print_after_sale) {
    return { ok: true, code: 'DISABLED', message: 'Automatic receipt printing is off.' }
  }
  return printReceipt(receiptLines, `Receipt ${sale.transaction_no}`, settings)
}

/**
 * Runs a test print using the configured printer in settings.
 */
export async function testPrint(settingsOverride?: StoreSettings): Promise<PrintResult> {
  const settings: StoreSettings = settingsOverride ?? ((await db.settings.get(1)) as StoreSettings) ?? {
    store_name: 'TINDA POS',
    receipt_printer: SYSTEM_PRINT_NAME,
    auto_print_after_sale: false,
    receipt_paper_width: '58mm',
    receipt_copies: 1,
    currency: 'PHP'
  }

  const lines = testPrintLines(settings, settings.receipt_printer)
  return printReceipt(lines, 'TINDA POS Printer Test', settings)
}
