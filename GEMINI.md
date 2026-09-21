# TINDA POS Free (Android) - Project Status

## Overview
Free, offline, sign-language-friendly Android POS terminal for Sari-Sari Stores built with React + Vite + Capacitor + Dexie (IndexedDB).

## Operating Rules
- Persona: **Fixer Agent**
- Mode: **FULL YOLO MODE** (Proactive, autonomous execution of commands, edits, refactoring, and fixes)
- Design Standard: [apple-design](file:///D:/CANTEEN-CREDIT-POS/.agents/skills/apple-design/SKILL.md)

## Recent Patch (v1.0.28)
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

