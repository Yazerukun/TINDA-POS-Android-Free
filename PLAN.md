# Android Free APK Plan

## Current progress

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
