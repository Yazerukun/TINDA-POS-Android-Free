# SYSTEM_MASTER.md — TINDA POS Android Architecture & Living Specification
> **STATUS**: LIVING MASTER DOCUMENT | **STRICT ARCHITECTURE BLUEPRINT**  
> **APPLICATION**: TINDA POS Android (Capacitor Native APK for Philippine MSMEs, Sari-Sari Stores & Minimarts)  
> **TARGET VERSION**: `v4.1.3` (Full Parity with Desktop Suite v4.1.3 & Universal Migration Engine)  
> **GITHUB REPOSITORY**: `Yazerukun/TINDA-POS-Android-Free`

---

## 1. System Identity & North Star
* **Core Purpose:** 100% offline-first point-of-sale, inventory management, customer credit (*utang*), shift registers, petty cash drawer tracking, desktop-to-mobile database migration, cryptographic VIP licensing, and Bluetooth thermal receipt printing for Android devices.
* **Target Audience:** Philippine micro, small, and medium enterprises (MSMEs), sari-sari stores, minimarts, bakeries, wholesalers, and market stalls.
* **Non-Negotiable Invariants:**
  1. **100% Zero-Cloud Dependency:** All critical POS functions run completely offline without an internet connection or remote server.
  2. **Zero Customer Data Loss:** All store records, transactions, products, stock levels, utang ledgers, and cash movement audits are strictly preserved across app updates, schema migrations, and backups.
  3. **Local Storage Integrity:** Data lives primarily in Dexie (IndexedDB) with versioned additive migrations, backed by a triple-vault redundant persistence model for critical configurations and licenses.
  4. **Universal Desktop Parity:** Full bidirectional interchange with TINDA POS Desktop (SQLite `.db` and `.tinda-backup`), allowing seamless migration between desktop Windows and Android mobile devices.
  5. **Sunlight & Fast-Touch Ergonomics:** High-contrast Clean White UI with minimum 48px touch targets for rapid, error-free tapping in bright, busy store environments.

---

## 2. Tech Stack & Environment Locks
| Layer | Technology | Locked Version | Architectural Role |
| :--- | :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript 7 | Latest | Reactive component architecture, typed states, and zero-overhead rendering |
| **Build Tool** | Vite 8 + PostCSS + Tailwind | v8.3.0 / v3.4.19 | Ultra-fast HMR, optimized tree-shaken mobile client bundle, Clean White styling |
| **Mobile Runtime** | Capacitor Android | v8.5.2 | Native Android hardware bridges (thermal printer, camera scanner, secure storage) |
| **Local Database** | Dexie.js (IndexedDB) | v4.4.6 | High-performance reactive offline storage with additive migrations |
| **Desktop Migration** | sql.js (WebAssembly SQLite) | v1.15.0 | In-browser/in-app SQLite file parser for direct Windows desktop DB migrations |
| **Cryptographic Security** | WebCrypto Subtle + HMAC-SHA256 | Native W3C | Offline tamper-resistant VIP license validation and machine ID generation |
| **Native Security** | Custom Capacitor Plugin | Java 17 / SDK 34 | Anti-tamper APK certificate pinning, signature verification, and root checks |
| **Testing** | Vitest | v5.0.1 | Automated unit and integration test verification gate (120/120 tests passed) |

---

## 3. Database Schema & Versioned Migrations (Dexie)

```
Dexie Database: 'tinda-pos-free'
```

### Version History:
* **v1:** Initial baseline schema (`products`, `sales`, `customers`, `credit`, `shifts`, `cashMovements`, `cashCounts`, etc.).
* **v2:** Added `supplier_id` index to `products` table for supplier-filtered catalog queries.
* **v3:** Added `priceReferences` table for TINDA BANTAY 172-commodity government reference catalog.
* **v4:** Added wholesale pricing indexes (`wholesale_price_c`, `wholesale_min_qty`) and `expiration_date` index for desktop parity and expiration alert filters.

### Entity Schemas:
* **`Product`**: `id`, `name`, `sku`, `barcode`, `category_id`, `supplier_id`, `purchase_cost_c`, `default_price_c`, `stock`, `base_unit`, `image_path`, `has_expiration`, `expiration_date`, `wholesale_price_c`, `wholesale_min_qty`, `status`, `created_at`, `updated_at`.
* **`Sale`**: `id`, `transaction_no`, `created_at`, `status`, `shift_id`, `subtotal_c`, `discount_c`, `tax_c`, `total_c`, `payment_method`, `cash_tendered_c`, `change_due_c`, `customer_id`, `items[]`.
* **`CreditLedgerEntry` (Utang)**: `id`, `customer_id`, `entry_type`, `amount_c`, `reference_type`, `reference_id`, `notes`, `created_at`.
* **`CashMovement` (Petty Cash)**: `id`, `shift_id`, `type ('CASH_IN' | 'CASH_OUT')`, `amount_c`, `reason`, `user_id`, `created_at`.
* **`Shift`**: `id`, `user_id`, `opened_at`, `closed_at`, `starting_cash_c`, `closing_cash_c`, `expected_cash_c`, `status ('OPEN' | 'CLOSED')`.

---

## 4. UI/UX Design System: Clean Modern White Theme

### Visual Tokens:
* **Canvas Background:** Pure White (`#ffffff`) with subtle Slate-50 canvas backing (`#f8fafc`).
* **Card Surfaces:** Crisp White (`#ffffff`) cards with distinct micro-borders (`#e2e8f0` / `border-slate-200`) and soft elevation shadow (`0 1px 3px rgba(0,0,0,0.06)`).
* **Typography:**
  - Primary Headings: Deep Slate-950 (`#020617`) for maximum sunlight legibility.
  - Body Text: Slate-700 (`#334155`).
  - Secondary/Labels: Slate-500 (`#64748b`).
* **Primary Brand Green:**
  - Base: Emerald-600 (`#059669`).
  - Active/Hover: Emerald-700 (`#047857`).
  - Soft Badge: Emerald-50 (`#ecfdf5`) with Emerald-800 text.
* **Semantic Accents:**
  - Utang / Warnings: Amber-600 (`#d97706`) with Amber-50 surface.
  - Overdue / Expired / Void: Rose-600 (`#e11d48`) with Rose-50 surface.
  - Wholesale / Electronic Pay: Indigo-600 / Sky-600 with soft tint.
  - VIP Gold / Pro Tier: Amber-500 with gradient badge styling.

### Mobile Ergonomics:
* Minimum touch target: `48px` × `48px` on all mobile action buttons.
* Fluid bottom sheets for quick cashier workflows (Petty Cash, Add Product, Quick Pay, Barcode Scanner).
* Haptic feedback and visual confirmation on barcode scans, cart additions, and settlements.

---

## 5. Architectural Systems & Feature Specifications

### 5.1 Universal Desktop Migration Engine (`desktopMigrationService.ts`)
* **Wasm SQLite Engine:** Embeds `sql.js` compiled to WebAssembly with fallback loading (`sql-wasm.wasm`).
* **Direct Desktop Import:** Reads Windows SQLite database files (`.db`, `.sqlite`, `.sqlite3`) and `.tinda-backup` files directly in-app.
* **Two Import Modes:**
  1. **Merge / Update Existing:** Matches by record ID and barcode, updating existing records and appending new products, categories, and customers without erasing existing sales history.
  2. **Complete Replace:** Safely archives current Dexie state and performs an atomic overwrite for fresh device switchovers.
* **Inspection Preview:** Pre-migration dialog reveals table record counts, estimated file size, and compatibility warnings before applying changes.

### 5.2 VIP Pro Cryptographic Licensing & Machine Fingerprinting (`licenseService.ts`)
* **Offline Activation:** Zero-server licensing based on keyed HMAC-SHA256 signature verification.
* **Machine ID:** Deterministic hardware fingerprint (`TNDA-XXXX-XXXX-XXXX-XXXX`) generated via native Android identifiers and hashed entropy.
* **License Tiers:**
  - `COMMUNITY_FREE`: Core POS, shift management, inventory, utang ledger, universal backup.
  - `VIP_PRO`: Lifetime unlocked VIP badge, advanced analytics, custom branding, desktop migration engine, priority receipt styling.
* **Triple-Vault Storage:** Replicated across `@capacitor/preferences`, Dexie `db.meta`, and browser `localStorage` to survive cache clearing.
* **In-App QR Engine:** One-tap QR code display for Machine ID and camera scanner integration for instant key activation.

### 5.3 Android Security & Integrity Service (`TindaSecurityPlugin.java`)
* **APK Signature Pinning:** Native inspection verifies release certificate SHA-256 fingerprint against the official build signature.
* **Anti-Repackaging:** Blocks unauthorized modding and secondary distribution.
* **Environment Integrity:** Detects rooted devices, unverified debug flags, and tampered package identifiers.

### 5.4 Petty Cash & Cash Drawer Movements
* **Trigger:** Available from POS Topbar Drawer Icon, Shift Modal, and Dashboard.
* **Cash In (Dugang Sukli):** Adds starting fund or change coins to the cash drawer with an audit trail note.
* **Cash Out (Kuha Pang-gasto):** Logs cash taken for store expenses, snacks, or emergency supplies.
* **Shift Impact:** Real-time formula:
  $$\text{Expected Cash} = \text{Starting Cash} + \text{Cash Sales} + \sum(\text{Cash In}) - \sum(\text{Cash Out})$$

### 5.5 Product Expiration Tracking & Alert Badges
* **Field:** Optional `expiration_date` (YYYY-MM-DD) on product record.
* **Badges:**
  - 🔴 **Expired:** Date is in the past (`today > expiration_date`).
  - 🟡 **Near Expiry:** Within 7 days (`today <= expiration_date <= today + 7d`).
* **Inventory Tab:** Dedicated "Expired / Expiring" filter tab for instant store audits.

### 5.6 Wholesale Tiering (Presyong Pakakyaw)
* **Configuration:** Each product can define `wholesale_price_c` and `wholesale_min_qty` (e.g., minimum 10 pcs).
* **POS Cart Behavior:** When `item.qty >= product.wholesale_min_qty`, unit price automatically drops to wholesale price with an unmistakable visual indicator badge: `[Wholesale Price Applied]`.

### 5.7 Dynamic GCash & Maya QR Code Modal
* **Checkout Flow:** Tapping GCash or Maya displays a high-contrast QR code with the exact order total automatically formatted.
* **Store Setting:** Owners can save their personalized GCash/Maya number or account name in Settings.
* **Phone-to-Phone Scanning:** Clean white modal background for instantaneous phone-to-phone camera scanning.

### 5.8 Itemized Utang Ledger & Shareable Slips
* **Ledger Expansion:** In `src/pages/Utang.tsx`, tapping any `CREDIT_SALE` entry expands the full list of products taken with quantities and prices.
* **Action Buttons:**
  - 🖨️ **Print Slip:** Sends an itemized credit charge slip to the connected Bluetooth 58mm/80mm printer.
  - 📲 **Share Reminder:** Formats a friendly Bisaya/Tagalog debt summary ready for SMS or Messenger sharing.

---

## 6. Verification Gates & Release Checklist

Before marking any task complete or publishing an APK release:
```bash
# 1. Automated Vitest Suite (All 18 test files / 120 tests must pass)
npm test

# 2. Production Web Renderer Build (Zero errors)
npm run build

# 3. Capacitor Native Android Sync
npx cap sync android

# 4. Release APK Build & Checksum Verification
cd android && ./gradlew assembleRelease
```

### Verification Gate Results for v4.1.3:
- [x] **Vitest Test Suite:** 18 test files passed (120 tests passed, 0 failed).
- [x] **Vite Production Bundle:** Clean build, 2,527 modules transformed, dist assets synced.
- [x] **Capacitor Android Sync:** Web assets synced to `android/app/src/main/assets/public`.
- [x] **Dexie Migration & Wasm SQLite:** Zero-data-loss additive schemas & WebAssembly SQLite import.
- [x] **Clean Modern White Theme:** Verified on all primary screens (POS, Dashboard, Inventory, Utang, Settings, Login).
- [x] **Branding & Assets:** Vector-sharp app icon and logo deployed to all Android mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
- [x] **Signed Release Artifact:** `TindaPOS-Free-4.1.3.apk` assembled and signed with persistent keystore.

---

## 7. Non-Negotiable Prohibitions
1. ❌ **NEVER** introduce external web API calls for core cashier, inventory, or migration actions.
2. ❌ **NEVER** drop or alter existing Dexie tables without an explicit incremented schema migration.
3. ❌ **NEVER** hardcode currency symbols; standard format is `₱` with two decimal places (`money()` helper).
4. ❌ **NEVER** degrade mobile touch targets below 48px on critical counter buttons.
5. ❌ **NEVER** overwrite uncommitted ledger records or discard customer transaction data.
