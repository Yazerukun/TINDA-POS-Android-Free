import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'

export function productImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath || !imagePath.trim()) return null
  return imagePath
}

export function ProductImage({
  src,
  alt,
  className = 'h-10 w-10 rounded-lg',
  fallbackIconClass = 'h-5 w-5 text-slate-500'
}: {
  src?: string | null
  alt: string
  className?: string
  fallbackIconClass?: string
}): React.JSX.Element {
  const [imgSrc, setImgSrc] = useState<string | null>(() => productImageUrl(src))
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setImgSrc(productImageUrl(src))
    setHasError(false)
  }, [src])

  const handleError = () => {
    setHasError(true)
  }

  if (!imgSrc || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-ink-800 border border-ink-line shrink-0 overflow-hidden ${className}`}
      >
        <Package className={fallbackIconClass} />
      </div>
    )
  }

  return (
    <div className={`shrink-0 overflow-hidden bg-ink-800 border border-ink-line ${className}`}>
      <img
        src={imgSrc}
        alt={alt}
        className="h-full w-full object-cover"
        onError={handleError}
        loading="lazy"
      />
    </div>
  )
}
