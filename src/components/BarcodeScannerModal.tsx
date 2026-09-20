import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, X, Flashlight, FlashlightOff, AlertCircle, ScanLine } from 'lucide-react'
import { playScanBeep, playErrorTone, hapticScan, hapticError } from '../lib/feedback'

interface BarcodeScannerModalProps {
  open: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  title?: string
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>
      }
      getSupportedFormats?: () => Promise<string[]>
    }
  }
}

export function BarcodeScannerModal({
  open,
  onClose,
  onScan,
  title = 'Scan Barcode'
}: BarcodeScannerModalProps): React.JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const scanLockRef = useRef(false)

  // Start Camera
  useEffect(() => {
    if (!open) return
    let active = true
    scanLockRef.current = false
    setLastScanned(null)
    setErrorMsg(null)

    async function initCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported on this device.')
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })

        if (!active) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }

        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play()
        }

        // Check torch capability
        const track = mediaStream.getVideoTracks()[0]
        if (track) {
          const capabilities = (track.getCapabilities?.() as { torch?: boolean }) || {}
          if (capabilities.torch) {
            setHasTorch(true)
          }
        }
      } catch (err) {
        if (!active) return
        const msg = (err as Error)?.message || 'Unable to access camera.'
        setErrorMsg(msg)
      }
    }

    void initCamera()

    return () => {
      active = false
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [open])

  // Stop camera when stream changes or unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [stream])

  // Barcode Detection Loop
  useEffect(() => {
    if (!open || !stream || errorMsg) return

    let animationId: number
    let detector: any = null

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && window.BarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({
          formats: [
            'code_128',
            'code_39',
            'code_93',
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'qr_code',
            'data_matrix'
          ]
        })
      } catch {
        detector = null
      }
    }

    let intervalId: number | null = null

    const checkBarcode = async () => {
      if (scanLockRef.current || !videoRef.current || !detector) return
      const video = videoRef.current
      if (video.readyState < 2) return

      try {
        const barcodes = await detector.detect(video)
        if (barcodes && barcodes.length > 0) {
          const raw = barcodes[0].rawValue?.trim()
          if (raw && !scanLockRef.current) {
            scanLockRef.current = true
            setLastScanned(raw)
            playScanBeep()
            hapticScan()
            setTimeout(() => {
              onScan(raw)
              onClose()
            }, 300)
          }
        }
      } catch {
        // detection frame error
      }
    }

    if (detector) {
      intervalId = window.setInterval(() => {
        void checkBarcode()
      }, 150)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [open, stream, errorMsg, onScan, onClose])

  const toggleTorch = async () => {
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    if (!track) return
    try {
      const nextTorch = !torchOn
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      })
      setTorchOn(nextTorch)
    } catch {
      // torch error
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) {
      playErrorTone()
      hapticError()
      return
    }
    playScanBeep()
    hapticScan()
    onScan(code)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95 text-white backdrop-blur-md animate-pop">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-ink-950/80 safe-pt">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-brand-400" />
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={() => void toggleTorch()}
              className={`rounded-full p-2.5 transition active:scale-95 ${torchOn ? 'bg-amber-400 text-ink-950' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
            >
              {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Viewfinder Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {errorMsg ? (
          <div className="mx-6 max-w-sm rounded-2xl border border-red-500/30 bg-ink-900/90 p-6 text-center shadow-xl">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-400" />
            <h3 className="text-lg font-bold text-white mb-1">Camera Unavailable</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
            <p className="text-xs text-slate-500">You can type or paste the barcode manually below.</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Viewfinder Reticle with Laser Animation */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative h-60 w-72 sm:w-80 rounded-2xl border-2 border-dashed border-white/40 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] overflow-hidden">
                {/* Laser Sweep Line */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-laser-sweep" />

                {/* Corner Accents */}
                <div className="absolute top-0 left-0 h-6 w-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 h-6 w-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {lastScanned && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/80 backdrop-blur-xs">
                    <span className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-bold text-white shadow-lg animate-pop">
                      {lastScanned}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-4 rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-xs">
                Align barcode or QR code within frame
              </p>
            </div>
          </>
        )}
      </div>

      {/* Manual Fallback & Footer */}
      <div className="border-t border-white/10 bg-ink-950/90 p-4 safe-pb">
        <form onSubmit={handleManualSubmit} className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Or enter barcode manually…"
            className="input flex-1 h-12 !text-base bg-ink-900/90 border-white/15 focus:border-brand-400"
          />
          <button
            type="submit"
            className="btn-primary min-h-12 px-5 font-bold shrink-0"
          >
            Enter
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
