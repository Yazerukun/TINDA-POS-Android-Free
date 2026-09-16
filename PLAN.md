# Android Free APK Plan

## Current progress

- **v1.0.21 (2026-09-16):** Native printing landed! TINDA POS Android Free is now
  ready for production receipt printing:
  - Added native `TindaPrinterPlugin` supporting direct **Bluetooth Thermal Receipt
    Printers (58mm / 80mm ESC/POS)** via standard SPP RFCOMM (`UUID 00001101-0000-1000-8000-00805F9B34FB`)
    with reflection fallback for stubborn devices.
  - Added **Android System Print (`PrintManager`)** support for WiFi/Mopria/PDF printers.
  - Added native **Receipt Sharing** via Android Share sheet (`ACTION_SEND`) to easily
    send digital receipts over Messenger, SMS, or Viber.
  - Added **Bluetooth pairing shortcut** in Settings opening device Bluetooth settings.
  - Wired live checkout auto-print, POS completed modal retry/reprint/share,
    Transactions receipt print/share, Cash Count print, X-Read print, and Z-Read print.
  - Added Android Bluetooth permissions (`BLUETOOTH`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`).
  - Unit tests updated and all 80 vitest tests PASS.
- **v1.0.20 (2026-09-15):** Catchy flat cash-register + coin green launcher icon.
- **v1.0.19 (2026-09-15):** the local data layer landed — TINDA POS now keeps its
  data on the device instead of resetting to the setup wizard. Storage is
  **Dexie/IndexedDB** (pure JS, no native plugin or rebuild), with the whole
  `window.api.*` surface implemented against it: settings, users and sign-in
  session, categories, products and selling units, stock movements, receiving
  and batches, customers and utang, sales with items/payments, refunds, voids,
  held carts, shifts, cash movements, cash counts, X/Z reads, expenses,
  suppliers, CSV import/export, and backups. Schema is versioned (`db.ts`, v2).
  Verified on the device (RMX5070): setup → product → sale → hard restart, with
  store, product, sale, stock movement and audit rows all surviving.
- **Bugs found and fixed while testing v1.0.19:**
  - `db.<table>.add({ id: 0 })` inserted primary key `0` every time, so the first
    insert worked and every later one threw `Key already exists`. All inserts now
    go through `insertRow()` (which lets IndexedDB generate the key). This had
    silently broken audit rows, shifts, cash movements, cash counts, Z-reads,
    receiving, batches, held sales and user creation.
  - Report ranges are passed as a date key *and* as a `YYYY-MM-DD HH:mm:ss`
    datetime; `dayStartIso` appended a time to the already-timed value, producing
    an Invalid Date and `RangeError: Invalid time value`. Ranges now normalise
    through `toDateKey()`.
  - Reports, Expenses and the Cash Count defaulted to the **UTC** day
    (`toISOString().slice(0, 10)`), which is yesterday for every local time
    before 08:00 in UTC+8. They now use the shared `todayKey()`.
  - `products.supplier_id` was queried but not indexed, so the Supplier detail
    page threw `KeyPath supplier_id ... is not indexed`. Added a v2 schema index.
  - `shortDateTime()` was a stub that printed the raw ISO string.
  - Added regression tests for the date helpers (9 tests, 79 total).
- **v1.0.18 (2026-09-14):** in-app updater finished and verified on a physical
  device (v1.0.16 → v1.0.17 → v1.0.18 self-updates). Added
  `TindaUpdaterPlugin` (native download + package-installer intent),
  `REQUEST_INSTALL_PACKAGES`, a CSP `connect-src` allowance for `api.github.com`,
  launch-time update check (24h throttle), and an Android-specific update card.
  Root causes fixed: the WebView CSP blocked every network call, releases were
  packaged from a stale web bundle, and `install()` was a no-op.
- **Resolved in v1.0.19 & v1.0.21:** the data layer and native printing are fully
  implemented. Remaining known gaps: supplier purchase history is not recorded yet.
- Phase 1 audit started: Electron IPC, `better-sqlite3`, updater, filesystem, and printer boundaries are identified in the desktop source.
- Phase 2 shell created: Capacitor Android project, React/Vite entry point, and Android sync are working.
- Toolchain ready (drive D:, `toolchain/`): JDK 21 Temurin, Android SDK 36 (platform-tools, platforms;android-36, build-tools;36.0.0), Gradle 8.14.3. `source toolchain/env.sh` before any build. Capacitor 8 requires Java 21. Gradle/tmp pinned to D: (avoid /tmp EDQUOT).
- First native build PASSES: `android/app/build/outputs/apk/debug/app-debug.apk` (placeholder app, 4.2 MB).

## Product goal

Create a separate Android Free build that gives small stores the v1.0.12 POS workflow on a phone or tablet while preserving the existing Windows app and its software updater.

## Recommended technical direction

- **UI:** Reuse the existing React and TypeScript screens where practical.
- **Android shell:** Capacitor, producing a debug APK first and a signed release AAB/APK later.
- **Storage:** Android-compatible SQLite through a native Capacitor SQLite plugin.
- **Platform services:** Replace Electron IPC, filesystem paths, native printing, and desktop dialogs with Android adapters.
- **Shared logic:** Keep checkout, payment, Cash Count, Z-Read, and report calculations in shared TypeScript modules so desktop and Android behavior stay aligned.

## Free v1.0.12 scope

1. Login and local user/session handling.
2. Product search, categories, cart, quantity controls, and checkout.
3. Cash, GCash, Maya, split payment, and credit/utang recording.
4. Inventory updates, refunds, and voids.
5. Cash Count reminder and required save before Z-Read.
6. Corrected cash reconciliation: change is not counted as retained cash.
7. Basic sales, shift, and Z-Read reports.
8. Offline-first local database with export/import backup if practical for the first build.
9. Responsive layouts for phone portrait and tablet landscape.

## Android-specific work

- Camera barcode scanning.
- Android back button and keyboard behavior.
- Touch-friendly controls and larger tablet layouts.
- Share/export receipt or report files through Android.
- Optional Bluetooth or Wi-Fi printer adapter after the core APK is stable.

## Explicit non-goals for the first APK

- No cloud account or subscription system.
- No multi-device or multi-branch synchronization.
- No change to the Windows updater or GitHub release flow.
- No premium feature gating yet.

## Delivery phases

### Phase 1: Audit and shell

Inventory Electron-only dependencies, copy the app into an isolated Android project, add Capacitor, and make the existing UI boot on Android without changing the Windows source.

### Phase 2: Local data and checkout

Port database access and IPC calls to Android adapters. Verify products, cart operations, payments, stock updates, refunds, and voids offline.

### Phase 3: Shift controls and reports

Port Cash Count, the save-before-Z-Read guard, corrected cash calculations, and report screens. Add regression tests using the v1.0.12 feedback case.

### Phase 4: Device usability

Test phone and tablet layouts, keyboard/back behavior, camera scanning, rotation, app restart, and local backup/restore.

### Phase 5: Release candidate

Build a signed test APK, run the full test suite plus manual store workflows, document installation, then produce the Free APK release separately from Windows releases.

## Acceptance checks

- A store can complete a sale without internet.
- Cash Count must be saved before Z-Read can close a shift.
- A sale with tendered cash greater than the sale total reports retained cash correctly.
- Restarting the app does not lose saved products, sales, or shift data.
- Phone and tablet layouts have no clipped or overlapping controls.
- Windows source, updater, and published release assets remain unchanged.
