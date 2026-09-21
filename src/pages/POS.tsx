import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  ScanLine
} from 'lucide-react'
import type { Product, Customer, Sale, Category, HeldSale } from '@shared/types'
import { money } from '@shared/format'
import { Modal } from '../components/ui/Modal'
import { ReceiptPaper } from '../components/ReceiptPaper'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import { TouchNumpad } from '../components/TouchNumpad'
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

const saleStock = (p: Product): number =>
  (p.expiration_date && p.expiration_date < localDate() ? 0 : p.sellable_stock ?? p.stock)


interface CartItem {
  product_id: number
  name: string
  unit_name: string
  qty: number
  unit_price_c: number
  cost_base_c: number
  stock_base: number
  conversion_to_base: number
}

interface CartState {
  items: CartItem[]
  customer: Customer | null
  customer_id: number | null
  discount_pesos: number
  allow_negative: boolean
  setAllowNegative: (v: boolean) => void
  add: (p: Product) => void
  setQty: (product_id: number, qty: number) => void
  remove: (product_id: number) => void
  clear: () => void
  setCustomer: (c: Customer | number | null) => void
  setDiscountPesos: (v: number) => void
  replace: (items: CartItem[], discount_pesos: number) => void
  syncStocks: (products: Product[]) => void
}

export const usePosCart = create<CartState>((set) => ({
  items: [],
  customer: null,
  customer_id: null,
  discount_pesos: 0,
  allow_negative: true,
  setAllowNegative: (v) => set({ allow_negative: v }),
  add: (p) =>
    set((s) => {
      const stock = saleStock(p)
      const ex = s.items.find((i) => i.product_id === p.id)
      if (!s.allow_negative && stock < 1) return s
      if (ex) {
        const nextQty = s.allow_negative ? ex.qty + 1 : Math.min(ex.qty + 1, maxQuantity(stock, ex.conversion_to_base))
        return { items: s.items.map((i) => (i === ex ? { ...i, stock_base: stock, qty: nextQty } : i)) }
      }
      return {
        items: [...s.items, {
          product_id: p.id,
          name: p.name,
          unit_name: p.base_unit,
          qty: 1,
          unit_price_c: p.default_price_c,
          cost_base_c: p.purchase_cost_c,
          stock_base: stock,
          conversion_to_base: 1
        }]
      }
    }),
  setQty: (product_id, qty) =>
    set((s) => ({
      items: s.items
        .map((i) => (i.product_id === product_id
          ? { ...i, qty: s.allow_negative ? Math.max(0, Number.isFinite(qty) ? qty : 0) : Math.min(Math.max(0, Number.isFinite(qty) ? qty : 0), maxQuantity(i.stock_base, i.conversion_to_base)) }
          : i))
        .filter((i) => i.qty > 0)
    })),
  remove: (product_id) => set((s) => ({ items: s.items.filter((i) => i.product_id !== product_id) })),
  clear: () => set({ items: [], customer: null, customer_id: null, discount_pesos: 0 }),
  setCustomer: (c) =>
    set(() => {
      if (!c) return { customer: null, customer_id: null }
      if (typeof c === 'number') return { customer_id: c }
      return { customer: c, customer_id: c.id }
    }),
  setDiscountPesos: (v) => set({ discount_pesos: Math.max(0, v) }),
  replace: (items, discount_pesos) => set({ items, customer: null, customer_id: null, discount_pesos }),
  syncStocks: (products) => set((s) => {
    const stocks = new Map(products.map(p => [p.id, saleStock(p)]))
    return { items: s.items.map(item => ({ ...item, stock_base: stocks.get(item.product_id) ?? item.stock_base })) }
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
  const allowNeg = usePosCart((state) => state.allow_negative)
  const [scannerOpen, setScannerOpen] = useState(false)

  const handleBarcodeScan = async (code: string) => {
    try {
      const trimmed = code.trim()
      const unpadded = trimmed.replace(/^0+/, '')
      const res = await window.api.products.search(trimmed, { limit: 10, status: 'ACTIVE' })
      const exact = res.rows.find((p) =>
        p.barcode?.trim() === trimmed ||
        p.sku.toLowerCase() === trimmed.toLowerCase() ||
        p.units?.some((u) => u.barcode?.trim() === trimmed) ||
        (unpadded && (p.barcode?.replace(/^0+/, '') === unpadded || p.units?.some((u) => (u.barcode ?? '').replace(/^0+/, '') === unpadded)))
      ) || res.rows[0]
      if (exact) {
        const stock = saleStock(exact)
        const allowNeg = usePosCart.getState().allow_negative
        if (allowNeg || stock > 0) {
          usePosCart.getState().add(exact)
          playScanBeep()
          hapticScan()
          toastSuccess('Added to cart', `${exact.name} (${trimmed})`)
        } else {
          playErrorTone()
          hapticError()
          toastError('Out of stock', `${exact.name} has 0 stock. You can enable 'Sell without stock' in Settings.`)
        }
      } else {
        setQ(trimmed)
        void search(trimmed, catFilter === 'ALL' ? null : catFilter)
        playErrorTone()
        toastError('Barcode not found', `No product matching "${trimmed}"`)
      }
    } catch (err) {
      toastError('Scan error', String(err))
    }
  }

  useEffect(() => {
    window.api.settings.get().then((s) => {
      usePosCart.getState().setAllowNegative(s?.allow_negative_inventory ?? true)
    }).catch(() => {})
  }, [])

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
              className="btn-primary flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-3.5 shadow-md active:scale-95 transition"
              title="Scan barcode with camera"
            >
              <ScanLine className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-bold">Scan</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => chooseCategory('ALL')}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${catFilter === 'ALL' ? 'bg-brand-600 text-white' : 'bg-ink-800 text-slate-300 hover:bg-ink-700'}`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => chooseCategory(c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${catFilter === c.id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-slate-300 hover:bg-ink-700'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="mb-3 text-sm text-danger-400">{error}</p>}
        <div className="grid min-h-0 flex-1 auto-rows-[160px] grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] content-start gap-3 overflow-y-auto pb-24 md:pb-2">
          {loading && Array.from({ length: 12 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
          {!loading && products.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-slate-500">No products found.</div>
          )}
          {!loading && products.map((p) => {
            const cartItem = cartItems.find(item => item.product_id === p.id)
            const stock = saleStock(p)
            const available = availableBase(stock, cartItem)
            const isExpired = Boolean(p.expiration_date && p.expiration_date < localDate())
            const low = available > 0 && available <= p.low_stock_threshold
            const out = !allowNeg && available <= 0
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (out) {
                    playErrorTone()
                    hapticError()
                    if (isExpired) {
                      toastError('This product is expired and blocked from sale', `Expired on ${p.expiration_date}. Sellable: ${stock} ${p.base_unit}.`)
                    } else {
                      toastError('Out of stock', `Available for sale: ${stock} ${p.base_unit}. You can enable 'Sell without stock' in Settings.`)
                    }
                  } else {
                    playScanBeep()
                    hapticTap()
                    usePosCart.getState().add(p)
                  }
                }}
                aria-disabled={out}
                className="card group flex h-40 min-w-0 flex-col p-3 text-left transition hover:border-brand-500/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="truncate text-xs font-bold text-brand-400">{p.sku}</span>
                  <span className={`text-xs font-bold ${available <= 0 ? (allowNeg ? 'text-amber-400' : 'text-red-400') : low ? 'text-amber-400' : 'text-slate-500'}`}>
                    {isExpired ? 'EXPIRED' : cartItem ? `Available: ${available} / ${stock} ${p.base_unit}` : `Stock: ${stock} ${p.base_unit}`}
                  </span>
                </div>
                <p className="line-clamp-2 min-h-12 break-words text-base font-semibold leading-6 text-white">{p.name}</p>
                {isExpired && <p className="truncate text-xs font-semibold text-red-400">Expired: {p.expiration_date}</p>}
                <p className="mt-auto text-xl font-bold text-brand-400">{money(p.default_price_c)}</p>
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
    </div>
  )
}

function CartPanel(): React.JSX.Element {
  const { items, customer, customer_id, discount_pesos, allow_negative } = usePosCart()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [holdBusy, setHoldBusy] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (customer_id && !customer) {
      window.api.customers.get(customer_id).then((c) => {
        if (c) usePosCart.getState().setCustomer(c)
      }).catch(() => {})
    }
  }, [customer_id, customer])

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unit_price_c * i.qty, 0), [items])
  const total = Math.max(0, subtotal - discount_pesos)
  const stockConflict = !allow_negative && cartHasStockConflict(items)

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
          customer={customer}
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
                customer={customer}
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
  customer: Customer | null
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

export function CartBody({
  isMobile,
  onClose,
  items,
  customer,
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
          <div key={i.product_id} className="rounded-lg border border-ink-line bg-ink-800/50 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words text-base font-semibold leading-6 text-slate-200">{i.name}</p>
              <button
                onClick={() => usePosCart.getState().remove(i.product_id)}
                className="shrink-0 text-slate-600 hover:text-danger-400"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    hapticTap()
                    usePosCart.getState().setQty(i.product_id, i.qty - 1)
                  }}
                  className="btn-ghost-2 h-10 w-10 rounded-lg"
                  title="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  value={i.qty}
                  onChange={(e) => usePosCart.getState().setQty(i.product_id, parseInt(e.target.value || '0', 10))}
                  aria-label={`Quantity for ${i.name}`}
                  className="h-10 w-14 rounded-lg border border-ink-line bg-ink-950 py-1 text-center text-base font-bold text-white"
                />
                <button
                  disabled={i.qty >= maxQuantity(i.stock_base, i.conversion_to_base)}
                  onClick={() => {
                    hapticTap()
                    usePosCart.getState().setQty(i.product_id, i.qty + 1)
                  }}
                  className="btn-ghost-2 h-10 w-10 rounded-lg disabled:opacity-30"
                  title={
                    i.qty >= maxQuantity(i.stock_base, i.conversion_to_base)
                      ? `Only ${maxQuantity(i.stock_base, i.conversion_to_base)} remaining`
                      : 'Increase quantity'
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{money(i.unit_price_c * i.qty)}</p>
                <p className="text-sm text-slate-400">@{money(i.unit_price_c)} / {i.unit_name}</p>
              </div>
            </div>
            <p className={`mt-1 text-xs ${reservedBase(i) > i.stock_base ? 'text-danger-400' : 'text-slate-500'}`}>
              Available: {availableBase(i.stock_base, i)} base units / {i.stock_base}
            </p>
          </div>
        ))}
      </div>

      {stockConflict && (
        <div className="mx-4 mb-2 shrink-0 rounded-lg border border-danger-500/30 bg-danger-500/10 p-2 text-xs text-danger-300">
          Current stock changed. Please adjust the cart to the available quantity before checkout.
        </div>
      )}

      {/* Totals & Credit Customer Selector */}
      <div className="shrink-0 space-y-2 border-t border-ink-line px-4 py-2.5 text-base bg-ink-900">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-xs font-semibold">Customer (Credit)</span>
          {customer ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 px-2 py-1 max-w-[210px]">
              <User className="h-3.5 w-3.5 text-brand-400 shrink-0" />
              <div className="min-w-0 text-left">
                <span className="text-xs font-bold text-white block truncate leading-tight">
                  {customer.full_name}
                </span>
                <span className="text-[10px] text-amber-400 tabular-nums block leading-tight">
                  Credit: {money(customer.balance_c)}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenCustomer}
                className="text-[10px] text-brand-400 hover:text-white underline ml-1 font-semibold shrink-0"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => usePosCart.getState().setCustomer(null)}
                className="text-slate-400 hover:text-danger-400 ml-0.5 p-0.5 shrink-0"
                title="Remove customer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenCustomer}
              className="flex items-center gap-1 text-brand-400 hover:text-brand-300 font-semibold text-xs rounded-lg bg-ink-800 px-2.5 py-1 border border-brand-500/20 active:scale-95 transition"
            >
              <User className="h-3.5 w-3.5" /> Select Customer
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span>Subtotal</span>
          <span className="text-slate-200">{money(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span>Discount (₱)</span>
          <input
            type="number"
            min={0}
            value={discount_pesos}
            onChange={(e) => usePosCart.getState().setDiscountPesos((parseFloat(e.target.value) || 0) * 100)}
            className="w-24 rounded-lg border border-ink-line bg-ink-950 px-2 py-1 text-right text-sm text-slate-200"
          />
        </div>
        <div className="flex justify-between border-t border-ink-line pt-1.5">
          <span className="font-bold text-white">TOTAL</span>
          <span className="text-2xl font-bold text-brand-400">{money(total)}</span>
        </div>
      </div>

      {/* Action Buttons: Hold, Clear, CHECKOUT */}
      <div className={`shrink-0 border-t border-ink-line bg-ink-900 px-4 pt-2.5 ${isMobile ? 'pb-[calc(1.25rem+var(--saib))]' : 'pb-4'}`}>
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
  const { items, customer, customer_id, discount_pesos, allow_negative } = usePosCart()
  const [method, setMethod] = useState<'CASH' | 'GCASH' | 'MAYA' | 'UTANG'>('CASH')
  const [cash, setCash] = useState<string>(cashInputFromCents(total))
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ sale: Sale; receipt: string[]; print: PrintResult } | null>(null)
  const [printing, setPrinting] = useState(false)

  // Inline Customer Selection for Credit
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerList, setCustomerList] = useState<Customer[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [pickingCustomer, setPickingCustomer] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustNickname, setNewCustNickname] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustLimit, setNewCustLimit] = useState('1000')

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

  const loadCustomers = useCallback(async (term = '') => {
    setCustomerLoading(true)
    try {
      const res = await window.api.customers.list({ search: term.trim() || undefined, status: 'ACTIVE', limit: 50 })
      setCustomerList(res.rows)
    } catch (e) {
      toastError('Failed to load customers', String((e as Error)?.message || e))
    } finally {
      setCustomerLoading(false)
    }
  }, [])

  useEffect(() => {
    if (method === 'UTANG') {
      void loadCustomers(customerSearch)
    }
  }, [method, customerSearch, loadCustomers])

  const handleCreateCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newCustName.trim()
    if (!trimmed) {
      toastError('Name required', 'Please enter customer name.')
      return
    }
    setSavingCustomer(true)
    try {
      const limitC = Math.round((parseFloat(newCustLimit) || 1000) * 100)
      const created = await window.api.customers.create({
        full_name: trimmed,
        nickname: newCustNickname.trim() || null,
        phone: newCustPhone.trim() || null,
        address: null,
        notes: null,
        credit_limit_c: limitC
      })
      usePosCart.getState().setCustomer(created)
      setShowAddCustomer(false)
      setPickingCustomer(false)
      setNewCustName('')
      setNewCustNickname('')
      setNewCustPhone('')
      playSuccessChime()
      hapticSuccess()
      toastSuccess('Customer selected', `${created.full_name} is ready for credit sale`)
    } catch (err) {
      playErrorTone()
      hapticError()
      toastError('Failed to add customer', String((err as Error)?.message || err))
    } finally {
      setSavingCustomer(false)
    }
  }

  const doCheckout = async () => {
    if (!allow_negative && cartHasStockConflict(items)) {
      toastError('Stock changed', 'Please adjust the cart to the available quantity before checkout.')
      return
    }
    if (method === 'UTANG' && !customer_id) {
      playErrorTone()
      hapticError()
      toastError('Customer required', 'Please select or add a customer to charge this credit sale.')
      setPickingCustomer(true)
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
          <Check className="mx-auto mb-2 h-16 w-16 text-emerald-400 animate-pop" />
          <p className="text-2xl font-bold text-white tabular-nums">{money(done.sale.total_c)}</p>
          <p className="text-sm text-slate-400">{done.sale.transaction_no}</p>
        </div>
        <p className={`mb-3 rounded-lg border p-2 text-xs ${done.print.ok ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-300'}`}>{done.print.message}</p>
        <ReceiptPaper lines={done.receipt} />
      </Modal>
    )
  }

  const methods: { key: typeof method; label: string; icon: React.ReactNode }[] = [
    { key: 'CASH', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
    { key: 'GCASH', label: 'GCash', icon: <Smartphone className="h-4 w-4" /> },
    { key: 'MAYA', label: 'Maya', icon: <Smartphone className="h-4 w-4" /> },
    { key: 'UTANG', label: 'Credit', icon: <Wallet className="h-4 w-4" /> }
  ]

  return (
    <Modal open onClose={onClose} title="Checkout" maxWidth="max-w-md" footer={
      <div className="flex gap-2 w-full sm:w-auto">
        <button onClick={onClose} className="btn-ghost flex-1 sm:flex-none">Cancel</button>
        <button onClick={doCheckout} disabled={submitting} className="btn-primary flex-1 sm:flex-none items-center justify-center gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {method === 'UTANG' && customer
            ? `Charge ${money(total)} (Credit: ${customer.nickname || customer.full_name})`
            : `Charge ${money(total)}`}
        </button>
      </div>
    }>
      <div className="space-y-3">
        {/* Compact Total Due Header */}
        <div className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-950 px-4 py-2.5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Due</span>
            <p className="text-xs text-slate-400">Subtotal {money(subtotal)} {discount_pesos > 0 ? `· Disc -${money(discount_pesos)}` : ''}</p>
          </div>
          <p className="text-3xl font-black text-brand-400 tabular-nums">{money(total)}</p>
        </div>

        {/* Sleek Segmented Payment Method Bar */}
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-ink-line bg-ink-950 p-1">
          {methods.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMethod(m.key)
                if (m.key === 'UTANG' && !customer) {
                  setPickingCustomer(true)
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-semibold transition active:scale-95 ${
                method === m.key
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-400 hover:bg-ink-900 hover:text-white'
              }`}
            >
              {m.icon}
              <span className="text-[11px]">{m.label}</span>
            </button>
          ))}
        </div>

        {method === 'CASH' && (
          <div className="space-y-2">
            {/* Side-by-Side Cash Received & Change */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-ink-line bg-ink-950 px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Received</span>
                <p className="text-xl font-black text-white tabular-nums">
                  {cash ? `₱${cash}` : '₱0'}
                </p>
              </div>
              <div className={`rounded-xl border px-3 py-1.5 ${change >= 0 ? 'border-brand-500/30 bg-brand-500/10' : 'border-danger-500/30 bg-danger-500/10'}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Change</span>
                <p className={`tabular-nums ${change >= 0 ? 'text-xl font-black text-brand-300' : 'mt-0.5 text-xs font-bold text-danger-400'}`}>
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
          <div>
            <label className="mb-1 block text-xs text-slate-400">Reference No.</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="input w-full" placeholder="e.g. 1234-5678" />
          </div>
        )}

        {method === 'UTANG' && (
          <div className="space-y-2.5">
            {customer && !pickingCustomer ? (
              <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-brand-400 shrink-0" />
                      <span className="font-bold text-white text-sm truncate">{customer.full_name}</span>
                      {customer.nickname && <span className="text-xs text-slate-400 truncate">({customer.nickname})</span>}
                    </div>
                    {customer.phone && <p className="text-[11px] text-slate-400 mt-0.5">{customer.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPickingCustomer(true)
                        setCustomerSearch('')
                      }}
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300 underline"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => usePosCart.getState().setCustomer(null)}
                      className="text-slate-400 hover:text-danger-400 p-0.5"
                      title="Clear customer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand-500/20 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Current Credit</span>
                    <p className="font-bold text-amber-400 tabular-nums text-sm">{money(customer.balance_c)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">New Balance (+{money(total)})</span>
                    <p className="font-black text-white tabular-nums text-sm">{money(customer.balance_c + total)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-brand-500/10 text-[11px]">
                  <span className="text-slate-400">Credit Limit: {money(customer.credit_limit_c)}</span>
                  {customer.balance_c + total > customer.credit_limit_c ? (
                    <span className="text-amber-400 font-semibold">⚠️ Exceeds limit</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">Within limit</span>
                  )}
                </div>
              </div>
            ) : showAddCustomer ? (
              <form onSubmit={(e) => void handleCreateCustomer(e)} className="rounded-xl border border-brand-500/30 bg-ink-950 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Add New Customer</span>
                  <button type="button" onClick={() => setShowAddCustomer(false)} className="text-xs text-slate-400 hover:text-white">
                    Cancel
                  </button>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Full Name *</label>
                  <input
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="input w-full text-xs h-9"
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Nickname</label>
                    <input
                      value={newCustNickname}
                      onChange={(e) => setNewCustNickname(e.target.value)}
                      placeholder="e.g. Maria"
                      className="input w-full text-xs h-9"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Phone</label>
                    <input
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder="0917..."
                      className="input w-full text-xs h-9"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Credit Limit (₱)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={newCustLimit}
                    onChange={(e) => setNewCustLimit(e.target.value)}
                    className="input w-full text-xs h-9"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingCustomer || !newCustName.trim()}
                  className="btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {savingCustomer && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save & Select Customer
                </button>
              </form>
            ) : (
              <div className="rounded-xl border border-ink-line bg-ink-950 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">Select Customer for Credit</span>
                  <div className="flex items-center gap-2">
                    {customer && (
                      <button
                        type="button"
                        onClick={() => setPickingCustomer(false)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Keep Current
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustName(customerSearch)
                        setShowAddCustomer(true)
                      }}
                      className="btn-primary text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> New
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search name or phone…"
                    className="input w-full pl-8 text-xs h-9"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {customerLoading && <p className="py-4 text-center text-xs text-slate-500">Loading customers…</p>}
                  {!customerLoading && customerList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        usePosCart.getState().setCustomer(c)
                        setPickingCustomer(false)
                        hapticTap()
                        toastSuccess('Customer selected', c.full_name)
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-ink-line bg-ink-900/80 p-2 text-left hover:border-brand-500/50 hover:bg-ink-850 active:scale-98 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{c.full_name} {c.nickname ? `(${c.nickname})` : ''}</p>
                        <p className="text-[10px] text-slate-400">{c.phone || 'No phone'} · Limit: {money(c.credit_limit_c)}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className={`text-xs font-black tabular-nums block ${c.balance_c > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {money(c.balance_c)}
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">
                          {c.balance_c > 0 ? 'credit' : 'zero'}
                        </span>
                      </div>
                    </button>
                  ))}

                  {!customerLoading && customerList.length === 0 && (
                    <div className="py-4 text-center space-y-1.5">
                      <p className="text-xs text-slate-400">No customers found.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustName(customerSearch)
                          setShowAddCustomer(true)
                        }}
                        className="btn-primary text-xs mx-auto flex items-center gap-1 py-1 px-3"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {customerSearch ? `Add "${customerSearch}"` : 'Add New Customer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 text-center">
              Recorded as a credit sale and posted to the customer ledger.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function CustomerPicker({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newLimit, setNewLimit] = useState('1000')

  const load = async (term: string) => {
    setLoading(true)
    try {
      const res = await window.api.customers.list({ search: term || undefined, status: 'ACTIVE', limit: 50 })
      setRows(res.rows)
    } catch (e) {
      toastError('Failed to load customers', String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load('') }, [])

  const handleCreateAndSelect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) {
      toastError('Name required', 'Please enter the customer name.')
      return
    }
    setSaving(true)
    try {
      const limitC = Math.round((parseFloat(newLimit) || 1000) * 100)
      const created = await window.api.customers.create({
        full_name: trimmed,
        nickname: newNickname.trim() || null,
        phone: newPhone.trim() || null,
        address: null,
        notes: null,
        credit_limit_c: limitC
      })
      usePosCart.getState().setCustomer(created)
      playSuccessChime()
      hapticSuccess()
      toastSuccess('Customer selected', `${created.full_name} selected for store credit`)
      onClose()
    } catch (err) {
      playErrorTone()
      hapticError()
      toastError('Failed to add customer', String((err as Error)?.message || err))
    } finally {
      setSaving(false)
    }
  }

  const handleSelectCustomer = (c: Customer) => {
    usePosCart.getState().setCustomer(c)
    hapticTap()
    toastSuccess('Customer selected', c.full_name)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={showAdd ? 'Add New Customer' : 'Select Customer (Store Credit)'}
      maxWidth="max-w-md"
      footer={
        showAdd ? (
          <div className="flex gap-2 w-full justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">Back to List</button>
            <button
              type="button"
              onClick={() => void handleCreateAndSelect()}
              disabled={saving || !newName.trim()}
              className="btn-primary flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & Select
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                usePosCart.getState().setCustomer(null)
                onClose()
              }}
              className="btn-ghost text-xs"
            >
              Walk-in (Cash / No Credit)
            </button>
            <button type="button" onClick={onClose} className="btn-secondary text-xs">Close</button>
          </div>
        )
      }
    >
      {showAdd ? (
        <form onSubmit={(e) => void handleCreateAndSelect(e)} className="space-y-3">
          <div>
            <label className="label">Full Name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Maria Santos"
              className="input w-full"
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Nickname</label>
              <input
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="e.g. Maria"
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="0917..."
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="label">Credit Limit (₱)</label>
            <input
              type="number"
              min={0}
              step="100"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              className="input w-full"
            />
            <p className="text-[10px] text-slate-500 mt-1">Default ₱1,000. Store credit may exceed limit if approved.</p>
          </div>
        </form>
      ) : (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); void load(e.target.value) }}
                placeholder="Search customer by name or nickname…"
                className="input w-full pl-9 text-sm"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setNewName(q)
                setShowAdd(true)
              }}
              className="btn-primary shrink-0 flex items-center gap-1 text-xs px-3 rounded-xl"
              title="Add New Customer"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {loading && <p className="py-6 text-center text-sm text-slate-500">Loading customers…</p>}
            {!loading && rows.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCustomer(c)}
                className="flex w-full items-center justify-between rounded-xl border border-ink-line/80 bg-ink-900/60 p-2.5 text-left hover:border-brand-500/50 hover:bg-ink-850 active:scale-98 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-white truncate">{c.full_name}</p>
                    {c.nickname && <span className="text-xs text-slate-400">({c.nickname})</span>}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Limit: {money(c.credit_limit_c)} {c.phone ? `· ${c.phone}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className={`text-xs font-black tabular-nums block ${c.balance_c > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {money(c.balance_c)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {c.balance_c > 0 ? 'credit' : 'zero'}
                  </span>
                </div>
              </button>
            ))}

            {!loading && rows.length === 0 && (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-slate-400">No customers found.</p>
                <button
                  type="button"
                  onClick={() => {
                    setNewName(q)
                    setShowAdd(true)
                  }}
                  className="btn-primary text-xs mx-auto flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {q ? `Add "${q}" as New Customer` : 'Add New Customer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
