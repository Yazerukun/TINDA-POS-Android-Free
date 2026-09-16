<div align="center">

# 📱 TINDA POS Free for Android

**Free, 100% offline point-of-sale and inventory system for Philippine sari-sari stores, minimarts, and small businesses on Android phones and tablets.**

### v1.0.21 Stable

[![Android Version](https://img.shields.io/badge/Android-7.0%2B-green?logo=android&logoColor=white)](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/latest)
[![Version](https://img.shields.io/badge/Release-v1.0.21%20Stable-blue)](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/latest)
[![License](https://img.shields.io/badge/License-Free%20for%20Small%20Business-emerald)](#license)
[![Offline First](https://img.shields.io/badge/Storage-100%25%20Offline%20(Dexie)-orange)](#your-data-and-privacy)
[![Tests](https://img.shields.io/badge/Tests-80%2F80%20Vitest%20Pass-brightgreen)](#development)

[Download APK (v1.0.21)](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/latest) · [User Manual (Bisaya & English)](release-docs/USERMANUAL.md) · [Report an Issue](https://github.com/Yazerukun/TINDA-POS-Android-Free/issues)

---

</div>

## 🏪 Your Counter in Your Pocket

**TINDA POS Android Free** brings the complete, trusted TINDA POS retail workflow to Android mobile phones and tablets. Record everyday transactions, manage inventory, track customer credit (*utang*), connect direct Bluetooth receipt printers, and reconcile cash drawer shifts without needing an active internet connection.

Your store database stays 100% offline on your device — no cloud accounts, no subscription fees, no locked features, and no remote dependencies.

---

## ✨ What's New in v1.0.21

| Feature / Improvement | What it means at the counter |
| --- | --- |
| 🎨 **Professional Responsive UI/UX Redesign** | Completely rebuilt with a modern touch-first design system: 44px ergonomic tap targets, smooth page animations, universal button press feedback, and notch/safe-area support. |
| ⚡ **Fast Cash Denominations** | 1-tap cash shortcuts during checkout (**Exact, ₱20, ₱50, ₱100, ₱200, ₱500, ₱1000**) with an oversized change (*sukli*) readout. |
| 🛒 **Bottom Sheet Mobile Cart** | Mobile cart now slides smoothly from the bottom with drag-to-dismiss handle and animated badge counts. |
| 📱 **Fluid Tablet & Split-Screen View** | Full 60/40 split-screen POS catalog on tablets, 4-column KPI dashboards, and responsive card-to-table transitions. |
| 🧭 **Zero Navigation Dead Zones** | Navigation automatically adapts: bottom bar on mobile (<640px), compact icon rail on small tablets (640–767px), and full sidebar on desktop/tablets (≥768px). |
| 🖨️ **Native Bluetooth Thermal Printing** | Direct ESC/POS printing to portable Bluetooth thermal receipt printers (58mm & 80mm) via standard SPP RFCOMM. |
| 📄 **Android System Print & PDF** | Support for Wi-Fi and Mopria printers via Android PrintManager, plus Save as PDF. |
| 💬 **Instant Receipt Sharing** | Share digital receipts directly through the Android Share sheet to Messenger, SMS, Viber, or WhatsApp. |

---

## 📥 Download & Installation

Get the official release package from the [Releases page](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/latest):

| File | Size | Purpose |
| --- | --- | --- |
| [**`TindaPOS-Free-1.0.21.apk`**](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.21/TindaPOS-Free-1.0.21.apk) | ~3.4 MB | **Recommended**. Official signed release APK for Android phones and tablets. |

> [!NOTE]
> **Data Preservation on Upgrades:** Installing a newer APK over an existing version **preserves all your store records, sales, inventory, and settings**. All official releases are signed with the same persistent key (`CN=TINDA POS Free`).

### System Requirements
- **OS:** Android 7.0 (Nougat, API 24) or higher (tested up to Android 14+).
- **RAM:** Minimum 2 GB (runs smoothly even on budget devices).
- **Storage:** ~20 MB free space.
- **Hardware:** Optional Bluetooth for thermal receipt printers, optional camera for barcode scanning.

---

## 🔄 In-App Software Updates

TINDA POS Android Free updates itself directly from official GitHub releases — no Google Play Store required:

1. **Automatic Check:** Once every 24 hours on launch, the app checks for new stable updates. You can also check manually at **More → Settings → About → Software Update → Check for Updates**.
2. **One-Tap Download:** When an update is detected, tap **Download Update**. A native progress bar tracks download progress.
3. **Seamless Installation:** The app launches Android's native package installer with your data fully preserved.

---

## 🛠️ Everyday Tools & Features

| Module | Features Included |
| --- | --- |
| **POS & Checkout** | Fast product search, category chip pills, barcode scanner, quantity adjustments, Hold & Resume carts, and itemized discounts. |
| **Payments** | Cash with fast denomination buttons & change computation, GCash reference logging, Maya reference logging, Split Payments, and Customer Utang (Credit). |
| **Utang Tracking** | Customer ledger, balance tracking, credit limits, payment history, and partial settlements. |
| **Inventory & Expiry** | Low-stock indicators, product batch numbers, expiry alerts, receiving logs, CSV product import/export, and stock movements. |
| **Shift Reconciliation** | Cash Count denomination breakdown (bills & coins), required cash count before Z-Read, and drawer over/short computation. |
| **Shift Reports** | **X-Read** (interim shift report) and **Z-Read** (final shift closing) with full audit summary and reprint capabilities. |
| **Thermal Printing** | Auto-print on checkout, receipt reprints, 58mm/80mm thermal width support, and digital share sheet. |
| **Data Management** | 100% offline IndexedDB persistence, manual JSON database backups, and validated backup restore. |

---

## 🖨️ Thermal Printer Setup Guide

Printing receipts with your mobile phone or tablet takes less than a minute:

1. **Pair Your Printer:**
   - Turn on your 58mm or 80mm Bluetooth thermal printer.
   - Go to your Android device's Bluetooth settings (or open **TINDA POS → More → Settings → Printer → Pair Bluetooth**).
   - Pair with your printer (default PIN is usually `0000` or `1234`).
2. **Select Printer in App:**
   - In **Settings → Printer**, tap your paired thermal printer.
   - Choose your paper width (**58mm** or **80mm**).
   - Tap **Test Print** to verify alignment.
3. **Ready to Sell:**
   - Enable **Auto-print after sale** to automatically print customer receipts upon completing checkout.

---

## 💰 Cash Reconciliation Protocol: Cash Count First, Then Z-Read

To ensure exact cash drawer balance at the end of each shift:

```mermaid
flowchart LR
    A["Ring Up Sales & Transactions"] --> B["Open Reports > Cash Count"]
    B --> C["Count & Enter Bills / Coins"]
    C --> D["Save Cash Count"]
    D --> E["Open Reports > Z-Read"]
    E --> F["Finalize Shift & Print Report"]
```

1. Finish all pending sales and expenses for the shift.
2. Open **Reports → Cash Count** while your shift is open.
3. Count your cash drawer and input the quantity of each bill and coin denomination.
4. Tap **Save Cash Count**.
5. Open **Reports → Z-Read**, review the verified cash vs. expected cash figures, and close the shift.

---

## 🔒 Your Data and Privacy

- **100% Local Storage:** All store records, transactions, customer utang, and settings are stored locally in the device's persistent IndexedDB storage using [Dexie.js](https://dexie.com/).
- **Zero Telemetry / Zero Cloud:** No personal or commercial data is ever transmitted to external servers.
- **Backups:** Create regular backups under **More → Settings → Backup / Restore**. You can export your store database as a JSON file and store it on an SD card or cloud drive (Google Drive, OneDrive).

---

## 💻 Development & Building from Source

The Android Free app is built with **React 18**, **TypeScript**, **Tailwind CSS**, **Capacitor**, and **Dexie.js**.

### Prerequisites
- Node.js 20+
- JDK 21 (Temurin recommended)
- Android SDK 36 (Build Tools 36.0.0, Platform API 36)
- Gradle 8.14.3

### Build Steps

```bash
# 1. Install dependencies
npm install

# 2. Run test suite (80 unit & integration tests)
npm test

# 3. Build web bundle
npm run build

# 4. Sync web bundle into native Capacitor Android shell
npx cap sync android

# 5. Build signed release APK
source toolchain/env.sh
cd android && ./gradlew assembleRelease
```

The compiled release APK will be located at:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 📄 License

Proprietary. **Free to use for personal and small business purposes in the Philippines.** Redistribution, resale, or packaging into paid commercial services without explicit permission is strictly prohibited.
