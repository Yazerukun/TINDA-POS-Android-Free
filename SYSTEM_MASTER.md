# SYSTEM_MASTER.md — TINDA POS Android Free Architecture & Living Specification
> **STATUS**: LIVING MASTER DOCUMENT | **STRICT ARCHITECTURE BLUEPRINT**  
> **APPLICATION**: TINDA POS Free Android (Capacitor APK for MSMEs & Sari-Sari Stores)  
> **TARGET VERSION**: `v1.0.43` (Full Parity with Desktop Suite v1.0.43)  
> **GITHUB REPOSITORY**: `Yazerukun/TINDA-POS-Android-Free`

---

## 1. System Identity & North Star
* **Core Purpose:** 100% offline-first point-of-sale, inventory management, customer credit (*utang*), shift register, cash drawer movements, and Bluetooth thermal receipt printing for Android devices.
* **Target Audience:** Philippine micro, small, and medium enterprises (MSMEs), sari-sari stores, minimarts, bakeries, and market stalls.
* **Non-Negotiable Invariants:**
  1. **100% Zero-Cloud Dependency:** All critical POS functions must run entirely without internet connection.
  2. **Zero Customer Data Loss:** Existing products, sales, customers, utang, categories, cash movements, and product photos must be strictly preserved across all app updates and schema migrations.
  3. **Local Storage Integrity:** Data lives strictly in Dexie (IndexedDB) on-device with versioned schema upgrades.
  4. **Atomic Transactions:** Sales, inventory deduction, cash count, and customer credit ledger updates must succeed or rollback together atomically.
  5. **Sunlight & Fast-Touch Ergonomics:** High-contrast clean white UI with minimum 48px touch targets for rapid, error-free tapping in busy store environments.

---

## 2. Tech Stack & Environment Locks
| Layer | Technology | Locked Version | Architectural Role |
| :--- | :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript 7 | Latest | Modern component architecture, hooks, zero unnecessary re-renders |
| **Build Tool** | Vite 8 + PostCSS | Latest | Fast HMR, optimized tree-shaken mobile client bundle |
| **Styling** | Tailwind CSS 3.4 | v3.4.19 | Modern Clean White design system, high-contrast palette |
| **Mobile Runtime** | Capacitor Android | v8.5.2 | Native Android hardware access (camera, filesystem, thermal printer) |
| **Client Database** | Dexie.js (IndexedDB) | v4.4.6 | Versioned reactive local storage with zero cloud dependencies |
| **State & Forms** | Zustand + React Hook Form | Latest | Predictable cart & modal state management |
| **Testing** | Vitest | v5.0.1 | Unit test verification gate before any release build |

---

## 3. Database Schema & Versioned Migrations (Dexie)

```
Dexie Database: 'tinda-pos-free'
```

### Version History:
* **v1:** Initial baseline schema (products, sales, customers, credit, shifts, cashMovements, cashCounts, etc.)
* **v2:** Added `supplier_id` index to `products` table for supplier-filtered catalog queries.
* **v3:** Added `priceReferences` table for TINDA BANTAY 172-commodity government reference catalog.
* **v4 (v1.0.43 Release):**
  - Added indexes to `products`: `wholesale_price_c`, `wholesale_min_qty`, `expiration_date`
  - Added `wholesale_price_c` (in centavos) and `wholesale_min_qty` (threshold qty) to Product schema.
  - Enhanced `cashMovements` querying for Petty Cash In/Out drawer tracking.

### Entity Schemas:
* **`Product`**: `id`, `name`, `sku`, `barcode`, `category_id`, `supplier_id`, `purchase_cost_c`, `default_price_c`, `stock`, `base_unit`, `image_path`, `has_expiration`, `expiration_date`, `wholesale_price_c`, `wholesale_min_qty`, `status`, `created_at`, `updated_at`.
* **`Sale`**: `id`, `transaction_no`, `created_at`, `status`, `shift_id`, `subtotal_c`, `discount_c`, `tax_c`, `total_c`, `payment_method`, `cash_tendered_c`, `change_due_c`, `customer_id`, `items[]`.
* **`CreditLedgerEntry` (Utang)**: `id`, `customer_id`, `entry_type`, `amount_c`, `reference_type`, `reference_id`, `notes`, `created_at`.
* **`CashMovement` (Petty Cash)**: `id`, `shift_id`, `type ('CASH_IN' | 'CASH_OUT')`, `amount_c`, `reason`, `user_id`, `created_at`.
* **`Shift`**: `id`, `user_id`, `opened_at`, `closed_at`, `starting_cash_c`, `closing_cash_c`, `expected_cash_c`, `status ('OPEN' | 'CLOSED')`.

---

## 4. UI/UX Design System: Clean Modern White Theme

### Visual Tokens:
* **Canvas Background:** Pure White (`#ffffff`) with gentle Slate-50 canvas backing (`#f8fafc`).
* **Card Surfaces:** Crisp White (`#ffffff`) cards with distinct micro-borders (`#e2e8f0` / `border-slate-200`) and soft card shadow (`0 1px 3px rgba(0,0,0,0.06)`).
* **Typography:**
  - Primary Headings: Deep Slate-900 (`#0f172a`) for maximum sunlight legibility.
  - Body Text: Slate-700 (`#334155`).
  - Secondary/Labels: Slate-500 (`#64748b`).
* **Primary Brand Green:**
  - Base: Emerald-600 (`#059669`).
  - Active/Hover: Emerald-700 (`#047857`).
  - Soft Badge: Emerald-50 (`#ecfdf5`) with Emerald-700 text.
* **Semantic Accents:**
  - Utang / Warnings: Amber-600 (`#d97706`) with Amber-50 surface.
  - Overdue / Expired / Void: Rose-600 (`#e11d48`) with Rose-50 surface.
  - Wholesale / Electronic Pay: Indigo-600 / Sky-600 with soft tint.

### Mobile Ergonomics:
* Minimum touch target: `48px` × `48px` on all mobile action buttons.
* Fluid bottom sheets for quick actions (Petty Cash, Add Product, Quick Pay).
* Smooth haptic and visual cues on cashier actions.

---

## 5. Feature Specifications (Desktop v1.0.43 Mobile Parity)

### 5.1 Petty Cash / Cash Movements (Drawer In & Out)
* **Trigger:** Available from POS Topbar Drawer Icon, Shift Modal, and Dashboard.
* **Cash In (Dugang Sukli):** Adds starting fund or change coins to the cash drawer with an audit trail note.
* **Cash Out (Kuha Pang-gasto):** Logs cash taken for store expenses, snacks, or emergency supplies.
* **Shift Impact:** Real-time formula:
  $$\text{Expected Cash} = \text{Starting Cash} + \text{Cash Sales} + \sum(\text{Cash In}) - \sum(\text{Cash Out})$$

### 5.2 Product Expiration Tracking & Alert Badges
* **Field:** Optional `expiration_date` (YYYY-MM-DD) on product record.
* **Badges:**
  - 🔴 **Expired:** Date is in the past (`today > expiration_date`).
  - 🟡 **Near Expiry:** Within 7 days (`today <= expiration_date <= today + 7d`).
* **Inventory Tab:** Dedicated "Expired / Expiring" filter tab for instant store audits.

### 5.3 Wholesale Tiering (Presyong Pakakyaw)
* **Configuration:** Each product can define `wholesale_price_c` and `wholesale_min_qty` (e.g., minimum 10 pcs).
* **POS Cart Behavior:** When `item.qty >= product.wholesale_min_qty`, unit price automatically drops to wholesale price with an unmistakable visual indicator badge: `[Wholesale Price Applied]`.

### 5.4 Dynamic GCash & Maya QR Code Modal
* **Checkout Flow:** Tapping GCash or Maya displays a high-contrast QR code with the exact order total automatically formatted.
* **Store Setting:** Owners can save their personalized GCash/Maya number or account name in Settings.
* **Phone-to-Phone Scanning:** Clean white modal background for instantaneous phone-to-phone camera scanning.

### 5.5 Itemized Utang Ledger & Shareable Slips
* **Ledger Expansion:** In `src/pages/Utang.tsx`, tapping any `CREDIT_SALE` entry expands the full list of products taken with quantities and prices.
* **Action Buttons:**
  - 🖨️ **Print Slip:** Sends an itemized credit charge slip to the connected Bluetooth 58mm/80mm printer.
  - 📲 **Share Reminder:** Formats a friendly Bisaya/Tagalog debt summary ready for SMS or Messenger sharing.

---

## 6. Verification Gates & Release Checklist

Before marking any task complete or publishing an APK release:
```bash
# 1. Automated Vitest Suite (All 15 test files / 102 tests must pass)
npm test

# 2. Production Web Renderer Build (Zero errors)
npm run build

# 3. Capacitor Native Android Sync
npx cap sync android

# 4. Release APK Build & Checksum Verification
cd android && ./gradlew assembleRelease
```

### Verification Gate Results for v1.0.43:
- [x] **Vitest Test Suite:** 15 test files passed (102 tests passed, 0 failed).
- [x] **Vite Production Bundle:** Clean build, 2,514 modules transformed, dist assets synced.
- [x] **Capacitor Android Sync:** Web assets synced to `android/app/src/main/assets/public`.
- [x] **Dexie Migration v4:** Additive indexes on `wholesale_price_c`, `wholesale_min_qty`, `expiration_date` — zero data loss.
- [x] **Clean Modern White Theme:** Verified on all primary screens (POS, Dashboard, Inventory, Utang, Login).
- [x] **Branding & Assets:** 512x512 vector-sharp app icon and logo deployed to all Android mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
- [x] **Release Artifact:** `TindaPOS-Free-1.0.43.apk` assembled and signed (5.9 MB).
  - **SHA-256:** `0d43807ca485fee9631c5a26719aadc8ceb9d0f374aea3eec5c169b6a9be632d`

---

## 7. Non-Negotiable Prohibitions
1. ❌ **NEVER** introduce external web API calls for core cashier or inventory actions.
2. ❌ **NEVER** drop or alter existing Dexie tables without an explicit incremented schema migration.
3. ❌ **NEVER** hardcode currency symbols; standard format is `₱` with two decimal places (`money()` helper).
4. ❌ **NEVER** degrade mobile touch targets below 44px.
5. ❌ **NEVER** overwrite user uncommitted ledger work or discard customer transaction data.
