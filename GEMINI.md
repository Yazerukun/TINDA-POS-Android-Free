# TINDA POS Free (Android) - Project Status

## Overview
Free, offline, sign-language-friendly Android POS terminal for Sari-Sari Stores built with React + Vite + Capacitor + Dexie (IndexedDB).

## Operating Rules
- Persona: **Fixer Agent**
- Mode: **FULL YOLO MODE** (Proactive, autonomous execution of commands, edits, refactoring, and fixes)
- Design Standard: [apple-design](file:///D:/CANTEEN-CREDIT-POS/.agents/skills/apple-design/SKILL.md)

## Latest Release (v1.0.31)
- **User Feedback Addressed:** "something went wrong pag pindot nako sa POS manifest react error #310".
- **Root Cause & Fix Applied:**
  1. **React Error #310 (Hooks Called Inside Loop):** In `src/pages/POS.tsx`, `const allowNeg = usePosCart((s) => s.allow_negative)` was erroneously called inside the `products.map(...)` iteration. On initial mount with `loading: true`, 0 hooks were called; once products loaded, 20+ hooks were executed, violating React's Rules of Hooks.
  2. **Resolution:** Moved `allowNeg = usePosCart((state) => state.allow_negative)` to the top level of `POS()`, and added `useCallback` to React imports in `POS.tsx`.
- **Test Results:** 17/17 test files passed, 105/105 unit tests green.
- **Release Assets (Published):**
  - **APK Download:** [TindaPOS-Free-1.0.31.apk](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.31/TindaPOS-Free-1.0.31.apk) (6.97 MB)
  - **Checksum:** `4592c0292fc21e0cc3effa5fc70d948139ea15ca9f327c033bff07ee123965ce`
  - **Release Notes:** [GitHub Release v1.0.31](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/tag/v1.0.31)

## Previous Release (v1.0.30)
- **User Feedback Addressed:**
  1. `pos (utang dili maka pili ug customer para ma charge ang item)`: Cashiers could not select or add a customer to charge store credit.
  2. `inventory, maka add ug item.. pro ug sa pos na naa ang item pro not sellable..`: Newly created products in inventory showed up as out of stock / not sellable.
  3. `barcode maka scan ug barcode para sa item ddto sa inventory..pro inig pos na, wla mo exist ang barcode nya`: Scanned barcodes saved on products were not recognized in POS.
  4. `dapat walay bisaya ha in english tanan`: All UI text, badges, tabs, and alerts must be 100% English.
- **Release Assets:**
  - **APK Download:** [TindaPOS-Free-1.0.30.apk](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.30/TindaPOS-Free-1.0.30.apk) (6.97 MB)
  - **Checksum:** `3a822af02d6b9c71875eb904d5d9ea0a646f3260dfb0ea51868c2fbefe6e8636`

## Previous Release (v1.0.29)
- **User Feedback Addressed:** "dili daw mo gana ang utang" (Utang / Credit checkout was failing / blocked).
- **Root Cause & Fixes Applied:**
  1. **POS Utang Checkout Flow:** Selecting Utang in `CheckoutModal` now automatically displays the selected customer, their current credit balance, new total, and an inline selector or "+ Add Customer" button.
  2. **Inline Customer Registration:** Added a Quick Add Customer form directly inside the customer picker.
  3. **Shift Balance Accuracy:** Cash payments for Utang in `src/data/people.ts` update active shift's register balance (`cash_in_c`).
  4. **Utang Management Hub:** Added filter tabs, "+ New Customer" button, correct badges, and fast payment amount chips.
- **Release Assets (Published):**
  - **APK Download:** [TindaPOS-Free-1.0.29.apk](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.29/TindaPOS-Free-1.0.29.apk) (6.65 MB)
  - **Checksum:** `5b568e10caae67620e2a72f1773fa77555566fc136ec590f31dcf4d4af09b06d`

## Previous Patch (v1.0.28)
- **Root Cause of v1.0.27 crash:** `tindaLogo` was added to `src/pages/FirstRun.tsx` but was not imported, throwing `ReferenceError: tindaLogo is not defined` whenever a clean APK was launched.
- **Fix Applied:** Imported `tindaLogo from '../assets/tinda-logo.png'` in `FirstRun.tsx`.
- **Regression Test Added:** `src/pages/__tests__/first-run.test.ts` to ensure `FirstRun` always renders without runtime asset errors.
- **Test Results:** 16/16 test files passed, 103/103 unit tests green.
- **Android Sync:** Synchronized to `android/app/src/main/assets/public/`.
- **Release Assets (Published):**
  - **APK Download:** [TindaPOS-Free-1.0.28.apk](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/download/v1.0.28/TindaPOS-Free-1.0.28.apk) (6.64 MB)
  - **Checksum:** `8cd4cd3d08c840b59802e21e852adfa8cbb77907d0ef82db2fbdfff292c7067a`
  - **Release Notes:** [GitHub Release v1.0.28](https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/tag/v1.0.28)

## Portable Android Build Environment (Zero Admin Rights on Drive D)
- **OpenJDK 21:** `D:\DevTools\jdk-21`
- **Android SDK:** `D:\DevTools\android-sdk` (cmdline-tools latest, platforms;android-36, build-tools;36.0.0, build-tools;35.0.0)
- **Release Keystore:** `D:\DevTools\tindapos-release.jks`
- **Keystore Config:** `D:\DevTools\keystore.properties` & `~/.config/tindapos/keystore.properties`

## Key Workflow Commands
```bash
npm run dev           # Run Vite dev server locally
npm test              # Run 103 unit tests with Vitest
npm run build         # Build production web bundle
npm run android:sync  # Build & sync to Android Capacitor assets
npm run android:open  # Open project in Android Studio
```

