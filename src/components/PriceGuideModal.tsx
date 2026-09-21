import { useCallback, useEffect, useState } from 'react'
import {
  Search,
  RefreshCw,
  Link2,
  Unlink,
  AlertCircle,
  Package,
  Layers,
  CheckCircle2,
  X
} from 'lucide-react'
import type { PriceReference, PriceSourceType, Product } from '../shared/types'
import { money } from '../shared/format'
import { Modal } from './ui/Modal'
import { ProductImage } from './ui/ProductImage'
import { PriceReferenceCard } from './ui/PriceReferenceCard'
import { toastError, toastSuccess } from '../stores/toast'

interface PriceGuideModalProps {
  open: boolean
  onClose: () => void
  products: Product[]
  onProductsChanged?: () => void
}

export function PriceGuideModal({
  open,
  onClose,
  products,
  onProductsChanged
}: PriceGuideModalProps): React.JSX.Element | null {
  const [references, setReferences] = useState<PriceReference[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<PriceSourceType | 'ALL'>('ALL')
  const [linkFilter, setLinkFilter] = useState<'ALL' | 'LINKED' | 'UNLINKED'>('ALL')
  const [linkingRef, setLinkingRef] = useState<PriceReference | null>(null)
  const [linkingSearch, setLinkingSearch] = useState('')
  const [status, setStatus] = useState<{
    total: number
    last_synced_at: string | null
    is_stale: boolean
    sources: { source_name: string; count: number }[]
  }>({
    total: 0,
    last_synced_at: null,
    is_stale: false,
    sources: []
  })

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, stat] = await Promise.all([
        window.api.priceReferences.search({
          query: searchQuery,
          sourceType: sourceTypeFilter === 'ALL' ? undefined : sourceTypeFilter,
          linkedOnly: linkFilter === 'LINKED',
          unlinkedOnly: linkFilter === 'UNLINKED',
          limit: 100
        }),
        window.api.priceReferences.status()
      ])
      const rows = res?.rows || (res as any)?.references || []
      setReferences(Array.isArray(rows) ? rows : [])
      if (stat) setStatus(stat)
    } catch (e) {
      toastError('Failed to load price references', String((e as Error)?.message || e))
      setReferences([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery, sourceTypeFilter, linkFilter])

  const autoLiveSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      const res = await window.api.priceReferences.sync()
      if (res?.success && res.synced_count > 0) {
        await loadData()
      }
    } catch {
      // Silent non-blocking background live sync
    }
  }, [loadData])

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      if (open) {
        void autoLiveSync()
      }
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [open, autoLiveSync])

  useEffect(() => {
    if (open) {
      void loadData()
      if (typeof navigator === 'undefined' || navigator.onLine) {
        void autoLiveSync()
      }
    }
  }, [open, loadData, autoLiveSync])

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await window.api.priceReferences.sync()
      if (res.is_offline) {
        toastError('Offline Mode', res.message || 'Offline — Showing Last Saved Data')
      } else if (res.success) {
        toastSuccess('Sync Complete', res.message)
      } else {
        toastError('Sync Failed', res.errors.join('; ') || 'Could not synchronize.')
      }
      await loadData()
    } catch (e) {
      toastError('Sync Error', String((e as Error)?.message || e))
    } finally {
      setSyncing(false)
    }
  }

  const handleLinkProduct = async (referenceId: number, productId: number) => {
    try {
      await window.api.priceReferences.link(referenceId, productId)
      toastSuccess('Price reference linked to product')
      setLinkingRef(null)
      await loadData()
      onProductsChanged?.()
    } catch (e) {
      toastError('Linking failed', String((e as Error)?.message || e))
    }
  }

  const handleUnlinkProduct = async (referenceId: number) => {
    try {
      await window.api.priceReferences.unlink(referenceId)
      toastSuccess('Price reference unlinked')
      await loadData()
      onProductsChanged?.()
    } catch (e) {
      toastError('Unlinking failed', String((e as Error)?.message || e))
    }
  }

  if (!open) return null

  const filteredProductsForLinking = (Array.isArray(products) ? products : []).filter((p) => {
    if (!linkingSearch) return true
    const q = linkingSearch.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    )
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="TINDA BANTAY · Market Price Guide"
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-400">
            {status.last_synced_at ? (
              <span>Last synchronized: {status.last_synced_at.slice(0, 16)}</span>
            ) : (
              <span>Not yet synchronized</span>
            )}
            {status.is_stale && (
              <span className="ml-2 text-amber-400 inline-flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Price data may be outdated
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost">
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* TINDA BANTAY Real-Time Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line bg-ink-900/80 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span>LIVE · Price Guide Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span>OFFLINE · Cached Local Data</span>
              </div>
            )}
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              {isOnline
                ? 'Automatic real-time market sync active.'
                : 'Internet disconnected. Showing last saved prices.'}
            </span>
          </div>

          <div className="text-slate-400 text-[11px]">
            {status.last_synced_at ? (
              <span>Last updated: {status.last_synced_at.slice(0, 16)}</span>
            ) : (
              <span>Not yet synchronized</span>
            )}
          </div>
        </div>

        {/* Top Control Bar: Search, Filters, and Sync Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference by name, brand, barcode…"
              className="input w-full pl-9 text-xs"
            />
          </div>

          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value as PriceSourceType | 'ALL')}
            className="input text-xs"
          >
            <option value="ALL">All Sources</option>
            <option value="official">Official (DTI SRP)</option>
            <option value="market">Market Data</option>
            <option value="reference">Reference Catalog</option>
          </select>

          <select
            value={linkFilter}
            onChange={(e) => setLinkFilter(e.target.value as 'ALL' | 'LINKED' | 'UNLINKED')}
            className="input text-xs"
          >
            <option value="ALL">All Links</option>
            <option value="LINKED">Linked to Product</option>
            <option value="UNLINKED">Unlinked</option>
          </select>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary flex items-center gap-1.5 text-xs shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing…' : 'Sync Now'}</span>
          </button>
        </div>

        {/* References List */}
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2 text-brand-400" />
              Loading price references…
            </div>
          ) : references.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-line p-8 text-center text-slate-400">
              <p className="text-sm font-medium">No price references found</p>
              <p className="mt-1 text-xs text-slate-500">
                {searchQuery
                  ? 'Try a different search query or clear the filter.'
                  : 'Tap "Sync Now" to download the latest DTI SRP and market prices.'}
              </p>
            </div>
          ) : (
            references.map((ref) => {
              const linkedProduct = ref.product_id
                ? products.find((p) => p.id === ref.product_id)
                : null
              return (
                <div key={ref.id} className="relative">
                  <PriceReferenceCard
                    reference={ref}
                    currentPriceC={linkedProduct?.default_price_c ?? null}
                    onLink={() => setLinkingRef(ref)}
                    onUnlink={ref.product_id ? () => handleUnlinkProduct(ref.id) : undefined}
                  />
                  {linkedProduct && (
                    <div className="mt-1 flex items-center gap-1.5 px-2 text-[11px] text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        Linked to store product: <strong>{linkedProduct.name}</strong> (Selling:{' '}
                        {money(linkedProduct.default_price_c)})
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Linking Modal */}
      {linkingRef && (
        <Modal
          open={Boolean(linkingRef)}
          onClose={() => setLinkingRef(null)}
          title={`Link to Store Product`}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              Select a store product to link with reference{' '}
              <strong>"{linkingRef.product_name}"</strong>:
            </p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={linkingSearch}
                onChange={(e) => setLinkingSearch(e.target.value)}
                placeholder="Search products…"
                className="input w-full pl-8 text-xs"
              />
            </div>

            <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
              {filteredProductsForLinking.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">No matching products found.</p>
              ) : (
                filteredProductsForLinking.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleLinkProduct(linkingRef.id, p.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left text-xs transition hover:bg-ink-800"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.barcode ? `Barcode: ${p.barcode} · ` : ''}
                        Current: {money(p.default_price_c)}
                      </p>
                    </div>
                    <span className="btn-ghost py-1 px-2 text-[10px] text-brand-400 shrink-0">
                      Link
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setLinkingRef(null)}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
