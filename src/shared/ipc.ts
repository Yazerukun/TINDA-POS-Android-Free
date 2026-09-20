import type {
  AuditLog,
  BackupInfo,
  CashMovement,
  Category,
  CreditLedgerEntry,
  CreditEntryType,
  Customer,
  Expense,
  ExpenseCategory,
  ExportResult,
  HeldSale,
  InventoryMovement,
  InventoryMovementType,
  PaymentInput,
  PriceComparisonStatus,
  PriceReference,
  PriceSourceType,
  PriceSyncResult,
  Product,
  ProductInput,
  Purchase,
  Refund,
  ReportSummary,
  SalesReportRow,
  SessionUser,
  Shift,
  StoreSettings,
  Supplier,
  User
} from './types'

export type PaymentInput = {
  method: 'CASH' | 'GCASH' | 'MAYA' | 'UTANG'
  amount_c: number
  reference?: string | null
}

export interface CartPayloadItem {
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

export interface CheckoutPayload {
  items: CartPayloadItem[]
  discount_c: number
  customer_id: number | null
  payments: PaymentInput[]
  notes?: string | null
}

export interface RefundPayload {
  sale_id: number
  reason: string
  items: { sale_item_id: number; product_id: number; qty_base: number; unit_name: string }[]
}

export interface VoidPayload {
  sale_id: number
  reason: string
}

export interface LoginResult {
  user: SessionUser
  firstRun: boolean
  shiftOpen: boolean
}

export interface PrintResult {
  ok: boolean
  code: 'PRINTED' | 'DISABLED' | 'NO_PRINTER' | 'UNAVAILABLE' | 'FAILED'
  message: string
}

export interface PrinterChoice { name: string; displayName: string; isDefault: boolean }

export interface DataLocationStatus {
  mode: 'SHARED' | 'PORTABLE'
  label: 'Shared AppData' | 'Portable Data'
  root: string
  databaseFile: string
  backupDir: string
  portableAvailable: boolean
  sharedRoot: string
  portableRoot: string | null
  sharedHasData: boolean
  portableHasData: boolean
}

/**
 * Canonical payload for the first-run setup wizard.
 * This is the SINGLE source of truth. Renderer, preload, IPC handler, and
 * the auth service all agree on this exact shape. Keep field names in sync
 * across every layer — a mismatch here previously caused the payload to be
 * misread at the IPC boundary.
 */
export interface CompleteSetupPayload {
  store: {
    store_name: string
    owner_name?: string
    address?: string
    phone?: string
  }
  admin: {
    username: string
    password: string
    pin: string
    full_name?: string
  }
  receipt: {
    header?: string
    footer?: string
  }
  data_dir: string
  load_demo: boolean
}

/**
 * Full typed IPC contract. Renderer never calls ipcRenderer directly;
 * it goes through the preload-exposed `window.api` (see @shared/ipc usage in preload).
 */
export interface TindaApi {
  app: {
    info: () => Promise<{ name: string; version: string; offline: boolean }>
    dataDir: () => Promise<string>
    databaseFile: () => Promise<string>
      openDataDir: () => Promise<void>
      checkIntegrity: () => Promise<{ ok: boolean; message: string }>
      isOnline: () => Promise<boolean>
  }

  update: {
    state: () => Promise<import('./update').UpdateStatusEvent>
    check: (manual: boolean) => Promise<import('./update').UpdateStatusEvent>
    download: () => Promise<import('./update').UpdateStatusEvent>
    install: () => Promise<import('./update').UpdateStatusEvent>
    dismiss: () => Promise<void>
    onEvent: (cb: (event: import('./update').UpdateStatusEvent) => void) => () => void
  }

  auth: {
    status: () => Promise<SessionUser | null>
    login: (username: string, password: string) => Promise<LoginResult>
    loginPin: (pin: string) => Promise<LoginResult>
    logout: () => Promise<void>
    changePassword: (current: string, next: string) => Promise<void>
    changePin: (pin: string) => Promise<void>
    adminResetPin: (userId: number, newPin: string) => Promise<void>
    setup: () => Promise<{ complete: boolean }>
    completeSetup: (payload: CompleteSetupPayload) => Promise<LoginResult>
  }

  users: {
    list: () => Promise<User[]>
    create: (input: {
      username: string
      password: string
      pin: string
      full_name: string
      roles: string[]
      is_active?: boolean
    }) => Promise<User>
    update: (
      id: number,
      input: Partial<{
        username: string
        password: string
        pin: string
        full_name: string
        roles: string[]
        is_active: boolean
      }>
    ) => Promise<User>
    roles: () => Promise<string[]>
  }

  settings: {
    get: () => Promise<StoreSettings>
    update: (patch: Partial<StoreSettings>) => Promise<StoreSettings>
  }

  categories: { list: () => Promise<Category[]>; create: (name: string) => Promise<Category>; remove: (id: number) => Promise<void> }

  products: {
    search: (q: string, opts?: { category_id?: number | null; status?: string; limit?: number; offset?: number }) => Promise<{
      rows: Product[]
      total: number
    }>
    get: (id: number) => Promise<Product>
    create: (input: ProductInput) => Promise<Product>
    update: (id: number, input: Partial<ProductInput>) => Promise<Product>
    archive: (id: number) => Promise<Product>
    restore: (id: number) => Promise<Product>
    count: (status?: string) => Promise<number>
    csvTemplate: () => Promise<string>
    previewCsv: (text: string) => Promise<{ rows: Array<Record<string, unknown> & { row_number: number; product_name: string; valid: boolean; duplicate: boolean; reasons: string[] }>; total: number; valid: number; invalid: number; duplicates: number }>
    importCsv: (text: string, strategy: 'SKIP' | 'UPDATE') => Promise<{ created: number; updated: number; skipped: number; product_ids: number[] }>
  }

  inventory: {
    expiration: () => Promise<import('./types').ExpirationEntry[]>
    batchDate: (id: number, date: string) => Promise<void>
    onChanged: (cb: (event: import('./types').InventoryChangedEvent) => void) => () => void
    movements: (opts: { product_id?: number; movement_type?: InventoryMovementType | ''; limit?: number; offset?: number; from?: string; to?: string }) => Promise<{
      rows: InventoryMovement[]
      total: number
    }>
    receiving: (opts?: { search?: string; from?: string; to?: string; supplier_id?: number; source?: import('./types').StockReceivingSource | ''; limit?: number; offset?: number }) => Promise<{
      rows: import('./types').StockReceivingRecord[]
      total: number
      total_cost_c: number
    }>
    receive: (input: { product_id: number; qty_base: number; unit_name: string; cost_c: number; reason?: string }) => Promise<InventoryMovement>
    adjust: (input: { product_id: number; qty_base: number; reason: string }) => Promise<InventoryMovement>
    movement: (type: InventoryMovementType, input: { product_id: number; qty_base: number; reason?: string; notes?: string }) => Promise<InventoryMovement>
    count: (input: { product_id: number; actual_base: number; notes?: string }) => Promise<InventoryMovement>
    restock: (input: { product_id: number; quantity: number; unit_name: string; supplier_id?: number | null; cost_c: number; reference?: string; notes?: string; expiration_date?: string; batch_label?: string }) => Promise<InventoryMovement>
    withdraw: (input: { product_id: number; quantity: number; unit_name: string; reason: import('./types').WithdrawalReason; notes?: string; batch_id?: number }) => Promise<InventoryMovement>
  }

  suppliers: {
    list: (opts?: { status?: string; search?: string }) => Promise<Supplier[]>
    create: (input: Partial<SupplierInput>) => Promise<Supplier>
    update: (id: number, input: Partial<SupplierInput>) => Promise<Supplier>
    products: (id: number) => Promise<Product[]>
    purchases: (id: number) => Promise<Purchase[]>
  }

  customers: {
    list: (opts?: { search?: string; status?: string; limit?: number; offset?: number }) => Promise<{ rows: Customer[]; total: number }>
    get: (id: number) => Promise<Customer>
    create: (input: CustomerInput) => Promise<Customer>
    update: (id: number, input: Partial<CustomerInput>) => Promise<Customer>
    ledger: (id: number, opts?: { limit?: number }) => Promise<CreditLedgerEntry[]>
    pay: (input: { customer_id: number; amount_c: number; method?: string; notes?: string }) => Promise<CreditLedgerEntry>
    adjust: (input: { customer_id: number; amount_c: number; notes: string; reason: string }) => Promise<CreditLedgerEntry>
    revoke: (input: { customer_id: number; amount_c: number; notes: string; reason: string }) => Promise<CreditLedgerEntry>
    approveOverlimit: (input: { customer_id: number; amount_c: number; notes: string; approved_by: string; reason: string }) => Promise<{ balance_c: number }>
  }

  pos: {
    searchProducts: (q: string) => Promise<Product[]>
    checkout: (payload: CheckoutPayload) => Promise<{ sale: import('./types').Sale; receipt: string[]; print: PrintResult }>
    hold: (payload: CheckoutPayload) => Promise<HeldSale>
    held: () => Promise<HeldSale[]>
    resumeHeld: (id: number) => Promise<HeldSale>
    deleteHeld: (id: number) => Promise<void>
    reprint: (saleId: number) => Promise<string[]>
  }

  printer: {
    list: () => Promise<PrinterChoice[]>
    save: (input: { name: string; autoPrint: boolean; paperWidth: '58mm' | '80mm'; copies: number }) => Promise<StoreSettings>
    testPrint: () => Promise<PrintResult>
    printReceipt: (saleId: number) => Promise<PrintResult>
    shareReceipt?: (lines: string[], title?: string) => Promise<void>
    openBluetoothSettings?: () => Promise<void>
  }

  transactions: {
    list: (opts: {
      from?: string
      to?: string
      status?: string
      method?: string
      cashier_id?: number
      search?: string
      limit?: number
      offset?: number
    }) => Promise<{ rows: import('./types').Sale[]; total: number }>
    get: (id: number) => Promise<import('./types').Sale>
    refund: (payload: RefundPayload) => Promise<Refund>
    void: (payload: VoidPayload) => Promise<import('./types').Sale>
  }

  expenses: {
    categories: () => Promise<ExpenseCategory[]>
    createCategory: (name: string) => Promise<ExpenseCategory>
    list: (opts: { from?: string; to?: string; category_id?: number; limit?: number; offset?: number }) => Promise<{ rows: Expense[]; total: number }>
    create: (input: ExpenseInput) => Promise<Expense>
    update: (id: number, input: Partial<ExpenseInput>) => Promise<Expense>
    remove: (id: number) => Promise<void>
  }

  shifts: {
    current: () => Promise<Shift | null>
    open: (starting_cash_c: number) => Promise<Shift>
    close: (input: { actual_cash_c: number; closing_note?: string }) => Promise<Shift>
    cashMovement: (input: { type: 'CASH_IN' | 'CASH_OUT'; amount_c: number; reason?: string }) => Promise<CashMovement>
    list: (opts?: { from?: string; to?: string; cashier_id?: number; limit?: number; offset?: number; status?: string }) => Promise<{
      rows: Shift[]
      total: number
    }>
    summary: (id: number) => Promise<Shift>
  }

  reports: {
    cashCount: (input: { shift_id?: number; quantities: number[]; notes?: string | null }) => Promise<import('./types').CashCountRecord>
    cashCounts: (opts?: { business_date?: string; user_id?: number; status?: string }) => Promise<import('./types').CashCountRecord[]>
    cashCountExpected: () => Promise<import('./types').ReadReport>
    cashCountPrint: (id: number) => Promise<PrintResult>
    sales: (opts: { from: string; to: string; groupBy?: 'DAILY' | 'WEEKLY' | 'MONTHLY' }) => Promise<{
      rows: SalesReportRow[]
      summary: ReportSummary
      chart: { label: string; total_c: number; profit_c: number }[]
    }>
    inventory: () => Promise<{
      rows: (Product & { inventory_value_c: number; total_cost_c: number })[]
      summary: { total_units: number; inventory_value_c: number; low_stock: number; out_of_stock: number }
    }>
    utang: () => Promise<{ rows: Customer[]; total_outstanding_c: number; payments_c: number }>
    cashier: (opts: { from?: string; to?: string; cashier_id?: number }) => Promise<{
      rows: import('./types').Sale[]
      summary: ReportSummary
    }>
    shifts: (opts?: { from?: string; to?: string }) => Promise<{ rows: Shift[]; summary: ReportSummary }>
    exportCsv: (kind: 'SALES' | 'INVENTORY' | 'EXPENSES' | 'UTANG' | 'TRANSACTIONS', opts?: { from?: string; to?: string }) => Promise<ExportResult>
    xRead: () => Promise<import('./types').ReadReport>
    printXRead: () => Promise<PrintResult & { report: import('./types').ReadReport }>
    finalizeZ: (input: { actual_cash_c: number; note?: string }) => Promise<import('./types').ZRead>
    zHistory: () => Promise<import('./types').ZRead[]>
    printZRead: (id: number) => Promise<PrintResult>
  }

  backup: {
    list: () => Promise<BackupInfo[]>
    create: (reason?: string) => Promise<BackupInfo>
    restore: (filename: string) => Promise<void>
    exportTinda: () => Promise<string>
    getPayload?: (filename: string) => Promise<string | null>
    importTinda: (text: string) => Promise<{ counts: Record<string, number>; unsupported: { unsupportedTables: { name: string; reason: string }[]; summary: string } }>
    openFolder: () => Promise<void>
    selectSyncFolder: () => Promise<string | null>
    openSyncFolder: () => Promise<void>
    dir: () => Promise<string>
    resetDatabase: (confirmation: string) => Promise<void>
    startNewStore: (confirmation: string) => Promise<void>
    locationStatus: () => Promise<DataLocationStatus>
    usePortableData: (choice: 'FRESH' | 'COPY') => Promise<void>
    useSharedAppData: () => Promise<void>
  }

  audit: {
    list: (opts?: { limit?: number; offset?: number; action?: string }) => Promise<{ rows: AuditLog[]; total: number }>
  }

  priceReferences: {
    search: (opts?: {
      query?: string
      sourceType?: PriceSourceType
      linkedOnly?: boolean
      unlinkedOnly?: boolean
      limit?: number
      offset?: number
    }) => Promise<{ rows: PriceReference[]; references: PriceReference[]; total: number }>
    get: (id: number) => Promise<PriceReference | undefined>
    getByProduct: (productId: number) => Promise<PriceReference | undefined>
    getByBarcode: (barcode: string) => Promise<PriceReference | undefined>
    matchForProduct: (product: { id: number; name: string; barcode?: string | null }) => Promise<PriceReference | null>
    link: (referenceId: number, productId: number) => Promise<PriceReference>
    unlink: (referenceId: number) => Promise<PriceReference>
    sync: (opts?: { force?: boolean; remoteUrl?: string }) => Promise<PriceSyncResult>
    status: () => Promise<{
      total: number
      last_synced_at: string | null
      is_stale: boolean
      sources: { source_name: string; count: number }[]
    }>
    compare: (retailPriceC: number, reference: PriceReference | null) => Promise<PriceComparisonStatus>
  }
}

export type SupplierInput = {
  name: string
  contact_person?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  status?: 'ACTIVE' | 'ARCHIVED'
}

export type CustomerInput = {
  full_name: string
  nickname?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  credit_limit_c: number
}

export type ExpenseInput = {
  category_id: number
  amount_c: number
  expense_date: string
  description?: string | null
  reference?: string | null
  notes?: string | null
}

export type { CreditEntryType }
