import { useState } from 'react'
import { Plus, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Category, Product } from '@shared/types'
import { money } from '@shared/format'
import { Modal } from './ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'

interface QuickAddProductModalProps {
  open: boolean
  initialName?: string
  initialBarcode?: string
  categories: Category[]
  onClose: () => void
  onCreated: (product: Product) => void
}

export function QuickAddProductModal({
  open,
  initialName = '',
  initialBarcode = '',
  categories,
  onClose,
  onCreated
}: QuickAddProductModalProps): React.JSX.Element | null {
  const [name, setName] = useState(initialName)
  const [sellingPrice, setSellingPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [stock, setStock] = useState('10')
  const [barcode, setBarcode] = useState(initialBarcode)
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const sPriceNum = parseFloat(sellingPrice) || 0
  const cPriceNum = parseFloat(costPrice) || 0
  const profit = sPriceNum - cPriceNum
  const marginPct = sPriceNum > 0 ? (profit / sPriceNum) * 100 : 0
  const isLoss = cPriceNum > 0 && sPriceNum > 0 && profit < 0

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toastError('Name required', 'Please enter a product name.')
      return
    }
    if (sPriceNum <= 0) {
      toastError('Price required', 'Selling price must be greater than ₱0.')
      return
    }

    setSubmitting(true)
    try {
      const sellingCents = Math.round(sPriceNum * 100)
      const costCents = Math.round(cPriceNum * 100)
      const stockQty = Math.max(0, parseInt(stock, 10) || 0)

      const product = await window.api.products.create({
        category_id: categoryId === '' ? null : Number(categoryId),
        name: trimmed,
        sku: '',
        barcode: barcode.trim() || null,
        description: null,
        base_unit: 'pc',
        purchase_cost_c: costCents,
        default_price_c: sellingCents,
        low_stock_threshold: 5,
        initial_stock_base: stockQty,
        supplier_id: null,
        has_expiration: false,
        expiration_mode: 'NONE',
        expiration_date: null,
        notes: 'Quick added from POS counter',
        units: []
      })

      toastSuccess('Product added', `${product.name} ready for sale!`)
      onCreated(product)
      onClose()
    } catch (err) {
      toastError('Failed to add product', String((err as Error)?.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick Add Product"
      maxWidth="max-w-md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => void handleSave(e)}
            disabled={submitting || !name.trim() || sPriceNum <= 0}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-bold shadow-md shadow-brand-500/20 active:scale-95"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Save & Add to Cart</span>
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
        <div>
          <label className="label text-xs">Product Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Piattos Cheese 85g"
            className="input w-full"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Selling Price (₱) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0.00"
              className="input w-full font-bold text-brand-400"
              required
            />
          </div>
          <div>
            <label className="label text-xs">Cost Price (₱)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
              className="input w-full text-slate-300"
            />
          </div>
        </div>

        {/* Live Profit Preview */}
        {sPriceNum > 0 && (
          <div
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs border ${
              isLoss
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {isLoss ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span className="font-semibold">
                {isLoss ? 'Selling below cost!' : 'Unit Margin:'}
              </span>
            </div>
            <span className="font-bold tabular-nums">
              {money(Math.round(profit * 100))} ({marginPct.toFixed(1)}%)
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Initial Stock</label>
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="10"
              className="input w-full"
            />
          </div>
          <div>
            <label className="label text-xs">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
              className="input w-full"
            >
              <option value="">No Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label text-xs">Barcode (Optional)</label>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or type barcode"
            className="input w-full font-mono text-xs"
          />
        </div>
      </form>
    </Modal>
  )
}
