# TINDA POS Android Free v1.0.19

Free, offline-first TINDA POS for Android phones and tablets — a separate APK
build of the free TINDA POS feature set. The Windows/Electron release remains
its own product and repository.

## Download

Grab the latest **`TindaPOS-Free-<version>.apk`** from the
[Releases page](../../releases) and open it on your phone. Installing over an
older version **keeps your app data** because every release is signed with the
same release key (`CN=TINDA POS Free`).

## In-app software update (fixed in v1.0.18)

The app updates itself, no Play Store and no manual downloading:

1. On launch the app checks the official GitHub releases feed (once per 24h).
2. When a newer stable version exists, an **"Update available"** card appears —
   or open **More → Settings → About → Software Update → Check for Updates**.
3. Tap **Download Update**: the APK is downloaded natively with a progress bar.
4. Android shows its install prompt; the update installs over the current app
   and keeps your data.

What was broken before v1.0.18 (and is fixed now):

- The WebView's Content-Security-Policy blocked every request, so the update
  check could never reach GitHub.
- The release was packaged from a stale web bundle, so the shipped app had no
  working update code at all.
- `install()` was a no-op: nothing ever reached Android's package installer.
- Releases packaged after a source edit could ship without rebuilding the web
  bundle.

v1.0.18 adds a native updater plugin (`TindaUpdaterPlugin`) that downloads the
official APK in the background and hands it to Android's installer, plus the
one-time `REQUEST_INSTALL_PACKAGES` grant flow that Android requires.

## Local data (new in v1.0.19)

Everything you set up now stays on the device — the app no longer returns to the
setup wizard on every launch. Storage is **Dexie/IndexedDB**, which is pure
JavaScript: no native plugin, no extra rebuild step, and it will carry over to
the planned iPad/PWA build.

Persisted: store settings, users and the signed-in session, categories,
products with their selling units, stock movements, receiving records, batches,
customers and utang ledgers, sales with items and payments, refunds, voids, held
carts, shifts, cash movements, cash counts, X/Z reads, expenses, suppliers, CSV
import/export and backups.

Verified on a physical device: finish setup, create a product, ring up a sale,
then force-stop and relaunch — store details, the product, the sale, the stock
movement and the audit trail are all still there.

## Status

- Screens, navigation, and the software-update pipeline are complete and tested
  on a physical device (v1.0.16 → v1.0.17 → v1.0.18 self-updates verified).
- Local device persistence is implemented and verified (v1.0.19).
- Known gaps: native printing is not available on Android yet (receipts are
  shown on screen instead) and supplier purchase history is not recorded yet.
- Cloud sync, multi-branch support, subscriptions, and premium gating are out of
  scope for the free build.

## Build from source

```bash
npm install
npm run build            # web bundle
npx cap sync android     # copy bundle into the native project
cd android && ./gradlew assembleRelease   # needs JDK 21 + Android SDK 36 and a release keystore
```

Release signing reads `~/.config/tindapos/keystore.properties` (override with
`TINDA_KEYSTORE_PROPS`); the keystore itself is never committed.

## Docs

- [`PLAN.md`](PLAN.md) — implementation phases and acceptance checks
- [`release-docs/USERMANUAL.md`](release-docs/USERMANUAL.md) — Bisaya/English user guide
