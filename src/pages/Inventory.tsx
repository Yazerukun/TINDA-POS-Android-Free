import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Search, Plus, Pencil, Trash2, RefreshCw, Boxes, Tags, Upload, PackagePlus, Download, ClipboardList, X, PackageMinus, ArrowDownUp, AlertTriangle, CheckCircle2, Check, Sparkles, ScanLine, Camera, ImageIcon } from 'lucide-react'
import type { Product, Category, Supplier, StockReceivingRecord, StockReceivingSource, InventoryMovement, WithdrawalReason, PriceReference } from '@shared/types'
import { money } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import { toastSuccess, toastError } from '../stores/toast'
import { ProductExpiry, ExpirationList } from '../components/Expiration'
import { PriceGuideModal } from '../components/PriceGuideModal'
import { PriceReferenceCard } from '../components/ui/PriceReferenceCard'
import { ProductImage } from '../components/ui/ProductImage'
import { compressImageFile } from '../utils/image'
import {
  createProductInput,
  editProductForm,
  firstUnitError,
  newProductForm,
  updateProductInput,
  type ProductFormData,
  type ProductUnitInput
} from '../lib/productForm'

export function Inventory(): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState<number | 'ALL' | 'LOW' | 'OUT'>('ALL')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ProductFormData | null>(null)
  const [managingCategories, setManagingCategories] = useState(false)
  const [importing, setImporting] = useState(false)
  const [restocking, setRestocking] = useState<Product | true | null>(null)
  const [viewingReceiving, setViewingReceiving] = useState(false)
  const [withdrawing, setWithdrawing] = useState<Product | true | null>(null)
  const [viewingMovements, setViewingMovements] = useState(false)
  const [defaultThreshold, setDefaultThreshold] = useState(5)
  const [expirationOpen, setExpirationOpen] = useState(false)
  const [priceGuideOpen, setPriceGuideOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const loadState = useRef({ sequence: 0 })

  const load = useCallback(async (showLoading = true) => {
    const request = ++loadState.current.sequence
    if (showLoading) setLoading(true)
    try {
      const [p, c, settings] = await Promise.all([
        window.api.products.search('', { status: 'ACTIVE', limit: 1000 }),
        window.api.categories.list(),
        window.api.settings.get()
      ])
      if (request !== loadState.current.sequence) return
      setProducts(p.rows)
      setCategories(c)
      setDefaultThreshold(settings.default_low_stock)
    } catch (e) {
      if (request === loadState.current.sequence && showLoading) toastError('Failed to load inventory', String((e as Error)?.message || e))
    } finally {
      if (request === loadState.current.sequence) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const state = loadState.current
    void load()
    const refresh = () => { void load(false) }
    const unsubscribe = window.api.inventory.onChanged(refresh)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 15000)
    return () => { ++state.sequence; unsubscribe(); window.removeEventListener('focus', refresh); window.clearInterval(timer) }
  }, [load])

  const chooseFilter = (filter: number | 'ALL' | 'LOW' | 'OUT') => setCatFilter(filter)

  const filtered = useMemo(() => {
    let list = products
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode || '').toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
    if (catFilter === 'LOW') list = list.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold)
    else if (catFilter === 'OUT') list = list.filter((p) => p.stock <= 0)
    else if (catFilter !== 'ALL') {
      // Include products in this category OR any subcategory whose parent = catFilter
      const childIds = categories.filter((c) => c.parent_id === catFilter).map((c) => c.id)
      const matchIds = new Set([catFilter as number, ...childIds])
      list = list.filter((p) => p.category_id !== null && matchIds.has(p.category_id))
    }
    return list
  }, [products, q, catFilter, categories])

  const totalValue = products.reduce((s, p) => s + p.stock * p.purchase_cost_c, 0)
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).length
  const outCount = products.filter((p) => p.stock <= 0).length
  const alertCount = lowCount + outCount

  const archive = async (id: number) => {
    if (!confirm('Archive this product?')) return
    try {
      await window.api.products.archive(id)
      toastSuccess('Product archived')
      void load()
    } catch (e) { toastError('Archive failed', String((e as Error)?.message || e)) }
  }

  const saveProduct = async (f: ProductFormData) => {
    const unitError = firstUnitError(f.units)
    if (unitError) {
      toastError('Save failed', unitError)
      return
    }
    try {
      if (f.id) {
        await window.api.products.update(f.id, updateProductInput(f))
        toastSuccess('Product updated')
      } else {
        await window.api.products.create(createProductInput(f))
        toastSuccess('Product created')
      }
      setEditing(null)
      void load()
    } catch (e) { toastError('Save failed', String((e as Error)?.message || e)) }
  }

  return (
    <div className="px-4 pt-3 pb-6">
      {/* 1. COMPACT HEADER & METRICS CHIP */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Inventory</h1>
          <p className="text-xs text-slate-400">
            {products.length} products · <span className="font-semibold text-brand-400">{money(totalValue)}</span> stock value
          </p>
        </div>
        <button
          onClick={() => setCatFilter(alertCount ? 'LOW' : 'ALL')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
            alertCount
              ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {alertCount ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          <span>{alertCount ? `${alertCount} Alerts` : 'Healthy'}</span>
        </button>
      </div>

      {/* 2. SEARCH INPUT WITH CAMERA SCANNER */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product, barcode, or SKU…"
            className="input h-11 w-full pl-10 pr-9 text-sm bg-ink-900/90 rounded-xl"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="btn-primary flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold shadow-md active:scale-95 transition"
          title="Scan barcode to find product"
        >
          <ScanLine className="h-4 w-4" />
          <span className="hidden sm:inline">Scan</span>
        </button>
      </div>

      {/* 3. CATEGORY SCROLL PILLS */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {([
          { value: 'ALL' as const, label: 'All' },
          ...categories.map((category) => ({ value: category.id, label: category.name })),
          { value: 'LOW' as const, label: lowCount ? `Low (${lowCount})` : 'Low stock' },
          { value: 'OUT' as const, label: outCount ? `Out (${outCount})` : 'Out of stock' }
        ] as { value: number | 'ALL' | 'LOW' | 'OUT'; label: string }[]).map((item) => (
          <button
            key={String(item.value)}
            type="button"
            onClick={() => chooseFilter(item.value)}
            className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition ${
              catFilter === item.value
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                : 'border border-ink-line bg-ink-900/80 text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 4. SLEEK ACTION BAR: PRIMARY + HORIZONTAL ACTION PILLS */}
      <div className="mb-3.5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setEditing(newProductForm(defaultThreshold))}
          className="btn-primary shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm shadow-brand-500/25"
        >
          <Plus className="h-4 w-4" />
          <span>New Product</span>
        </button>

        <button
          onClick={() => setPriceGuideOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span>Price Guide</span>
        </button>

        <button
          onClick={() => setRestocking(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-ink-800 transition active:scale-95"
        >
          <PackagePlus className="h-3.5 w-3.5 text-brand-400" />
          <span>Restock</span>
        </button>

        <button
          onClick={() => setWithdrawing(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-ink-800 transition active:scale-95"
        >
          <PackageMinus className="h-3.5 w-3.5 text-amber-400" />
          <span>Withdraw</span>
        </button>

        <button
          onClick={() => setViewingReceiving(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-ink-800 transition active:scale-95"
        >
          <ClipboardList className="h-3.5 w-3.5 text-blue-400" />
          <span>Receive</span>
        </button>

        <button
          onClick={() => setExpirationOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-ink-800 transition active:scale-95"
        >
          <ClipboardList className="h-3.5 w-3.5 text-purple-400" />
          <span>Expiry</span>
        </button>

        <button
          onClick={() => setViewingMovements(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-ink-800 transition active:scale-95"
        >
          <ArrowDownUp className="h-3.5 w-3.5 text-slate-400" />
          <span>History</span>
        </button>

        <button
          onClick={() => setManagingCategories(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-ink-800 transition active:scale-95"
        >
          <Tags className="h-3.5 w-3.5 text-slate-400" />
          <span>Categories</span>
        </button>

        <button
          onClick={() => setImporting(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-ink-800 transition active:scale-95"
        >
          <Upload className="h-3.5 w-3.5 text-slate-400" />
          <span>Import CSV</span>
        </button>

        <button
          onClick={() => void load()}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-ink-line bg-ink-900 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-ink-800 transition active:scale-95"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No products" message="Add your first product to start tracking stock." action={<button onClick={() => setEditing(newProductForm(defaultThreshold))} className="btn-primary">New Product</button>} icon={<Boxes className="h-7 w-7" />} />
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProductImage src={p.image_path} alt={p.name} className="h-11 w-11 rounded-xl" fallbackIconClass="h-5 w-5 text-slate-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.sku} · {p.category_name ?? 'Uncategorized'}</p>
                  </div>
                </div>
                <StockBadge status={p.stock_status} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-lg font-black tabular-nums text-white">{p.stock} <span className="text-xs font-medium text-slate-500">{p.base_unit}</span></p>
                  <p className="text-xs text-slate-500">{money(p.purchase_cost_c)} cost</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRestocking(p)}
                    className="flex h-10 items-center gap-1 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3 text-xs font-bold text-brand-300 hover:bg-brand-500/20 active:scale-95 transition"
                    title="Restock this product"
                  >
                    <PackagePlus className="h-4 w-4" />
                    <span>Restock</span>
                  </button>
                  <button onClick={() => setEditing(editProductForm(p))} className="btn-ghost-2 flex h-10 w-10 items-center justify-center rounded-xl" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void archive(p.id)} className="btn-ghost-2 flex h-10 w-10 items-center justify-center rounded-xl text-danger-400" title="Archive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <ProductExpiry product={p} />
            </div>
          ))}
        </div>
        
        <div className="hidden md:block overflow-x-auto rounded-xl border border-ink-line bg-ink-900 shadow-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink-line bg-ink-850">
                <th className="p-4 text-xs font-semibold text-slate-400">Product</th>
                <th className="p-4 text-xs font-semibold text-slate-400">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-400">Stock</th>
                <th className="p-4 text-xs font-semibold text-slate-400">Cost</th>
                <th className="p-4 text-xs font-semibold text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-ink-800 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <ProductImage src={p.image_path} alt={p.name} className="h-10 w-10 rounded-xl" fallbackIconClass="h-5 w-5 text-slate-500" />
                      <div>
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.sku} · {p.category_name ?? 'Uncategorized'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><StockBadge status={p.stock_status} /></td>
                  <td className="p-4">
                    <p className="font-bold tabular-nums text-white">{p.stock} <span className="text-xs font-medium text-slate-500">{p.base_unit}</span></p>
                    <ProductExpiry product={p} />
                  </td>
                  <td className="p-4 tabular-nums text-slate-300">{money(p.purchase_cost_c)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setRestocking(p)} className="btn-ghost-2 flex h-9 w-9 items-center justify-center rounded-lg text-brand-400" title="Restock"><PackagePlus className="h-4 w-4" /></button>
                      <button onClick={() => setEditing(editProductForm(p))} className="btn-ghost-2 flex h-9 w-9 items-center justify-center rounded-lg" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => void archive(p.id)} className="btn-ghost-2 flex h-9 w-9 items-center justify-center rounded-lg text-danger-400" title="Archive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {editing && <ProductModal form={editing} categories={categories} onSave={saveProduct} onClose={() => setEditing(null)} />}
      {priceGuideOpen && <PriceGuideModal open={priceGuideOpen} onClose={() => setPriceGuideOpen(false)} products={products} onProductsChanged={() => void load()} />}
      {expirationOpen && <ExpirationList onClose={() => setExpirationOpen(false)} />}
      {managingCategories && <CategoryModal categories={categories} onChanged={load} onClose={() => setManagingCategories(false)} />}
      {importing && <CsvImportModal onDone={() => { setImporting(false); void load() }} onClose={() => setImporting(false)} />}
      {restocking && <RestockModal products={products} initial={restocking === true ? null : restocking} onDone={() => { setRestocking(null); void load() }} onClose={() => setRestocking(null)} />}
      {withdrawing && <WithdrawModal products={products} initial={withdrawing === true ? null : withdrawing} onDone={() => { setWithdrawing(null); void load() }} onClose={() => setWithdrawing(null)} />}
      {viewingMovements && <StockHistoryView products={products} onClose={() => setViewingMovements(false)} />}
      {viewingReceiving && <StockReceivingView onClose={() => setViewingReceiving(false)} />}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setQ(code)
          toastSuccess('Barcode scanned', code)
        }}
        title="Scan Barcode to Find Product"
      />
    </div>
  )
}

function StockReceivingView({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [rows, setRows] = useState<StockReceivingRecord[]>([])
  const [total, setTotal] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [source, setSource] = useState<StockReceivingSource | ''>('')
  const [detail, setDetail] = useState<StockReceivingRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.inventory.receiving({ search, from, to, supplier_id: supplierId ? Number(supplierId) : undefined, source, limit: 500 })
      setRows(result.rows)
      setTotal(result.total)
      setTotalCost(result.total_cost_c)
    } catch (e) { toastError('Stock Receiving failed', String((e as Error).message || e)) } finally { setLoading(false) }
  }, [search, from, to, supplierId, source])
  useEffect(() => { void window.api.suppliers.list({ status: 'ACTIVE' }).then(setSuppliers) }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => window.api.inventory.onChanged(() => { void load() }), [load])
  const clear = () => { setSearch(''); setFrom(''); setTo(''); setSupplierId(''); setSource('') }
  return <Modal open onClose={onClose} title="Stock Receiving" maxWidth="max-w-7xl" footer={<button className="btn-ghost" onClick={onClose}>Close</button>}>
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="card p-3"><p className="text-xs text-slate-500">Receiving Records</p><p className="text-2xl font-bold text-white">{total}</p></div>
        <div className="card p-3"><p className="text-xs text-slate-500">Total Receiving Cost</p><p className="text-2xl font-bold text-brand-400">{money(totalCost)}</p></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void load() }} className="grid gap-2 md:grid-cols-6">
        <input className="input md:col-span-2" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product" />
        <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Date from" />
        <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Date to" />
        <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">All suppliers</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="input" value={source} onChange={e => setSource(e.target.value as StockReceivingSource | '')}><option value="">All sources</option>{['RESTOCK','PURCHASE','CSV OPENING STOCK','INITIAL STOCK','MANUAL RECEIVING'].map(s => <option key={s} value={s}>{s}</option>)}</select>
        <div className="flex gap-2 md:col-span-6"><button className="btn-primary" type="submit">Apply Filters</button><button className="btn-ghost flex items-center gap-1" type="button" onClick={clear}><X className="h-4 w-4"/>Clear Filters</button></div>
      </form>
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-ink-line">
        <table className="table min-w-[1200px]"><thead><tr><th>Date / Time</th><th>Product</th><th>Received</th><th>Base Qty</th><th>Previous</th><th>New</th><th>Supplier</th><th>Unit Cost</th><th>Total Cost</th><th>Reference</th><th>Received By</th><th>Source</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} onClick={() => setDetail(row)} className="cursor-pointer hover:bg-ink-800"><td>{new Date(row.created_at.replace(' ', 'T')).toLocaleString()}</td><td className="font-medium text-white">{row.product_name}</td><td>{row.quantity_received} {row.received_unit}</td><td>{row.base_quantity} {row.base_unit}</td><td>{row.previous_stock}</td><td>{row.new_stock}</td><td>{row.supplier_name || '—'}</td><td>{row.unit_cost_c == null ? '—' : money(row.unit_cost_c)}</td><td>{row.total_cost_c == null ? '—' : money(row.total_cost_c)}</td><td>{row.reference || '—'}</td><td>{row.received_by || '—'}</td><td><span className="badge">{row.source}</span></td></tr>)}</tbody>
        </table>
        {!loading && rows.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No receiving records match these filters.</p>}
        {loading && <p className="py-10 text-center text-sm text-slate-500">Loading receiving records…</p>}
      </div>
    </div>
    {detail && <Modal open onClose={() => setDetail(null)} title="Receiving Details" maxWidth="max-w-lg" footer={<button className="btn-ghost" onClick={() => setDetail(null)}>Close</button>}><dl className="grid grid-cols-2 gap-3 text-sm">{[
      ['Product', detail.product_name], ['Date / Time', new Date(detail.created_at.replace(' ', 'T')).toLocaleString()], ['Quantity', `${detail.quantity_received} ${detail.received_unit}`], ['Base Quantity', `${detail.base_quantity} ${detail.base_unit}`], ['Previous Stock', detail.previous_stock], ['New Stock', detail.new_stock], ['Supplier', detail.supplier_name || '—'], ['Unit Cost', detail.unit_cost_c == null ? '—' : money(detail.unit_cost_c)], ['Total Cost', detail.total_cost_c == null ? '—' : money(detail.total_cost_c)], ['Reference', detail.reference || '—'], ['Received By', detail.received_by || '—'], ['Source', detail.source], ['Notes', detail.notes || '—']
    ].map(([label, value]) => <div key={String(label)} className={label === 'Notes' ? 'col-span-2' : ''}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-medium text-slate-200">{value}</dd></div>)}</dl></Modal>}
  </Modal>
}

function CsvImportModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }): React.JSX.Element {
  const [text, setText] = useState(''); const [preview, setPreview] = useState<Awaited<ReturnType<typeof window.api.products.previewCsv>> | null>(null); const [strategy, setStrategy] = useState<'SKIP'|'UPDATE'>('SKIP'); const [busy, setBusy] = useState(false)
  const choose = async (file?: File) => { if (!file) return; const content = await file.text(); setText(content); try { setPreview(await window.api.products.previewCsv(content)) } catch (e) { setPreview(null); toastError('CSV validation failed', String((e as Error).message || e)) } }
  const download = async () => { const content = await window.api.products.csvTemplate(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type:'text/csv'})); a.download='TINDA-POS-product-import-template.csv'; a.click(); URL.revokeObjectURL(a.href) }
  const run = async () => { setBusy(true); try { const r = await window.api.products.importCsv(text, strategy); toastSuccess('CSV import complete', `${r.created} created · ${r.updated} updated · ${r.skipped} skipped`); onDone() } catch(e) { toastError('Import failed', String((e as Error).message || e)) } finally { setBusy(false) } }
  return <Modal open onClose={onClose} title="Import Products from CSV" maxWidth="max-w-4xl" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!preview || preview.invalid>0 || busy} onClick={() => void run()}>Import Products</button></>}>
    <div className="space-y-4"><div className="flex gap-2"><button className="btn-ghost flex gap-2" onClick={() => void download()}><Download className="h-4 w-4"/>Download Template</button><label className="btn-primary cursor-pointer">Select CSV<input className="hidden" type="file" accept=".csv,text/csv" onChange={e => void choose(e.target.files?.[0])}/></label></div>
    {preview && <><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Total Rows',preview.total],['Valid Rows',preview.valid],['Invalid Rows',preview.invalid],['Duplicates',preview.duplicates]].map(([a,b])=><div className="card p-3" key={String(a)}><p className="text-xs text-slate-500">{a}</p><p className="text-xl font-bold">{b}</p></div>)}</div>
    {preview.duplicates>0 && <div><label className="label">Existing SKU/barcode</label><select className="input" value={strategy} onChange={e=>setStrategy(e.target.value as 'SKIP'|'UPDATE')}><option value="SKIP">Skip Existing</option><option value="UPDATE">Update Existing</option></select></div>}
    <div className="max-h-72 overflow-auto card"><table className="table"><thead><tr><th>Row</th><th>Product</th><th>Status</th><th>Reason</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.row_number}><td>{r.row_number}</td><td>{r.product_name || '—'}</td><td>{!r.valid?'Invalid':r.duplicate?'Duplicate':'Valid'}</td><td className="text-danger-400">{r.reasons.join('; ') || '—'}</td></tr>)}</tbody></table></div></>}
    {!preview && <p className="text-sm text-slate-400">Download the template, fill it in, then select the CSV to preview and validate every row before importing.</p>}</div>
  </Modal>
}

function RestockModal({ products, initial, onDone, onClose }: { products: Product[]; initial: Product | null; onDone: () => void; onClose: () => void }): React.JSX.Element {
  const [expiry, setExpiry] = useState(initial?.expiration_date ?? '')
  const [productId,setProductId]=useState(initial?.id ?? products[0]?.id ?? 0); const [quantity,setQuantity]=useState(''); const [unit,setUnit]=useState(initial?.units[0]?.name ?? initial?.base_unit ?? ''); const [supplierId,setSupplierId]=useState<number|null>(initial?.supplier_id ?? null); const [suppliers,setSuppliers]=useState<Supplier[]>([]); const [cost,setCost]=useState('0'); const [reference,setReference]=useState(''); const [notes,setNotes]=useState(''); const [busy,setBusy]=useState(false)
  useEffect(()=>{ void window.api.suppliers.list({status:'ACTIVE'}).then(setSuppliers) },[])
  const product=products.find(p=>p.id===productId); const selectedUnit=product?.units.find(u=>u.name===unit) ?? product?.units[0]; const qty=Number(quantity); const addBase=Number.isFinite(qty) ? qty*(selectedUnit?.conversion_to_base ?? 1):0; const newStock=(product?.stock??0)+addBase
  const save=async()=>{setBusy(true);try{await window.api.inventory.restock({product_id:productId,quantity:qty,unit_name:selectedUnit?.name??'',supplier_id:supplierId,cost_c:Math.round(Number(cost)*100),reference,notes,expiration_date:expiry||undefined});toastSuccess('Restock saved');onDone()}catch(e){toastError('Restock failed',String((e as Error).message||e))}finally{setBusy(false)}}
  return <Modal open onClose={onClose} title="Restock Inventory" maxWidth="max-w-lg" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !product || !(qty>0)} onClick={()=>void save()}>Save Restock</button></>}><div className="space-y-3">
    <div><label className="label">Product</label><select className="input w-full" value={productId} onChange={e=>{const id=Number(e.target.value);setProductId(id);const p=products.find(x=>x.id===id);setUnit(p?.units[0]?.name??p?.base_unit??'');setExpiry(p?.expiration_date??'')}}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    <div className="space-y-1"><label className="label">Expiration Date (Optional)</label><input aria-label="Expiration date" type="date" className="input w-full" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
    <div className="rounded-lg border border-ink-line p-3 text-sm">Current Stock: <b>{product?.stock ?? 0} {product?.base_unit}</b></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Quantity to Add</label><input className="input w-full" type="number" min="0.01" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)}/></div><div><label className="label">Unit</label><select className="input w-full" value={selectedUnit?.name??''} onChange={e=>setUnit(e.target.value)}>{product?.units.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div></div>
    <div className="rounded-lg bg-brand-500/10 p-3 text-sm">Conversion: {quantity||0} × {selectedUnit?.conversion_to_base??1} = {addBase||0} {product?.base_unit}<br/><b>New Stock: {newStock||product?.stock||0} {product?.base_unit}</b></div>
    <div><label className="label">Supplier (optional)</label><select className="input w-full" value={supplierId??''} onChange={e=>setSupplierId(e.target.value?Number(e.target.value):null)}><option value="">None</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="label">Unit Cost (₱)</label><input className="input w-full" type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></div><div><label className="label">Reference (optional)</label><input className="input w-full" value={reference} onChange={e=>setReference(e.target.value)}/></div><div><label className="label">Notes (optional)</label><textarea className="input w-full" value={notes} onChange={e=>setNotes(e.target.value)}/></div>
  </div></Modal>
}

function WithdrawModal({ products, initial, onDone, onClose }: { products: Product[]; initial: Product | null; onDone: () => void; onClose: () => void }): React.JSX.Element {
  const [productId, setProductId] = useState(initial?.id ?? products[0]?.id ?? 0)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(initial?.units[0]?.name ?? initial?.base_unit ?? '')
  const [reason, setReason] = useState<WithdrawalReason>('TAKEN')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const product = products.find((p) => p.id === productId)
  const selectedUnit = product?.units.find((u) => u.name === unit) ?? product?.units[0]
  const qty = Number(quantity)
  const subBase = Number.isFinite(qty) ? qty * (selectedUnit?.conversion_to_base ?? 1) : 0
  const newStock = (product?.stock ?? 0) - subBase
  const reasonLabels: Record<WithdrawalReason, string> = { TAKEN: 'Taken', DAMAGED: 'Damaged', EXPIRED: 'Expired', FORWARD: 'Forward' }
  const save = async () => {
    setBusy(true)
    try {
      await window.api.inventory.withdraw({ product_id: productId, quantity: qty, unit_name: selectedUnit?.name ?? '', reason, notes })
      toastSuccess('Withdrawal saved')
      onDone()
    } catch (e) { toastError('Withdrawal failed', String((e as Error).message || e)) } finally { setBusy(false) }
  }
  return <Modal open onClose={onClose} title="Withdraw Stock" maxWidth="max-w-lg" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !product || !(qty > 0) || newStock < 0} onClick={() => void save()}>Save Withdrawal</button></>}>
    <div className="space-y-3">
      <div><label className="label">Product</label><select className="input w-full" value={productId} onChange={(e) => { const id = Number(e.target.value); setProductId(id); const p = products.find((x) => x.id === id); setUnit(p?.units[0]?.name ?? p?.base_unit ?? '') }}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="rounded-lg border border-ink-line p-3 text-sm">Current Stock: <b>{product?.stock ?? 0} {product?.base_unit}</b></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Quantity to Withdraw</label><input className="input w-full" type="number" min="0.01" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        <div><label className="label">Unit</label><select className="input w-full" value={selectedUnit?.name ?? ''} onChange={(e) => setUnit(e.target.value)}>{product?.units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
      </div>
      <div><label className="label">Reason</label><select className="input w-full" value={reason} onChange={(e) => setReason(e.target.value as WithdrawalReason)}>{Object.entries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="rounded-lg bg-danger-500/10 p-3 text-sm">Conversion: {quantity || 0} × {selectedUnit?.conversion_to_base ?? 1} = {subBase || 0} {product?.base_unit} removed<br /><b>New Stock: {newStock < 0 ? 0 : newStock} {product?.base_unit}</b></div>
      {newStock < 0 && <p className="text-xs text-danger-400">Cannot withdraw more than current stock.</p>}
      <div><label className="label">Notes (optional)</label><textarea className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    </div>
  </Modal>
}

function StockHistoryView({ products, onClose }: { products: Product[]; onClose: () => void }): React.JSX.Element {
  const [rows, setRows] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'' | InventoryMovement['movement_type']>('')
  const [productId, setProductId] = useState<number | ''>('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.inventory.movements({ product_id: productId === '' ? undefined : productId, movement_type: type, limit: 300 })
      setRows(result.rows)
    } catch (e) { toastError('Stock History failed', String((e as Error).message || e)) } finally { setLoading(false) }
  }, [type, productId])
  useEffect(() => { void load() }, [load])
  useEffect(() => window.api.inventory.onChanged(() => { void load() }), [load])
  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? `#${id}`
  const typeLabels: Partial<Record<InventoryMovement['movement_type'], string>> = { PURCHASE: 'Purchase', SALE: 'Sale', REFUND: 'Refund', RETURN: 'Return', DAMAGE: 'Damage', EXPIRATION: 'Expiration', LOSS: 'Loss', ADJUSTMENT: 'Adjustment', INITIAL_STOCK: 'Initial Stock', WITHDRAWAL: 'Withdrawal' }
  return <Modal open onClose={onClose} title="Stock History" maxWidth="max-w-6xl" footer={<button className="btn-ghost" onClick={onClose}>Close</button>}>
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-2">
        <div><label className="label">Product</label><select className="input w-full" value={productId} onChange={(e) => setProductId(e.target.value === '' ? '' : Number(e.target.value))}><option value="">All products</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">Movement Type</label><select className="input w-full" value={type} onChange={(e) => setType(e.target.value as '' | InventoryMovement['movement_type'])}><option value="">All types</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-ink-line">
        <table className="table"><thead><tr><th>Date / Time</th><th>Product</th><th>Type</th><th>Change</th><th>After</th><th>Reason</th><th>By</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td>{new Date(row.created_at.replace(' ', 'T')).toLocaleString()}</td>
            <td className="font-medium text-white">{productName(row.product_id)}</td>
            <td><span className={`badge border ${row.movement_type === 'WITHDRAWAL' ? 'border-danger-500/30 bg-danger-500/10 text-danger-300' : 'border-slate-500/30 bg-slate-500/10 text-slate-300'}`}>{typeLabels[row.movement_type] ?? row.movement_type}</span></td>
            <td className={row.quantity_change < 0 ? 'text-danger-400' : 'text-emerald-400'}>{row.quantity_change > 0 ? '+' : ''}{row.quantity_change} {row.unit}</td>
            <td>{row.quantity_after} {row.unit}</td>
            <td className="max-w-[280px] truncate" title={row.reason ? `${row.reason}${row.reference ? ` — ${row.reference}` : ''}` : undefined}>{row.reason || '—'}{row.reference ? <span className="text-slate-500"> — {row.reference}</span> : null}</td>
            <td>{(row as InventoryMovement & { user_name?: string }).user_name || '—'}</td>
          </tr>)}</tbody></table>
        {!loading && rows.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No stock movements match these filters.</p>}
        {loading && <p className="py-10 text-center text-sm text-slate-500">Loading stock movements…</p>}
      </div>
    </div>
  </Modal>
}

function CategoryModal({ categories: initialCategories, onChanged, onClose }: { categories: Category[]; onChanged: () => Promise<void>; onClose: () => void }): React.JSX.Element {
  const [cats, setCats] = useState<Category[]>(initialCategories.map((c) => ({ ...c, parent_id: c.parent_id ?? null })))
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // Track which parent has its "Add Sub" form open (by parent id)
  const [addingSubFor, setAddingSubFor] = useState<number | null>(null)
  const [subName, setSubName] = useState('')

  const refreshLocal = async () => {
    try {
      const fresh = await window.api.categories.list()
      setCats(fresh.map((c) => ({ ...c, parent_id: c.parent_id ?? null })))
    } catch { /* ignore */ }
    await onChanged()
  }

  const addMain = async () => {
    if (!name.trim()) { toastError('Category name is required'); return }
    setBusy(true)
    try {
      await window.api.categories.create(name)
      setName('')
      await refreshLocal()
      toastSuccess('Category added')
    } catch (e) { toastError('Add category failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const addSub = async (parentId: number) => {
    if (!subName.trim()) { toastError('Subcategory name is required'); return }
    setBusy(true)
    try {
      await window.api.categories.createSub(subName, parentId)
      setSubName('')
      setAddingSubFor(null)
      await refreshLocal()
      toastSuccess('Subcategory added')
    } catch (e) { toastError('Add subcategory failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const remove = async (category: Category) => {
    const hasChildren = cats.some((c) => c.parent_id === category.id)
    if (hasChildren) {
      toastError('Cannot delete', `"${category.name}" has subcategories. Delete them first.`)
      return
    }
    if (!confirm(`Delete category "${category.name}"? Products in this category will become uncategorized.`)) return
    setBusy(true)
    try {
      await window.api.categories.remove(category.id)
      await refreshLocal()
      toastSuccess('Category deleted')
    } catch (e) { toastError('Delete category failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const mainCats = cats.filter((c) => !c.parent_id)
  const subCats = (parentId: number) => cats.filter((c) => c.parent_id === parentId)

  return (
    <Modal open onClose={onClose} title="Manage Categories" maxWidth="max-w-md" footer={<button onClick={onClose} className="btn-ghost">Close</button>}>
      {/* Add main category */}
      <form onSubmit={(e) => { e.preventDefault(); void addMain() }} className="mb-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New main category" className="input flex-1" autoFocus />
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
      </form>

      <div className="max-h-[22rem] space-y-1.5 overflow-y-auto">
        {mainCats.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No categories yet.</p>}
        {mainCats.map((parent) => {
          const subs = subCats(parent.id)
          return (
            <div key={parent.id} className="rounded-lg border border-ink-line overflow-hidden">
              {/* Parent row */}
              <div className="flex items-center justify-between bg-ink-800/60 px-3 py-2">
                <span className="text-sm font-bold text-slate-200">{parent.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setAddingSubFor(addingSubFor === parent.id ? null : parent.id); setSubName('') }}
                    disabled={busy}
                    className="btn-ghost-2 rounded-lg px-2 py-1 text-[11px] text-brand-400 hover:text-brand-300"
                    title="Add subcategory"
                  >
                    + Sub
                  </button>
                  <button onClick={() => void remove(parent)} disabled={busy} className="btn-ghost-2 rounded-lg p-1.5 text-danger-400" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Add Sub form inline */}
              {addingSubFor === parent.id && (
                <form
                  onSubmit={(e) => { e.preventDefault(); void addSub(parent.id) }}
                  className="flex items-center gap-2 border-t border-ink-line bg-ink-900 px-3 py-2"
                >
                  <span className="text-slate-500 shrink-0 text-xs">↳</span>
                  <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Subcategory name" className="input flex-1 py-1 text-sm" autoFocus />
                  <button type="submit" disabled={busy || !subName.trim()} className="btn-primary px-2 py-1 text-xs">Add</button>
                  <button type="button" onClick={() => setAddingSubFor(null)} className="btn-ghost px-2 py-1 text-xs">✕</button>
                </form>
              )}

              {/* Subcategory rows */}
              {subs.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between border-t border-ink-line/50 px-3 py-1.5 pl-6">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-500 text-xs shrink-0">↳</span>
                    <span className="text-xs text-slate-300 truncate">{sub.name}</span>
                  </div>
                  <button onClick={() => void remove(sub)} disabled={busy} className="btn-ghost-2 rounded-lg p-1.5 text-danger-400/70 hover:text-danger-400 shrink-0" title="Delete subcategory">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">Delete subcategories before deleting a main category. Products in deleted categories become uncategorized.</p>
    </Modal>
  )
}

function StockBadge({ status }: { status: string }): React.JSX.Element {
  const map: Record<string, string> = {
    IN_STOCK: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    LOW_STOCK: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    OUT_OF_STOCK: 'bg-red-500/10 text-red-400 border-red-500/30'
  }
  return <span className={`badge shrink-0 border ${map[status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>{status.replace(/_/g, ' ')}</span>
}

function ProductModal({ form, categories, onSave, onClose }: { form: ProductFormData; categories: Category[]; onSave: (f: ProductFormData) => Promise<void>; onClose: () => void }): React.JSX.Element {
  const [saving, setSaving] = useState(false)
  const [barcodeScanOpen, setBarcodeScanOpen] = useState(false)
  const [localCategories, setLocalCategories] = useState(categories)
  const [categoryName, setCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [priceRef, setPriceRef] = useState<PriceReference | null>(null)
  const [f, setF] = useState<ProductFormData>(form)
  const [rows, setRows] = useState<ProductUnitInput[]>(() => form.units.length > 0
    ? form.units
    : [{ name: form.base_unit, conversion_to_base: 1, barcode: null, selling_price_c: form.default_price_c, is_default: true }])
  const set = (patch: Partial<ProductFormData>) => setF((prev) => ({ ...prev, ...patch }))
  const setRow = (index: number, patch: Partial<ProductUnitInput>) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, ...patch } : r))
  }
  const addUnit = () => setRows((prev) => [...prev, { name: '', conversion_to_base: 1, barcode: null, selling_price_c: f.default_price_c, is_default: prev.length === 0 }])
  const removeUnit = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index))

  useEffect(() => {
    let active = true
    if (f.name.trim() || f.barcode?.trim()) {
      window.api.priceReferences
        .matchForProduct({ id: form.id ?? 0, name: f.name, barcode: f.barcode })
        .then((matched) => {
          if (active) setPriceRef(matched)
        })
        .catch(() => {
          if (active) setPriceRef(null)
        })
    } else {
      setPriceRef(null)
    }
    return () => {
      active = false
    }
  }, [f.name, f.barcode, form.id])

  const submit = async () => {
    if (saving) return
    setSaving(true)
    try { await onSave({ ...f, units: rows }) } finally { setSaving(false) }
  }
  const addCategory = async () => {
    setCategoryBusy(true)
    try {
      const category = await window.api.categories.create(categoryName)
      setLocalCategories((prev) => prev.some((c) => c.id === category.id) ? prev : [...prev, category])
      set({ category_id: category.id }); setCategoryName(''); setAddingCategory(false)
    } catch (e) { toastError('Add category failed', String((e as Error).message || e)) }
    finally { setCategoryBusy(false) }
  }
  const [imageBusy, setImageBusy] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageBusy(true)
    try {
      const dataUrl = await compressImageFile(file, 320, 320, 0.82)
      set({ image_path: dataUrl })
      toastSuccess('Photo attached')
    } catch (err) {
      toastError('Photo processing failed', String((err as Error)?.message || err))
    } finally {
      setImageBusy(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  const removeImage = () => {
    set({ image_path: null })
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  return (
    <Modal open onClose={onClose} title={form.id ? 'Edit Product' : 'New Product'} maxWidth="max-w-lg" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button disabled={saving || categoryBusy || imageBusy} onClick={() => void submit()} className="btn-primary">Save</button>
      </>
    }>
      <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="grid grid-cols-2 gap-3">
        {/* Product Photo Upload Section - Dual Mode (Camera & Gallery) */}
        <div className="col-span-2">
          <label className="label mb-1.5 block">Product Photo (Optional)</label>
          {/* Camera input with capture="environment" for immediate hardware camera launch */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleImagePick(e)}
          />
          {/* Gallery input without capture to trigger system gallery/photo picker */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleImagePick(e)}
          />

          {imageBusy ? (
            <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 text-xs font-semibold text-brand-400">
              <RefreshCw className="h-4 w-4 animate-spin text-brand-400" />
              <span>Compressing photo...</span>
            </div>
          ) : f.image_path ? (
            <div className="flex items-center gap-3 rounded-2xl border border-ink-line bg-ink-950/60 p-3 shadow-sm">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink-line bg-ink-900 shadow-inner">
                <img src={f.image_path} alt="Product preview" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200">Photo Attached</p>
                <p className="text-[11px] text-slate-400">Optimized thumbnail (~15-30KB)</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={imageBusy}
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-300 hover:bg-brand-500/20 active:scale-95 transition"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Camera</span>
                  </button>
                  <button
                    type="button"
                    disabled={imageBusy}
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink-line bg-ink-900/80 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-ink-800 active:scale-95 transition"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>Gallery</span>
                  </button>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-danger-400 hover:bg-danger-500/10 active:scale-95 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={imageBusy}
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-brand-500/30 bg-brand-500/5 p-3 text-center transition hover:border-brand-500/50 hover:bg-brand-500/10 active:scale-98"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-200">Take Photo</span>
                  <span className="block text-[10px] text-slate-400">Open camera</span>
                </div>
              </button>

              <button
                type="button"
                disabled={imageBusy}
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-ink-line bg-ink-950/40 p-3 text-center transition hover:border-slate-500/50 hover:bg-ink-900/50 active:scale-98"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-slate-300">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-200">Upload Photo</span>
                  <span className="block text-[10px] text-slate-400">Choose from gallery</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="col-span-2">
          <label className="label">Name *</label>
          <input required value={f.name} onChange={(e) => set({ name: e.target.value })} className="input w-full" />
        </div>
        <div>
          <label className="label">SKU</label>
          <input value={f.sku} onChange={(e) => set({ sku: e.target.value })} className="input w-full" />
        </div>
        <div>
          <label className="label">Barcode</label>
          <div className="relative">
            <input value={f.barcode} onChange={(e) => set({ barcode: e.target.value })} className="input w-full pr-8" placeholder="e.g. 480..." />
            <button
              type="button"
              onClick={() => setBarcodeScanOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-300"
              title="Scan barcode with camera"
            >
              <ScanLine className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="label">Category</label>
          <select value={String(f.category_id ?? '')} onChange={(e) => set({ category_id: e.target.value ? Number(e.target.value) : null })} className="input w-full">
            <option value="">Uncategorized</option>
            {localCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="btn-ghost mt-1 flex items-center gap-1" onClick={() => setAddingCategory((v) => !v)}><Plus className="h-4 w-4" /> Add Category</button>
          {addingCategory && <div className="mt-2 flex gap-1"><input aria-label="New category name" className="input min-w-0 flex-1" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /><button type="button" title="Save category" className="btn-ghost" disabled={categoryBusy || !categoryName.trim()} onClick={() => void addCategory()}><Check className="h-4 w-4" /></button></div>}
        </div>
        <div>
          <label className="label">Base Unit</label>
          <input value={f.base_unit} onChange={(e) => set({ base_unit: e.target.value })} className="input w-full" placeholder="pc, sachet, bottle" />
        </div>
        <div>
          <label className="label">Purchase Cost (₱)</label>
          <input type="number" min={0} value={f.purchase_cost_c / 100} onChange={(e) => set({ purchase_cost_c: Math.round(parseFloat(e.target.value || '0') * 100) })} className="input w-full" />
        </div>
        <div>
          <label className="label">Selling Price (₱)</label>
          <input type="number" min={0} value={f.default_price_c / 100} onChange={(e) => set({ default_price_c: Math.round(parseFloat(e.target.value || '0') * 100) })} className="input w-full" />
        </div>

        {/* Live Profit Margin & Markup Calculator */}
        {f.default_price_c > 0 && (
          <div className="col-span-2 rounded-xl border border-ink-line bg-ink-950/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">Live Profit Analysis</span>
              {f.purchase_cost_c > 0 && f.default_price_c < f.purchase_cost_c ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                  <AlertTriangle className="h-3 w-3" /> Loss Warning
                </span>
              ) : f.purchase_cost_c > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3" /> Profitable
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-ink-900/60">
                <p className="text-[10px] uppercase font-bold text-slate-500">Unit Profit</p>
                <p className={`text-sm font-black tabular-nums ${f.default_price_c >= f.purchase_cost_c ? 'text-emerald-400' : 'text-red-400'}`}>
                  {money(f.default_price_c - f.purchase_cost_c)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-ink-900/60">
                <p className="text-[10px] uppercase font-bold text-slate-500">Margin</p>
                <p className={`text-sm font-black tabular-nums ${f.default_price_c >= f.purchase_cost_c ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.default_price_c > 0
                    ? `${(((f.default_price_c - f.purchase_cost_c) / f.default_price_c) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-ink-900/60">
                <p className="text-[10px] uppercase font-bold text-slate-500">Markup</p>
                <p className="text-sm font-black tabular-nums text-brand-400">
                  {f.purchase_cost_c > 0
                    ? `${(((f.default_price_c - f.purchase_cost_c) / f.purchase_cost_c) * 100).toFixed(1)}%`
                    : '—'}
                </p>
              </div>
            </div>
            {f.purchase_cost_c > 0 && f.default_price_c < f.purchase_cost_c && (
              <p className="text-[11px] font-medium text-red-400 mt-2">
                Warning: Selling price is lower than purchase cost. You will lose {money(f.purchase_cost_c - f.default_price_c)} per unit sold.
              </p>
            )}
          </div>
        )}

        {priceRef && (
          <div className="col-span-2">
            <PriceReferenceCard
              reference={priceRef}
              currentPriceC={f.default_price_c}
              compact
              onAdoptPrice={(priceC) => {
                set({ default_price_c: priceC })
                setRows((prev) =>
                  prev.map((r, i) => (i === 0 ? { ...r, selling_price_c: priceC } : r))
                )
                toastSuccess('Market price adopted!')
              }}
            />
          </div>
        )}
        <div>
          <label className="label">Low Stock Alert</label>
          <input type="number" min={0} value={f.low_stock_threshold} onChange={(e) => set({ low_stock_threshold: parseInt(e.target.value || '0', 10) })} className="input w-full" />
        </div>
        {!form.id && (
          <div>
            <label className="label">Opening Stock (Sellable Units)</label>
            <input type="number" min={0} value={f.initial_stock_base} onChange={(e) => set({ initial_stock_base: parseInt(e.target.value || '0', 10) })} className="input w-full" placeholder="Available to sell" />
            <p className="text-[10px] text-slate-500 mt-1">Available immediately for sale in POS.</p>
          </div>
        )}
        <div className="col-span-2">
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="product-expiration">Expiration Date (Optional)</label>
            {f.expiration_date && (
              <button
                type="button"
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition"
                onClick={() => set({ expiration_date: null, expiration_mode: 'NONE' })}
              >
                Clear Date
              </button>
            )}
          </div>
          <input
            id="product-expiration"
            className="input w-full"
            type="date"
            value={f.expiration_date ?? ''}
            onChange={(e) => set({
              expiration_date: e.target.value || null,
              expiration_mode: e.target.value ? 'ITEM' : 'NONE'
            })}
          />
          <p className="mt-1 text-[11px] text-slate-500">Leave blank if the item does not expire. Undated stock is always sellable.</p>
        </div>
        <div className="col-span-2">
          <label className="label">Selling Units (Multi-unit / Retail)</label>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_76px_110px_28px] items-center gap-2">
                <input placeholder={i === 0 ? 'Unit name (e.g. piece)' : 'Selling unit name'} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} className="input w-full" />
                <input type="number" min={1} step={1} title={`1 ${f.base_unit || 'base unit'} × ${r.conversion_to_base}`} value={r.conversion_to_base} onChange={(e) => setRow(i, { conversion_to_base: Math.max(1, parseInt(e.target.value || '1', 10)) })} className="input w-full" />
                <input placeholder="Barcode" value={r.barcode ?? ''} onChange={(e) => setRow(i, { barcode: e.target.value ? e.target.value.trim() : null })} className="input w-full" />
                <button type="button" onClick={() => removeUnit(i)} disabled={rows.length <= 1} className="btn-ghost-2 rounded-lg p-2 text-danger-400 disabled:opacity-30" title="Remove selling unit"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {rows.some((r) => !r.name || !r.name.trim()) && <p className="text-xs text-danger-400">Please enter a name for the selling unit.</p>}
          </div>
          <button type="button" onClick={addUnit} className="btn-ghost mt-2 flex items-center gap-1"><Plus className="h-4 w-4" /> Add selling unit</button>
          <p className="mt-1 text-xs text-slate-500">Conversion is how many base units one selling unit equals. Example: 1 box = 24 sachets.</p>
        </div>
      </form>
      <BarcodeScannerModal
        open={barcodeScanOpen}
        onClose={() => setBarcodeScanOpen(false)}
        onScan={(code) => {
          const trimmed = code.trim()
          set({ barcode: trimmed })
          setRow(0, { barcode: trimmed })
          toastSuccess('Barcode captured', trimmed)
        }}
        title="Scan Barcode for Product"
      />
    </Modal>
  )
}
