import { useMemo } from 'react'
import { ExternalLink, Sparkles, AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'
import type { PriceComparisonStatus, PriceReference } from '../../shared/types'
import { money } from '../../shared/format'
import { ProductImage } from './ProductImage'

export interface PriceReferenceCardProps {
  reference: PriceReference
  currentPriceC?: number | null
  onAdoptPrice?: (priceC: number) => void
  onLink?: () => void
  onUnlink?: () => void
  compact?: boolean
}

export function PriceReferenceCard({
  reference,
  currentPriceC,
  onAdoptPrice,
  onLink,
  onUnlink,
  compact = false
}: PriceReferenceCardProps): React.JSX.Element {
  const comparisonStatus: PriceComparisonStatus = useMemo(() => {
    if (currentPriceC === undefined || currentPriceC === null) return 'NO_REFERENCE'

    if (reference.min_price_c !== null && reference.max_price_c !== null) {
      if (currentPriceC < reference.min_price_c) return 'BELOW_RANGE'
      if (currentPriceC > reference.max_price_c) return 'ABOVE_RANGE'
      return 'WITHIN_RANGE'
    }

    if (reference.market_price_c !== null) {
      if (currentPriceC < reference.market_price_c) return 'BELOW_RANGE'
      if (currentPriceC > reference.market_price_c) return 'ABOVE_RANGE'
      return 'WITHIN_RANGE'
    }

    return 'NO_REFERENCE'
  }, [currentPriceC, reference])

  const isStale = useMemo(() => {
    if (!reference.last_synced_at) return true
    const syncTime = new Date(reference.last_synced_at).getTime()
    return Date.now() - syncTime > 30 * 24 * 60 * 60 * 1000
  }, [reference.last_synced_at])

  const sourceBadgeColor = useMemo(() => {
    switch (reference.source_type) {
      case 'official':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'market':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'reference':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }, [reference.source_type])

  const comparisonBadge = useMemo(() => {
    if (comparisonStatus === 'WITHIN_RANGE') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Within Market Range
        </span>
      )
    }
    if (comparisonStatus === 'BELOW_RANGE') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
          <TrendingDown className="h-3 w-3" /> Below Market Range
        </span>
      )
    }
    if (comparisonStatus === 'ABOVE_RANGE') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
          <TrendingUp className="h-3 w-3" /> Above Market Range
        </span>
      )
    }
    return null
  }, [comparisonStatus])

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-line bg-ink-900/40 p-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <ProductImage
            src={reference.image_path || reference.image_url}
            alt={reference.product_name}
            className="h-8 w-8 rounded"
          />
          <div className="min-w-0 truncate">
            <p className="font-medium text-slate-200 truncate">{reference.product_name}</p>
            <p className="text-[10px] text-slate-400">
              Ref: {reference.market_price_c !== null ? money(reference.market_price_c) : 'N/A'}
              {reference.min_price_c !== null && reference.max_price_c !== null && (
                <span> ({money(reference.min_price_c)} - {money(reference.max_price_c)})</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {comparisonBadge}
          {onAdoptPrice && reference.market_price_c !== null && (
            <button
              type="button"
              onClick={() => onAdoptPrice(reference.market_price_c!)}
              className="btn-ghost py-0.5 px-2 text-[10px] text-brand-400 hover:text-brand-300"
              title="Set selling price to market reference price"
            >
              Adopt {money(reference.market_price_c)}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-line bg-ink-900/60 p-3.5 sm:p-4 text-xs transition hover:border-ink-line/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ProductImage
            src={reference.image_path || reference.image_url}
            alt={reference.product_name}
            className="h-12 w-12 rounded-lg"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-slate-100 truncate">
                {reference.product_name}
              </h4>
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-medium uppercase ${sourceBadgeColor}`}
              >
                {reference.source_type}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap mt-0.5">
              {reference.brand && <span>Brand: {reference.brand}</span>}
              {reference.variant && <span>Variant: {reference.variant}</span>}
              {reference.unit && <span>Unit: {reference.unit}</span>}
              {reference.barcode && <span>Barcode: {reference.barcode}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onLink && (
            <button
              type="button"
              onClick={onLink}
              className="btn-ghost py-1 px-2.5 text-xs text-brand-400 hover:text-brand-300"
            >
              Link to Product
            </button>
          )}
          {onUnlink && (
            <button
              type="button"
              onClick={onUnlink}
              className="btn-ghost py-1 px-2.5 text-xs text-rose-400 hover:text-rose-300"
            >
              Unlink
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-ink-800/40 p-2.5 sm:grid-cols-4 sm:p-3">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
            Market Reference
          </span>
          <span className="text-sm font-bold text-emerald-400">
            {reference.market_price_c !== null ? money(reference.market_price_c) : '—'}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
            SRP / Price Range
          </span>
          <span className="text-sm font-semibold text-slate-200">
            {reference.min_price_c !== null && reference.max_price_c !== null
              ? `${money(reference.min_price_c)} – ${money(reference.max_price_c)}`
              : '—'}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
            Current Price
          </span>
          <span className="text-sm font-semibold text-slate-200">
            {currentPriceC !== undefined && currentPriceC !== null ? money(currentPriceC) : '—'}
          </span>
        </div>

        <div className="flex items-center">
          {comparisonBadge || (
            <span className="text-[11px] text-slate-500">No comparison available</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-ink-line/50 pt-2 flex-wrap">
        <div className="flex items-center gap-3">
          <span>Source: {reference.source_name}</span>
          {reference.source_url && (
            <a
              href={reference.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-brand-400 hover:underline"
            >
              View source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isStale && (
            <span className="inline-flex items-center gap-1 text-amber-400 text-[10px]">
              <AlertCircle className="h-3 w-3" /> May be outdated
            </span>
          )}
          {onAdoptPrice && reference.market_price_c !== null && (
            <button
              type="button"
              onClick={() => onAdoptPrice(reference.market_price_c!)}
              className="inline-flex items-center gap-1 rounded bg-brand-600/20 px-2 py-1 text-xs font-semibold text-brand-400 hover:bg-brand-600/30 active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" /> Adopt {money(reference.market_price_c)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
