# TINDA POS Free — Android

**A free, sign-language-friendly point-of-sale (POS) terminal for Android.**

Built for small sari-sari stores, stalls, and micro-businesses in the Philippines.
No monthly fees. No account required. All sales data stays **on your device**.

## Features

- **Cash / GCash / Maya** payment split, one screen at a time
- **Sales register** with shift X-Reading / Z-Reading
- **Unpaid (utang) tracking** per customer
- **Expenses & cash-in / cash-out** recording
- **Built-in software updater** — taps GitHub to check for a newer signed APK and shows a download pop-up when one is available
- **Data preserved** on every update (same signing key)
- **Sign-language friendly** terminal UI

## Requirements

- Android 6.0 (API 23) or newer
- Internet access for the update check (sales still work offline)

## Install

Download the latest **`.apk`** from the [Releases page](../../releases).
Open the file on your phone and allow install from unknown sources (your own file —
no Play Store listing required).

> Updates install **over** your current version and **keep your sales data** —
> you never re-enter anything.

## Updating

The app checks GitHub itself. When a newer signed version is published, the app
shows a **"New version available"** pop-up with the download. Tap it, the new APK
downloads and installs over the current one — your data stays.

## Security

- APKs are **code-signed** (apksigner) and only published from **this official
  repository**. The in-app updater therefore only ever installs builds it can
  verify as official.
- Steady versions only — pre-release builds are never offered to users.

## Build from source

```bash
# requires Android SDK (API 36), JDK 21, and a release keystore
./gradlew bundleRelease  # or assembleRelease
```

## License

Free for personal and small-business use. See `LICENSE`.
