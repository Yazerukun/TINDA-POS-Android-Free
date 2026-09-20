// Domain types shared between main, preload and renderer.
// Money is stored as INTEGER centavos (`_c`) — no floating-point money.
// Stock is stored as INTEGER base units.

export type RoleName = 'ADMIN' | 'MANAGER' | 'CASHIER'

export interface Role {
  id: number
  name: RoleName
  description: string | null
}

export interface User {
  id: number
  username: string
  full_name: string
  pin: string
  roles: RoleName[]
  is_active: boolean
  created_at: string
}

export interface SessionUser {
  id: number
  username: string
  full_name: string
  roles: RoleName[]
}

export interface Category {
  id: number
  name: string
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  address: string | null
  notes: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  created_at: string
  updated_at: string
}

export type ProductStatus = 'ACTIVE' | 'ARCHIVED'
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface ProductUnit {
  id: number
  product_id: number
  name: string
  conversion_to_base: number // how many base units this unit equals
  barcode: string | null
  selling_price_c: number
  is_default: boolean
}

export type ExpirationMode = 'NONE' | 'ITEM' | 'BATCH'
export interface StockBatch {
  id: number
  product_id: number
  label: string
  expiration_date: string | null
  quantity: number
  created_at: string
}
export interface ExpirationEntry {
  product_id: number
  product_name: string
  base_unit: string
  batch_id: number | null
  label: string
  expiration_date: string | null
  quantity: number
}

export interface Product {
  id: number
  category_id: number | null
  category_name: string | null
  name: string
  sku: string
  barcode: string | null
  description: string | null
  base_unit: string
  purchase_cost_c: number
  default_price_c: number
  stock: number
  low_stock_threshold: number
  supplier_id: number | null
  has_expiration: boolean
  expiration_mode?: ExpirationMode
  expiration_date?: string | null
  batches?: StockBatch[]
  sellable_stock?: number
  image_path: string | null
  status: ProductStatus
  notes: string | null
  units: ProductUnit[]
  stock_status: StockStatus
  created_at: string
  updated_at: string
}

export interface ProductInput {
  category_id: number | null
  name: string
  sku: string
  barcode: string | null
  description: string | null
  base_unit: string
  purchase_cost_c: number
  default_price_c: number
  low_stock_threshold?: number
  supplier_id: number | null
  has_expiration: boolean
  expiration_mode?: ExpirationMode
  expiration_date?: string | null
  notes: string | null
  units: { name: string; conversion_to_base: number; barcode: string | null; selling_price_c: number; is_default: boolean }[]
  initial_stock_base?: number
}

export type InventoryMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'REFUND'
  | 'RETURN'
  | 'DAMAGE'
  | 'EXPIRATION'
  | 'LOSS'
  | 'ADJUSTMENT'
  | 'INITIAL_STOCK'
  | 'WITHDRAWAL'

export type WithdrawalReason = 'TAKEN' | 'DAMAGED' | 'EXPIRED' | 'FORWARD'

export interface InventoryMovement {
  id: number
  product_id: number
  quantity_before: number
  quantity_change: number
  quantity_after: number
  unit: string
  movement_type: InventoryMovementType
  reason: string | null
  reference: string | null
  user_id: number
  created_at: string
}

export type StockReceivingSource = 'RESTOCK' | 'PURCHASE' | 'CSV OPENING STOCK' | 'INITIAL STOCK' | 'MANUAL RECEIVING'

export interface StockReceivingRecord {
  id: number
  product_id: number
  product_name: string
  quantity_received: number
  received_unit: string
  base_quantity: number
  base_unit: string
  previous_stock: number
  new_stock: number
  supplier_id: number | null
  supplier_name: string | null
  unit_cost_c: number | null
  total_cost_c: number | null
  reference: string | null
  notes: string | null
  received_by: string
  source: StockReceivingSource
  created_at: string
}

export interface Customer {
  id: number
  full_name: string
  nickname: string | null
  phone: string | null
  address: string | null
  notes: string | null
  credit_limit_c: number
  balance_c: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreditEntryType = 'CREDIT_SALE' | 'PAYMENT' | 'ADJUSTMENT' | 'REVERSAL' | 'REFUND'

export interface CreditLedgerEntry {
  id: number
  customer_id: number
  entry_type: CreditEntryType
  amount_c: number
  balance_before_c: number
  balance_after_c: number
  reference_type: string | null
  reference_id: number | null
  notes: string | null
  user_id: number
  created_at: string
}

export interface Sale {
  id: number
  transaction_no: string
  user_id: number
  cashier_name: string
  customer_id: number | null
  customer_name: string | null
  subtotal_c: number
  discount_c: number
  total_c: number
  status: 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'VOIDED' | 'HELD'
  shift_id: number | null
  notes: string | null
  created_at: string
  voided_at: string | null
  voided_by: number | null
  void_reason: string | null
  items: SaleItem[]
  payments: Payment[]
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number | null
  product_name: string
  unit_name: string
  qty: number
  qty_base: number
  unit_price_c: number
  subtotal_c: number
  cost_base_c: number
  refunded_qty_base: number
}

export interface Payment {
  id: number
  sale_id: number
  method: 'CASH' | 'GCASH' | 'MAYA' | 'UTANG'
  amount_c: number
  reference: string | null
  created_at: string
}

export interface HeldSale {
  id: number
  token: string
  items: HeldSaleItem[]
  subtotal_c: number
  discount_c: number
  total_c: number
  user_id: number
  created_at: string
}

export interface HeldSaleItem {
  product_id: number | null
  name: string
  unit_name: string
  qty: number
  qty_base: number
  unit_price_c: number
  subtotal_c: number
  cost_base_c: number
}

export interface CartItem {
  product_id: number | null
  name: string
  unit_name: string
  qty: number
  qty_base: number
  unit_price_c: number
  cost_base_c: number
  stock_base: number | null
  subtotal_c: number
}

export interface ExpenseCategory {
  id: number
  name: string
  is_system: boolean
  created_at: string
}

export interface Expense {
  id: number
  category_id: number
  category_name: string
  amount_c: number
  expense_date: string
  description: string | null
  reference: string | null
  user_id: number
  user_name: string
  notes: string | null
  created_at: string
}

export interface Purchase {
  id: number
  purchase_no: string
  supplier_id: number
  supplier_name: string
  purchase_date: string
  reference: string | null
  total_c: number
  notes: string | null
  user_id: number
  user_name: string
  created_at: string
  items: PurchaseItem[]
}

export interface PurchaseItem {
  id: number
  purchase_id: number
  product_id: number
  product_name: string
  unit_name: string
  qty: number
  qty_base: number
  unit_cost_c: number
  subtotal_c: number
}

export type ShiftStatus = 'OPENED' | 'CLOSED'

export interface Shift {
  id: number
  user_id: number
  shift_no: number | null
  cashier_name: string
  opened_at: string
  closed_at: string | null
  starting_cash_c: number
  cash_sales_c: number
  gcash_c: number
  maya_c: number
  utang_sold_c: number
  refund_cash_c: number
  cash_expenses_c: number
  cash_in_c: number
  cash_out_c: number
  expected_cash_c: number
  actual_cash_c: number | null
  difference_c: number | null
  closing_note: string | null
  status: ShiftStatus
  movement_count: number
}

export interface CashMovement {
  id: number
  shift_id: number
  type: 'CASH_IN' | 'CASH_OUT'
  amount_c: number
  reason: string | null
  user_id: number
  created_at: string
}

export interface Refund {
  id: number
  refund_no: string
  sale_id: number
  transaction_no: string
  user_id: number
  user_name: string
  reason: string
  total_c: number
  created_at: string
  items: RefundItem[]
}

export interface RefundItem {
  id: number
  refund_id: number
  sale_item_id: number
  product_id: number
  qty: number
  qty_base: number
  unit_name: string
  amount_c: number
}

export interface AuditLog {
  id: number
  action: string
  user_id: number | null
  user_name: string | null
  entity_type: string | null
  entity_id: number | null
  old_value: string | null
  new_value: string | null
  reason: string | null
  created_at: string
}

export interface StoreSettings {
  store_name: string
  owner_name: string
  address: string
  phone: string
  tin: string
  currency: string
  receipt_header: string
  receipt_title: string
  receipt_show_app_name: boolean
  receipt_footer: string
  logo_path: string | null
  default_low_stock: number
  default_tax_c: number
  allow_negative_inventory: boolean
  backup_location: string
  auto_backup_enabled: boolean
  auto_backup_daily: boolean
  auto_backup_on_exit: boolean
  receipt_printer: string
  auto_print_after_sale: boolean
  receipt_paper_width: '58mm' | '80mm'
  receipt_copies: number
  theme: string
  data_dir: string
}

export interface InventoryChangedEvent {
  reason: 'SALE' | 'REFUND' | 'VOID' | 'RESTOCK' | 'ADJUSTMENT' | 'CSV_IMPORT' | 'PURCHASE'
  product_ids: number[]
}

export interface ReadReport {
  shift_id: number
  shift_no: number | null
  report_type: 'X' | 'Z'
  report_at: string
  cashier_id: number
  cashier_name: string
  opened_at: string
  closed_at: string | null
  starting_cash_c: number
  gross_sales_c: number
  discount_c: number
  refunds_c: number
  cash_refunds_c?: number
  voids_c: number
  net_sales_c: number
  cash_c: number
  gcash_c: number
  maya_c: number
  utang_c: number
  expenses_c: number
  cash_in_c: number
  cash_out_c: number
  expected_cash_c: number
  transaction_count: number
  void_count: number
  split_count: number
}

export interface ZRead {
  id: number
  shift_id: number
  report_no: string
  snapshot: ReadReport
  finalized_by: number
  finalized_by_name: string
  finalized_at: string
}

export interface CashCountRecord {
  id: number
  shift_id: number
  user_id: number
  cashier_name: string
  business_date: string
  starting_cash_c: number
  expected_cash_c: number
  actual_cash_c: number
  difference_c: number
  status: 'BALANCED' | 'OVER' | 'SHORT'
  denominations: number[]
  notes: string | null
  created_at: string
}

export interface BackupInfo {
  filename: string
  path: string
  size: number
  created_at: string
}

export interface DashboardStats {
  today_sales_c: number
  today_profit_c: number
  today_transactions: number
  today_items_sold: number
  expenses_today_c: number
  expenses_7d_c: number
  outstanding_utang_c: number
  cash_sales_today_c: number
  gcash_today_c: number
  maya_today_c: number
  low_stock: Product[]
  out_of_stock: Product[]
  top_selling: { product_id: number; name: string; qty_sold: number; revenue_c: number }[]
  recent_sales: Sale[]
}

export interface SalesReportRow {
  sale_id: number
  transaction_no: string
  created_at: string
  cashier: string
  customer: string | null
  items: number
  subtotal_c: number
  discount_c: number
  total_c: number
  method: string
  status: string
}

export interface ReportSummary {
  sales_total_c: number
  profit_c: number
  items_sold: number
  transactions: number
  cost_c: number
  discount_c: number
  refunds_c: number
  expenses_c: number
}

export interface ExportResult {
  path: string
  rows: number
}

export type PriceSourceType = 'official' | 'market' | 'reference' | 'test'

export type PriceComparisonStatus =
  | 'WITHIN_RANGE'
  | 'BELOW_RANGE'
  | 'ABOVE_RANGE'
  | 'NO_REFERENCE'

export interface PriceReference {
  id: number
  product_id: number | null
  barcode: string | null
  product_name: string
  brand: string | null
  variant: string | null
  unit: string | null
  image_path: string | null
  image_url: string | null
  market_price_c: number | null
  min_price_c: number | null
  max_price_c: number | null
  currency: string
  source_name: string
  source_type: PriceSourceType
  source_url: string | null
  location: string | null
  effective_date: string | null
  retrieved_at: string
  last_synced_at: string
  created_at: string
  updated_at: string
}

export interface PriceReferenceInput {
  product_id?: number | null
  barcode?: string | null
  product_name: string
  brand?: string | null
  variant?: string | null
  unit?: string | null
  image_path?: string | null
  image_url?: string | null
  market_price_c?: number | null
  min_price_c?: number | null
  max_price_c?: number | null
  currency?: string
  source_name: string
  source_type?: PriceSourceType
  source_url?: string | null
  location?: string | null
  effective_date?: string | null
}

export interface PriceSyncResult {
  success: boolean
  synced_count: number
  rejected_count: number
  errors: string[]
  last_synced_at: string
  message: string
  is_offline?: boolean
}
