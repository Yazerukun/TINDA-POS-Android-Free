import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Check,
  Banknote,
  Smartphone,
  Wallet,
  Pause,
  Loader2,
  ChevronDown,
  X,
  Share2,
  Printer,
  ScanLine,
  ArrowDownLeft,
  QrCode
} from 'lucide-react'
import type { Product, Customer, Sale, Category, HeldSale } from '@shared/types'
import { money } from '@shared/format'
import { Modal } from '../components/ui/Modal'
import { ReceiptPaper } from '../components/ReceiptPaper'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import { TouchNumpad } from '../components/TouchNumpad'
import { PettyCashModal } from '../components/PettyCashModal'
import { DynamicQRModal } from '../components/DynamicQRModal'
import {
  playScanBeep,
  playSuccessChime,
  playErrorTone,
  hapticTap,
  hapticScan,
  hapticSuccess,
  hapticError
} from '../lib/feedback'
import { toastSuccess, toastError } from '../stores/toast'
import type { PaymentInput } from '@shared/ipc'
import type { PrintResult } from '@shared/ipc'
import { useNav } from '../stores/nav'
import { cashInputFromCents } from '../lib/payment'
import { availableBase, cartHasStockConflict, maxQuantity, reservedBase } from '../lib/cartStock'
import { localDate } from '@shared/expiration'

const saleStock = (p: Product): number => p.expiration_mode === 'ITEM' && (!p.expiration_date || p.expiration_date < localDate()) ? 0
  : p.expiration_mode === 'BATCH' ? (p.batches ?? []).reduce((n, b) => n + (b.expiration_date && b.expiration_date >= localDate() ? b.quantity : 0), 0)
    : p.sellable_stock ?? p.stock

interface CartItem {
  product_id: number
  name: string
  unit_name: string
  qty: number
  unit_price_c: number
  regular_price_c: number
  wholesale_price_c?: number | null
  wholesale_min_qty?: number | null
  is_wholesale?: boolean
  cost_base_c: number
  stock_base: number
  conversion_to_base: number
}

function calculateItemPrice(
  regularPrice: number,
  wholesalePrice: number | null | undefined,
  wholesaleMinQty: number | null | undefined,
  qty: number
): { unit_price_c: number; is_wholesale: boolean } {
  if (
    wholesalePrice != null &&
    wholesalePrice > 0 &&
    wholesaleMinQty != null &&
    wholesaleMinQty > 0 &&
    qty >= wholesaleMinQty
  ) {
    return { unit_price_c: wholesalePrice, is_wholesale: true }
  }
  return { unit_price_c: regularPrice, is_wholesale: false }
}

interface CartState {
  items: CartItem[]
  customer_id: number | null
  discount_pesos: number
  add: (p: Product) => void
  setQty: (product_id: number, qty: number) => void
  remove: (product_id: number) => void
  clear: () => void
  setCustomer: (id: number | null) => void
  setDiscountPesos: (v: number) => void
  replace: (items: CartItem[], discount_pesos: number) => void
  syncStocks: (products: Product[]) => void
}

export const usePosCart = create<CartState>((set) => ({
  items: [],
  customer_id: null,
  discount_pesos: 0,
  add: (p) =>
    set((s) => {
      const stock = saleStock(p)
      const ex = s.items.find((i) => i.product_id === p.id)
      if (stock < 1) return s
      const regularPrice = p.default_price_c
      const wsPrice = p.wholesale_price_c ?? null
      const wsQty = p.wholesale_min_qty ?? null
      if (ex) {
        const nextQty = Math.min(ex.qty + 1, maxQuantity(stock, ex.conversion_to_base))
        const pricing = calculateItemPrice(ex.regular_price_c || regularPrice, wsPrice, wsQty, nextQty)
        return {
          items: s.items.map((i) =>
            i === ex
              ? {
                  ...i,
                  stock_base: stock,
                  qty: nextQty,
                  unit_price_c: pricing.unit_price_c,
                  is_wholesale: pricing.is_wholesale,
                  wholesale_price_c: wsPrice,
                  wholesale_min_qty: wsQty
                }
              : i
          )
        }
      }
      const initialPricing = calculateItemPrice(regularPrice, wsPrice, wsQty, 1)
      return {
        items: [
          ...s.items,
          {
            product_id: p.id,
            name: p.name,
            unit_name: p.base_unit,
            qty: 1,
            regular_price_c: regularPrice,
            unit_price_c: initialPricing.unit_price_c,
            wholesale_price_c: wsPrice,
            wholesale_min_qty: wsQty,
            is_wholesale: initialPricing.is_wholesale,
            cost_base_c: p.purchase_cost_c,
            stock_base: stock,
            conversion_to_base: 1
          }
        ]
      }
    }),
  setQty: (product_id, qty) =>
    set((s) => ({
      items: s.items
        .map((i) => {
          if (i.product_id !== product_id) return i
          const nextQty = Math.min(
            Math.max(0, Number.isFinite(qty) ? qty : 0),
            maxQuantity(i.stock_base, i.conversion_to_base)
          )
          const pricing = calculateItemPrice(
            i.regular_price_c || i.unit_price_c,
            i.wholesale_price_c,
            i.wholesale_min_qty,
            nextQty
          )
          return {
            ...i,
            qty: nextQty,
            unit_price_c: pricing.unit_price_c,
            is_wholesale: pricing.is_wholesale
          }
        })
        .filter((i) => i.qty > 0)
    })),
  remove: (product_id) => set((s) => ({ items: s.items.filter((i) => i.product_id !== product_id) })),
  clear: () => set({ items: [], customer_id: null, discount_pesos: 0 }),
  setCustomer: (id) => set({ customer_id: id }),
  setDiscountPesos: (v) => set({ discount_pesos: Math.max(0, v) }),
  replace: (items, discount_pesos) =>
    set({
      items: items.map((i) => {
        const reg = i.regular_price_c || i.unit_price_c
        const ws = calculateItemPrice(reg, i.wholesale_price_c, i.wholesale_min_qty, i.qty)
        return {
          ...i,
          regular_price_c: reg,
          unit_price_c: ws.unit_price_c,
          is_wholesale: ws.is_wholesale
        }
      }),
      customer_id: null,
      discount_pesos
    }),
  syncStocks: (products) =>
    set((s) => {
      const stocks = new Map(products.map((p) => [p.id, saleStock(p)]))
      return { items: s.items.map((item) => ({ ...item, stock_base: stocks.get(item.product_id) ?? item.stock_base })) }
    })
}))

export function POS(): React.JSX.Element {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [catFilter, setCatFilter] = useState<number | 'ALL'>('ALL')
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const categoryMenuRef = useRef<HTMLDivElement>(null)
  const cartItems = usePosCart((state) => state.items)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [pettyCashOpen, setPettyCashOpen] = useState(false)

  const handleBarcodeScan = async (code: string) => {
    try {
      const res = await window.api.products.search(code, { limit: 10, status: 'ACTIVE' })
      const exact = res.rows.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()) || res.rows[0]
      if (exact) {
        const stock = saleStock(exact)
        if (stock > 0) {
          usePosCart.getState().add(exact)
          playScanBeep()
          hapticScan()
          toastSuccess('Added to cart', `${exact.name} (${code})`)
        } else {
          playErrorTone()
          hapticError()
          toastError('Out of stock', `${exact.name} has 0 sellable stock.`)
        }
      } else {
        setQ(code)
        void search(code, catFilter === 'ALL' ? null : catFilter)
        playErrorTone()
        toastError('Barcode not found', `No product matching "${code}"`)
      }
    } catch (err) {
      toastError('Scan error', String(err))
    }
  }

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const ids = [...new Set([...products.map((p) => p.id), ...usePosCart.getState().items.map((i) => i.product_id)])]
      try {
        const updated = await Promise.all(ids.map((id) => window.api.products.get(id)))
        if (!alive) return
        usePosCart.getState().syncStocks(updated)
        const byId = new Map(updated.map((p) => [p.id, p]))
        setProducts((current) => current.map((p) => byId.get(p.id) ?? p))
      } catch { /* Checkout revalidates stock if the refresh is unavailable. */ }
    }
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(onFocus, 15000)
    return () => { alive = false; window.removeEventListener('focus', onFocus); window.clearInterval(timer) }
  }, [products])

  const selectedCategory = catFilter === 'ALL'
    ? 'All categories'
    : categories.find((category) => category.id === catFilter)?.name ?? 'All categories'

  const search = async (term: string, categoryId?: number | null) => {
    setLoading(true)
    setError(null)
    try {
      const opts: { status: string; limit: number; category_id?: number | null } = { status: 'ACTIVE', limit: 60 }
      if (categoryId != null) opts.category_id = categoryId
      const res = await window.api.products.search(term, opts)
      setProducts(res.rows)
      usePosCart.getState().syncStocks(res.rows)
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void search('')
    window.api.categories.list().then(setCategories).catch(() => {})
  }, [])
  useEffect(() => window.api.inventory.onChanged((event) => {
    void Promise.all(event.product_ids.map(id => window.api.products.get(id)))
      .then(changed => usePosCart.getState().syncStocks(changed))
      .catch(() => {})
    void search(q, catFilter === 'ALL' ? null : catFilter)
  }), [q, catFilter])

  useEffect(() => {
    if (!categoryMenuOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!categoryMenuRef.current?.contains(event.target as Node)) setCategoryMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoryMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [categoryMenuOpen])

  const chooseCategory = (categoryId: number | 'ALL') => {
    setCatFilter(categoryId)
    setCategoryMenuOpen(false)
    void search(q, categoryId === 'ALL' ? null : categoryId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); void search(e.target.value, catFilter === 'ALL' ? null : catFilter) }}
                placeholder="Search product by name or barcode…"
                className="input h-12 w-full pl-9 pr-9 !text-base"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(''); void search('', catFilter === 'ALL' ? null : catFilter) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="btn-primary flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-3.5 shadow-sm active:scale-95 transition"
              title="Scan barcode with camera"
            >
              <ScanLine className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-bold">Scan</span>
            </button>
            <button
              type="button"
              onClick={() => setPettyCashOpen(true)}
              className="btn-secondary flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-95 transition"
              title="Petty Cash (Cash In / Out)"
            >
              <ArrowDownLeft className="h-5 w-5 text-purple-600" />
              <span className="hidden sm:inline text-xs font-bold">Drawer</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => chooseCategory('ALL')}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${catFilter === 'ALL' ? 'bg-brand-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => chooseCategory(c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${catFilter === c.id ? 'bg-brand-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        <div className="grid min-h-0 flex-1 auto-rows-[170px] grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] content-start gap-3 overflow-y-auto pb-24 md:pb-2">
          {loading && Array.from({ length: 12 }).map((_, i) => <div key={i} className="card h-28 animate-pulse bg-white border border-slate-200" />)}
          {!loading && products.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-slate-500">No products found.</div>
          )}
          {!loading && products.map((p) => {
            const cartItem = cartItems.find(item => item.product_id === p.id)
            const stock = saleStock(p)
            const available = availableBase(stock, cartItem)
            const blocked = p.stock - stock
            const low = available > 0 && available <= p.low_stock_threshold
            const out = available <= 0
            const isExpSoon = p.has_expiration && p.expiration_date && p.expiration_date <= localDate(7)
            const isExpired = p.has_expiration && p.expiration_date && p.expiration_date < localDate()
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (out) {
                    playErrorTone()
                    hapticError()
                    toastError(blocked > 0 ? 'Expired or undated stock is blocked' : 'Out of stock', `Available for sale: ${stock} ${p.base_unit}.`)
                  } else {
                    playScanBeep()
                    hapticTap()
                    usePosCart.getState().add(p)
                  }
                }}
                aria-disabled={out}
                className="card group flex h-[170px] min-w-0 flex-col p-3 text-left transition hover:border-brand-500/50 hover:shadow-md bg-white border border-slate-200 shadow-sm rounded-xl aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5">
                  <span className="truncate text-xs font-bold text-brand-600">{p.sku}</span>
                  <span className={`text-[11px] font-bold ${out ? 'text-rose-600' : low ? 'text-amber-600' : 'text-slate-500'}`}>
                    {blocked > 0 ? `Sellable: ${stock}` : cartItem ? `Available: ${available} / ${stock}` : `Stock: ${stock}`} {p.base_unit}
                  </span>
                </div>
                <p className="line-clamp-2 min-h-10 break-words text-sm font-bold leading-tight text-slate-900">{p.name}</p>
                {/* Wholesale & Expiry Badges */}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {p.wholesale_price_c && p.wholesale_min_qty && (
                    <span className="rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] px-1.5 py-0.2 font-bold">
                      {p.wholesale_min_qty}+ @ {money(p.wholesale_price_c)}
                    </span>
                  )}
                  {isExpired ? (
                    <span className="rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-1.5 py-0.2 font-bold">
                      Expired
                    </span>
                  ) : isExpSoon ? (
                    <span className="rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.2 font-bold">
                      Near Expiry
                    </span>
                  ) : null}
                </div>
                <p className="mt-auto text-lg font-black text-brand-600 tabular-nums">{money(p.default_price_c)}</p>
              </button>
            )
          })}
        </div>
      </div>

      <CartPanel />

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
        title="Scan Barcode to Add to Cart"
      />

      <PettyCashModal
        open={pettyCashOpen}
        onClose={() => setPettyCashOpen(false)}
      />
    </div>
  )
}

function CartPanel(): React.JSX.Element {
  const { items, discount_pesos } = usePosCart()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [holdBusy, setHoldBusy] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unit_price_c * i.qty, 0), [items])
  const total = Math.max(0, subtotal - discount_pesos)
  const stockConflict = cartHasStockConflict(items)

  const loadHeldSales = async () => {
    try {
      setHeldSales(await window.api.pos.held())
    } catch (e) {
      toastError('Held sales failed', String((e as Error)?.message || e))
    }
  }

  useEffect(() => { void loadHeldSales() }, [])

  const holdCurrentSale = async () => {
    if (!items.length || holdBusy) return
    setHoldBusy(true)
    try {
      const held = await window.api.pos.hold({
        items: items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          unit_name: item.unit_name,
          qty: item.qty,
          qty_base: item.qty * item.conversion_to_base,
          unit_price_c: item.unit_price_c,
          cost_base_c: item.cost_base_c,
          stock_base: item.stock_base,
          subtotal_c: item.unit_price_c * item.qty
        })),
        discount_c: discount_pesos,
        customer_id: null,
        payments: []
      })
      usePosCart.getState().clear()
      await loadHeldSales()
      toastSuccess('Sale held', `Reference ${held.token}`)
    } catch (e) {
      toastError('Hold failed', String((e as Error)?.message || e))
    } finally {
      setHoldBusy(false)
    }
  }

  const resumeHeldSale = async (id: number) => {
    if (items.length && !confirm('Replace the current cart with this held sale?')) return
    setHoldBusy(true)
    try {
      const [held, productResult] = await Promise.all([
        window.api.pos.resumeHeld(id),
        window.api.products.search('', { status: 'ACTIVE', limit: 1000 })
      ])
      const catalog = new Map(productResult.rows.map((product) => [product.id, product]))
      usePosCart.getState().replace(held.items.map((item) => ({
        product_id: item.product_id as number,
        name: item.name,
        unit_name: item.unit_name,
        qty: item.qty,
        unit_price_c: item.unit_price_c,
        cost_base_c: item.cost_base_c,
        stock_base: item.product_id == null ? 0 : catalog.has(item.product_id) ? saleStock(catalog.get(item.product_id)!) : 0,
        conversion_to_base: item.qty > 0 ? item.qty_base / item.qty : 1
      })), held.discount_c)
      setHeldOpen(false)
      await loadHeldSales()
      toastSuccess('Sale resumed', `Reference ${held.token}`)
    } catch (e) {
      toastError('Resume failed', String((e as Error)?.message || e))
    } finally {
      setHoldBusy(false)
    }
  }

  const deleteHeldSale = async (held: HeldSale) => {
    if (!confirm(`Delete held sale ${held.token}?`)) return
    setHoldBusy(true)
    try {
      await window.api.pos.deleteHeld(held.id)
      await loadHeldSales()
      toastSuccess('Held sale deleted', held.token)
    } catch (e) {
      toastError('Delete failed', String((e as Error)?.message || e))
    } finally {
      setHoldBusy(false)
    }
  }

  return (
    <>
      {/* Desktop Cart Sidebar */}
      <aside className="hidden md:flex md:w-[40%] md:max-w-[26rem] md:border-l md:border-t-0 xl:w-[26rem] min-h-0 shrink-0 flex-col bg-ink-900">
        <CartBody
          isMobile={false}
          items={items}
          subtotal={subtotal}
          total={total}
          discount_pesos={discount_pesos}
          stockConflict={stockConflict}
          heldSalesCount={heldSales.length}
          holdBusy={holdBusy}
          onHold={() => void holdCurrentSale()}
          onClear={() => usePosCart.getState().clear()}
          onOpenHeld={() => setHeldOpen(true)}
          onOpenCustomer={() => setCustomerOpen(true)}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </aside>

      {/* Mobile Floating Cart Bar */}
      {items.length > 0 && !mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed inset-x-4 bottom-[calc(4.25rem+var(--saib))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-brand-400/40 bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3.5 text-left text-white shadow-[0_8px_25px_rgba(5,150,105,0.45)] active:scale-98 transition md:hidden"
        >
          <span className="flex min-w-0 items-center gap-2.5 text-base font-bold">
            <ShoppingCart className="h-5 w-5 shrink-0" />
            <span key={items.length} className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-black tabular-nums animate-pop">
              {items.reduce((s, i) => s + i.qty, 0)}
            </span>
            <span className="truncate">View Cart</span>
          </span>
          <span className="shrink-0 text-lg font-black tabular-nums">{money(total)}</span>
        </button>
      )}

      {/* Mobile Cart Bottom Sheet (Portaled to document.body to sit above MobileBottomNav & Safe Area) */}
      {mobileOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-fade"
              onClick={() => setMobileOpen(false)}
            />
            {/* Bottom Sheet Drawer */}
            <div className="relative z-10 flex max-h-[88vh] w-full flex-col rounded-t-2xl border-t border-ink-line bg-ink-900 shadow-[0_-8px_35px_rgba(0,0,0,0.7)] animate-bottom-sheet">
              <CartBody
                isMobile={true}
                onClose={() => setMobileOpen(false)}
                items={items}
                subtotal={subtotal}
                total={total}
                discount_pesos={discount_pesos}
                stockConflict={stockConflict}
                heldSalesCount={heldSales.length}
                holdBusy={holdBusy}
                onHold={() => void holdCurrentSale()}
                onClear={() => usePosCart.getState().clear()}
                onOpenHeld={() => setHeldOpen(true)}
                onOpenCustomer={() => setCustomerOpen(true)}
                onCheckout={() => setCheckoutOpen(true)}
              />
            </div>
          </div>,
          document.body
        )}

      {checkoutOpen && (
        <CheckoutModal
          subtotal={subtotal}
          total={total}
          onClose={() => {
            setCheckoutOpen(false)
            setMobileOpen(false)
          }}
        />
      )}
      {customerOpen && <CustomerPicker onClose={() => setCustomerOpen(false)} />}
      {heldOpen && (
        <Modal open onClose={() => setHeldOpen(false)} title="Held Sales" maxWidth="max-w-lg">
          <div className="space-y-2">
            {heldSales.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No held sales.</p>}
            {heldSales.map((held) => (
              <div key={held.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-line bg-ink-900 p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">Hold #{held.token}</p>
                  <p className="text-xs text-slate-500">{new Date(held.created_at).toLocaleString()} · {money(held.total_c)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button disabled={holdBusy} onClick={() => void deleteHeldSale(held)} className="btn-ghost-2 px-2.5 py-1.5 text-xs text-danger-400">Delete</button>
                  <button disabled={holdBusy} onClick={() => void resumeHeldSale(held.id)} className="btn-primary px-2.5 py-1.5 text-xs">Resume</button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

interface CartBodyProps {
  isMobile: boolean
  onClose?: () => void
  items: CartItem[]
  subtotal: number
  total: number
  discount_pesos: number
  stockConflict: boolean
  heldSalesCount: number
  holdBusy: boolean
  onHold: () => void
  onClear: () => void
  onOpenHeld: () => void
  onOpenCustomer: () => void
  onCheckout: () => void
}

function CartBody({
  isMobile,
  onClose,
  items,
  subtotal,
  total,
  discount_pesos,
  stockConflict,
  heldSalesCount,
  holdBusy,
  onHold,
  onClear,
  onOpenHeld,
  onOpenCustomer,
  onCheckout
}: CartBodyProps): React.JSX.Element {
  return (
    <>
      {/* drag handle on mobile */}
      {isMobile && (
        <div
          className="flex h-7 w-full shrink-0 cursor-pointer items-center justify-center pt-2 pb-1"
          onClick={onClose}
        >
          <div className="h-1.5 w-12 rounded-full bg-ink-700 active:bg-ink-500" />
        </div>
      )}

      {/* Cart Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-ink-line px-4 pb-3 pt-1 md:pt-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-200">
          <ShoppingCart className="h-4 w-4" /> Cart
          {items.length > 0 && (
            <span key={items.length} className="badge bg-brand-600/20 text-brand-300 animate-pop">
              {items.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenHeld}
            className="btn-ghost-2 rounded-lg px-2 py-1 text-xs"
            title="Resume held sales"
          >
            Held {heldSalesCount > 0 && `(${heldSalesCount})`}
          </button>
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-800 hover:text-danger-400"
              title="Clear cart"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {isMobile && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-800"
              aria-label="Close cart"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {items.length === 0 && (
          <p className="py-10 text-center text-sm leading-6 text-slate-500">
            Cart is empty.
            <br />
            Tap a product to add it.
          </p>
        )}
        {items.map((i) => (
          <div key={i.product_id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-slate-900 leading-tight">{i.name}</p>
                {i.is_wholesale ? (
                  <span className="inline-flex items-center gap-1 rounded bg-sky-50 text-sky-700 px-1.5 py-0.5 text-[10px] font-bold border border-sky-200 mt-1">
                    Wholesale Applied ({money(i.unit_price_c)}/pc)
                  </span>
                ) : i.wholesale_min_qty ? (
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Buy {i.wholesale_min_qty}+ for {money(i.wholesale_price_c || 0)}/ea
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => usePosCart.getState().remove(i.product_id)}
                className="shrink-0 text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    hapticTap()
                    usePosCart.getState().setQty(i.product_id, i.qty - 1)
                  }}
                  className="btn-ghost-2 h-10 w-10 rounded-xl"
                  title="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  value={i.qty}
                  onChange={(e) => usePosCart.getState().setQty(i.product_id, parseInt(e.target.value || '0', 10))}
                  aria-label={`Quantity for ${i.name}`}
                  className="h-10 w-14 rounded-xl border border-slate-200 bg-slate-50 py-1 text-center text-base font-bold text-slate-900 focus:bg-white focus:border-brand-500"
                />
                <button
                  disabled={i.qty >= maxQuantity(i.stock_base, i.conversion_to_base)}
                  onClick={() => {
                    hapticTap()
                    usePosCart.getState().setQty(i.product_id, i.qty + 1)
                  }}
                  className="btn-ghost-2 h-10 w-10 rounded-xl disabled:opacity-30"
                  title={
                    i.qty >= maxQuantity(i.stock_base, i.conversion_to_base)
                      ? `Only ${maxQuantity(i.stock_base, i.conversion_to_base)} remaining`
                      : 'Increase quantity'
                  }
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-slate-900 tabular-nums">{money(i.unit_price_c * i.qty)}</p>
                <p className="text-xs text-slate-500">@{money(i.unit_price_c)} / {i.unit_name}</p>
              </div>
            </div>
            <p className={`mt-1 text-xs ${reservedBase(i) > i.stock_base ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
              Available: {availableBase(i.stock_base, i)} base units / {i.stock_base}
            </p>
          </div>
        ))}
      </div>

      {stockConflict && (
        <div className="mx-4 mb-2 shrink-0 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 font-semibold">
          Current stock changed. Please adjust the cart to the available quantity before checkout.
        </div>
      )}

      {/* Totals & Utang Selector */}
      <div className="shrink-0 space-y-2 border-t border-slate-200 px-4 py-3 text-base bg-white">
        <div className="flex items-center justify-between text-slate-500 text-sm">
          <span>Customer</span>
          <button
            onClick={onOpenCustomer}
            className="flex items-center gap-1 text-brand-600 hover:text-brand-700 font-bold"
          >
            <User className="h-3.5 w-3.5" /> Select (utang)
          </button>
        </div>
        <div className="flex items-center justify-between text-slate-500 text-sm">
          <span>Subtotal</span>
          <span className="text-slate-800 font-semibold">{money(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-500 text-sm">
          <span>Discount (₱)</span>
          <input
            type="number"
            min={0}
            value={discount_pesos}
            onChange={(e) => usePosCart.getState().setDiscountPesos((parseFloat(e.target.value) || 0) * 100)}
            className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm font-bold text-slate-800 focus:bg-white"
          />
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2">
          <span className="font-bold text-slate-900">TOTAL</span>
          <span className="text-2xl font-black text-brand-600 tabular-nums">{money(total)}</span>
        </div>
      </div>

      {/* Action Buttons: Hold, Clear, CHECKOUT */}
      <div className={`shrink-0 border-t border-slate-200 bg-white px-4 pt-2.5 ${isMobile ? 'pb-[calc(1.25rem+var(--saib))]' : 'pb-4'}`}>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={items.length === 0}
            onClick={onHold}
            className="btn-ghost flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            {holdBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Hold
          </button>
          <button
            disabled={items.length === 0}
            onClick={onClear}
            className="btn-secondary py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Clear
          </button>
          <button
            disabled={items.length === 0 || stockConflict}
            onClick={onCheckout}
            className="btn-primary col-span-2 min-h-13 py-3.5 !text-base font-bold shadow-lg flex items-center justify-center gap-2 active:scale-98 transition disabled:opacity-40"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>CHECKOUT</span>
            <span className="tabular-nums font-black">({money(total)})</span>
          </button>
        </div>
      </div>
    </>
  )
}

function CheckoutModal({ subtotal, total, onClose }: { subtotal: number; total: number; onClose: () => void }): React.JSX.Element {
  const { items, customer_id, discount_pesos } = usePosCart()
  const [method, setMethod] = useState<'CASH' | 'GCASH' | 'MAYA' | 'UTANG'>('CASH')
  const [cash, setCash] = useState<string>(cashInputFromCents(total))
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [done, setDone] = useState<{ sale: Sale; receipt: string[]; print: PrintResult } | null>(null)
  const [printing, setPrinting] = useState(false)
  const setPage = useNav((state) => state.setPage)

  const cashC = Math.round((parseFloat(cash) || 0) * 100)
  const change = cashC - total

  const openShift = async () => {
    const shift = await window.api.shifts.current()
    if (!shift) {
      await window.api.shifts.open(0)
    }
  }

  useEffect(() => { void openShift() }, [])

  const doCheckout = async () => {
    if (cartHasStockConflict(items)) {
      toastError('Stock changed', 'Please adjust the cart to the available quantity before checkout.')
      return
    }
    setSubmitting(true)
    try {
      const payments: PaymentInput[] =
        method === 'UTANG'
          ? [{ method, amount_c: total }]
          : method === 'CASH'
            ? [{ method, amount_c: cashC, reference: null }]
            : [{ method, amount_c: total, reference: reference || null }]
      const payload = {
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          unit_name: i.unit_name,
          qty: i.qty,
          qty_base: i.qty * i.conversion_to_base,
          unit_price_c: i.unit_price_c,
          cost_base_c: i.cost_base_c,
          stock_base: i.stock_base,
          subtotal_c: i.unit_price_c * i.qty
        })),
        discount_c: discount_pesos,
        customer_id,
        payments
      }
      const res = await window.api.pos.checkout(payload)
      setDone(res)
      usePosCart.getState().clear()
      playSuccessChime()
      hapticSuccess()
      if (res.print.ok || res.print.code === 'DISABLED') toastSuccess('Sale completed successfully', res.sale.transaction_no)
      else toastError('Sale completed successfully', res.print.message)
    } catch (e) {
      playErrorTone()
      hapticError()
      toastError('Checkout failed', String((e as Error)?.message || e))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    const print = async () => {
      setPrinting(true)
      try {
        const result = await window.api.printer.printReceipt(done.sale.id)
        setDone({ ...done, print: result })
        if (result.ok) toastSuccess('Receipt printed successfully')
        else toastError('Receipt printing failed', result.message)
      } catch (e) { toastError('Receipt printing failed', String((e as Error)?.message || e)) } finally { setPrinting(false) }
    }

    const share = async () => {
      try {
        await window.api.printer.shareReceipt?.(done.receipt, `Receipt ${done.sale.transaction_no}`)
      } catch (e) { toastError('Share failed', String((e as Error)?.message || e)) }
    }

    return (
      <Modal open onClose={onClose} title="Sale Complete" footer={
        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
          <button onClick={() => void share()} type="button" className="btn-ghost flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Share</button>
          <button onClick={() => void print()} disabled={printing} type="button" className="btn-ghost flex items-center gap-1.5"><Printer className="h-4 w-4" /> {done.print.ok ? 'Print Again' : 'Print Receipt'}</button>
          {(done.print.code === 'NO_PRINTER' || done.print.code === 'UNAVAILABLE') && <button onClick={() => { onClose(); setPage('settings') }} className="btn-ghost">Configure</button>}
          <button onClick={onClose} className="btn-primary min-h-12 w-full sm:w-auto sm:min-w-32">Done</button>
        </div>
      }>
        <div className="mb-3 text-center">
          <Check className="mx-auto mb-2 h-16 w-16 text-emerald-600 animate-pop" />
          <p className="text-3xl font-black text-slate-900 tabular-nums">{money(done.sale.total_c)}</p>
          <p className="text-sm font-semibold text-slate-500">{done.sale.transaction_no}</p>
        </div>
        <p className={`mb-3 rounded-xl border p-2.5 text-xs font-semibold ${done.print.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{done.print.message}</p>
        <ReceiptPaper lines={done.receipt} />
      </Modal>
    )
  }

  const methods: { key: typeof method; label: string; icon: React.ReactNode }[] = [
    { key: 'CASH', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
    { key: 'GCASH', label: 'GCash', icon: <Smartphone className="h-4 w-4" /> },
    { key: 'MAYA', label: 'Maya', icon: <Smartphone className="h-4 w-4" /> },
    { key: 'UTANG', label: 'Utang', icon: <Wallet className="h-4 w-4" /> }
  ]

  return (
    <Modal open onClose={onClose} title="Checkout" maxWidth="max-w-md" footer={
      <div className="flex gap-2 w-full sm:w-auto">
        <button onClick={onClose} className="btn-ghost flex-1 sm:flex-none">Cancel</button>
        <button onClick={doCheckout} disabled={submitting} className="btn-primary flex-1 sm:flex-none items-center justify-center gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Charge {money(total)}
        </button>
      </div>
    }>
      <div className="space-y-3">
        {/* Compact Total Due Header */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Due</span>
            <p className="text-xs text-slate-500">Subtotal {money(subtotal)} {discount_pesos > 0 ? `· Disc -${money(discount_pesos)}` : ''}</p>
          </div>
          <p className="text-3xl font-black text-brand-600 tabular-nums">{money(total)}</p>
        </div>

        {/* Sleek Segmented Payment Method Bar */}
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {methods.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-xs font-bold transition active:scale-95 ${
                method === m.key
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {m.icon}
              <span className="text-[11px]">{m.label}</span>
            </button>
          ))}
        </div>

        {method === 'CASH' && (
          <div className="space-y-2">
            {/* Side-by-Side Cash Received & Sukli */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Received</span>
                <p className="text-xl font-black text-slate-900 tabular-nums">
                  {cash ? `₱${cash}` : '₱0'}
                </p>
              </div>
              <div className={`rounded-xl border px-3 py-2 shadow-xs ${change >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Change (sukli)</span>
                <p className={`tabular-nums ${change >= 0 ? 'text-xl font-black text-emerald-700' : 'mt-0.5 text-xs font-bold text-rose-700'}`}>
                  {change >= 0 ? money(change) : `Lacking ${money(Math.abs(change))}`}
                </p>
              </div>
            </div>

            <TouchNumpad
              value={cash}
              totalPesos={Math.round(total / 100)}
              onChange={(next) => setCash(next)}
            />
          </div>
        )}

        {(method === 'GCASH' || method === 'MAYA') && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-300 bg-sky-50 py-3.5 text-sm font-bold text-sky-700 hover:bg-sky-100 transition active:scale-98 shadow-sm"
            >
              <QrCode className="h-5 w-5 text-sky-600" />
              <span>Open {method === 'GCASH' ? 'GCash' : 'Maya'} QR Code ({money(total)})</span>
            </button>

            <div>
              <label className="label">Reference No.</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="input w-full font-mono text-sm"
                placeholder="e.g. 1029384756"
              />
            </div>

            {qrModalOpen && (
              <DynamicQRModal
                open={qrModalOpen}
                method={method}
                totalC={total}
                reference={reference}
                onReferenceChange={setReference}
                onClose={() => setQrModalOpen(false)}
                onConfirm={() => {
                  setQrModalOpen(false)
                  void doCheckout()
                }}
                submitting={submitting}
              />
            )}
          </div>
        )}

        {method === 'UTANG' && (
          <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
            This sale will be charged to the selected customer&apos;s utang account.
          </p>
        )}
      </div>
    </Modal>
  )
}

function CustomerPicker({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (term: string) => {
    setLoading(true)
    try {
      const res = await window.api.customers.list({ search: term || undefined, status: 'ACTIVE', limit: 30 })
      setRows(res.rows)
    } catch (e) {
      toastError('Failed to load customers', String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load('') }, [])

  return (
    <Modal open onClose={onClose} title="Select Customer (Utang)" maxWidth="max-w-md" footer={
      <button onClick={() => { usePosCart.getState().setCustomer(null); onClose() }} className="btn-ghost">Walk-in (no utang)</button>
    }>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); void load(e.target.value) }}
        placeholder="Search customer…"
        className="input mb-3 w-full"
        autoFocus
      />
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {loading && <p className="py-4 text-center text-sm text-slate-500">Loading…</p>}
        {!loading && rows.map((c) => (
          <button
            key={c.id}
            onClick={() => { usePosCart.getState().setCustomer(c.id); onClose() }}
            className="flex w-full items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-left hover:border-brand-500/50"
          >
            <div>
              <p className="text-sm font-medium text-slate-200">{c.full_name}</p>
              <p className="text-xs text-slate-500">Limit {money(c.credit_limit_c)}</p>
            </div>
            <span className={`text-xs font-bold ${c.balance_c > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{money(c.balance_c)}</span>
          </button>
        ))}
        {!loading && rows.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No customers found.</p>}
      </div>
    </Modal>
  )
}
