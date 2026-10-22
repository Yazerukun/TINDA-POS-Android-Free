import { useState, useRef } from 'react'
import {
  Database,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Users,
  Receipt,
  ShieldCheck,
  ChevronRight,
  Info,
  X,
  Sparkles
} from 'lucide-react'
import { Modal } from './ui/Modal'
import {
  inspectDatabaseFile,
  executeDesktopMigration,
  type DatabaseInspection,
  type MigrationMode,
  type MigrationProgress,
  type MigrationSummary
} from '../services/desktopMigrationService'
import { toastSuccess, toastError } from '../stores/toast'
import { playSuccessChime, hapticSuccess, playErrorTone, hapticError } from '../lib/feedback'

interface DesktopMigrationModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function DesktopMigrationModal({
  open,
  onClose,
  onSuccess
}: DesktopMigrationModalProps): React.JSX.Element | null {
  const [step, setStep] = useState<'SELECT' | 'PREVIEW' | 'MIGRATING' | 'SUMMARY'>('SELECT')
  const [inspection, setInspection] = useState<DatabaseInspection | null>(null)
  const [mode, setMode] = useState<MigrationMode>('SMART_MERGE')
  const [progress, setProgress] = useState<MigrationProgress>({ stage: 'PARSING', percent: 0, message: '' })
  const [summary, setSummary] = useState<MigrationSummary | null>(null)
  const [parsing, setParsing] = useState(false)
  const [showLocationTip, setShowLocationTip] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setStep('SELECT')
    setInspection(null)
    setSummary(null)
    setParsing(false)
    setProgress({ stage: 'PARSING', percent: 0, message: '' })
  }

  const handleClose = () => {
    if (step === 'MIGRATING') return
    reset()
    onClose()
  }

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setParsing(true)
    try {
      const res = await inspectDatabaseFile(file)
      setInspection(res)
      setStep('PREVIEW')
      hapticSuccess()
    } catch (err: any) {
      playErrorTone()
      hapticError()
      toastError('Database inspection failed', err?.message || 'Could not parse database file.')
    } finally {
      setParsing(false)
    }
  }

  const handleStartMigration = async () => {
    if (!inspection) return

    setStep('MIGRATING')
    setProgress({ stage: 'PARSING', percent: 15, message: 'Preparing migration engine...' })

    try {
      const res = await executeDesktopMigration(inspection, mode, (p) => {
        setProgress(p)
      })
      setSummary(res)
      setStep('SUMMARY')
      playSuccessChime()
      hapticSuccess()
      toastSuccess('Desktop database migrated', `Processed ${res.counts.products.total} products.`)
    } catch (err: any) {
      playErrorTone()
      hapticError()
      toastError('Migration failed', err?.message || 'Error executing migration.')
      setStep('PREVIEW')
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024
      i++
    }
    return `${n.toFixed(1)} ${units[i]}`
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title=""
      maxWidth="max-w-xl"
    >
      <div className="p-1">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-950 tracking-tight">Desktop Database Migration</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  VIP Feature
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Import <code className="text-emerald-700 font-bold">tindapos.db</code> SQLite or Universal Backup
              </p>
            </div>
          </div>
          {step !== 'MIGRATING' && (
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Step 1: Select / Drop File */}
        {step === 'SELECT' && (
          <div className="pt-4 space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-400/80 bg-emerald-50/60 hover:bg-emerald-50 rounded-2xl p-6 text-center cursor-pointer transition active:scale-[0.99] flex flex-col items-center justify-center space-y-3 shadow-sm"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".db,.sqlite,.sqlite3,.tinda-backup,application/json,*/*"
                className="hidden"
                onChange={handleFilePicked}
              />
              <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">Tap to Select Desktop Database File</p>
                <p className="text-xs text-slate-600 mt-1">
                  Supports <span className="font-bold text-emerald-800">tindapos.db</span>, <span className="font-bold text-emerald-800">.sqlite</span>, or <span className="font-bold text-emerald-800">.tinda-backup</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-white px-3 py-1 rounded-full border border-emerald-200 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>WebAssembly SQLite Parser • 100% Offline</span>
              </div>
            </div>

            {/* How to find Desktop tindapos.db Tip */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
              <button
                onClick={() => setShowLocationTip(!showLocationTip)}
                className="flex items-center justify-between w-full font-bold text-slate-800 text-left"
              >
                <span className="flex items-center gap-1.5 text-slate-900">
                  <Info className="h-4 w-4 text-emerald-600" /> Where do I get my Desktop database file?
                </span>
                <span className="text-slate-500 font-normal">{showLocationTip ? 'Hide' : 'Show details'}</span>
              </button>

              {showLocationTip && (
                <div className="pt-2 text-slate-600 space-y-2 text-[11px] leading-relaxed border-t border-slate-200">
                  <p>
                    <strong className="text-slate-900">Method 1 (Direct SQLite file):</strong> On your Windows PC, press{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-slate-800">Win + R</kbd>, paste{' '}
                    <code className="text-emerald-800 font-mono font-bold select-all bg-emerald-50 px-1 py-0.5 rounded">%APPDATA%\tinda-pos</code>, and copy{' '}
                    <strong className="text-slate-900">tindapos.db</strong> to your tablet (via USB cable, Google Drive, or Bluetooth).
                  </p>
                  <p>
                    <strong className="text-slate-900">Method 2 (Universal Backup):</strong> In Windows TINDA POS, go to{' '}
                    <strong className="text-slate-900">Settings &gt; Backup</strong> and tap <strong className="text-slate-900">Export Backup</strong> to get a <code className="text-emerald-800 font-mono font-bold">.tinda-backup</code> file.
                  </p>
                </div>
              )}
            </div>

            {parsing && (
              <div className="flex items-center justify-center gap-2 py-4 text-emerald-700 text-xs font-bold animate-pulse">
                <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing database structure...
              </div>
            )}
          </div>
        )}

        {/* Step 2: Inspection Preview & Mode Selection */}
        {step === 'PREVIEW' && inspection && (
          <div className="pt-4 space-y-4">
            {/* Store & File Overview */}
            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Source Store</span>
                  <h3 className="text-base font-black text-slate-950">{inspection.storeName}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{inspection.type === 'SQLITE' ? 'SQLite 3 Binary' : 'Universal Backup'}</span>
                  <p className="text-xs font-mono font-bold text-slate-800">{formatBytes(inspection.fileSizeBytes)}</p>
                </div>
              </div>

              {/* Data counts grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200">
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100 shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Products
                  </div>
                  <p className="text-lg font-black text-slate-950 mt-0.5">{inspection.productCount}</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100 shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                    <Layers className="h-3.5 w-3.5 text-emerald-600" /> Categories
                  </div>
                  <p className="text-lg font-black text-slate-950 mt-0.5">{inspection.categoryCount}</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100 shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                    <Users className="h-3.5 w-3.5 text-emerald-600" /> Customers
                  </div>
                  <p className="text-lg font-black text-slate-950 mt-0.5">{inspection.customerCount}</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100 shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                    <Receipt className="h-3.5 w-3.5 text-emerald-600" /> Sales
                  </div>
                  <p className="text-lg font-black text-slate-950 mt-0.5">{inspection.saleCount}</p>
                </div>
              </div>
            </div>

            {/* Migration Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-900 tracking-wide uppercase">Select Migration Mode:</label>

              {/* Option 1: Smart Merge */}
              <div
                onClick={() => setMode('SMART_MERGE')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  mode === 'SMART_MERGE'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  mode === 'SMART_MERGE' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                }`}>
                  {mode === 'SMART_MERGE' && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-950">Smart Merge &amp; Sync</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Merges products, prices, categories, and customer balances into this device without deleting your existing mobile sales.
                  </p>
                </div>
              </div>

              {/* Option 2: Full Restore Replace */}
              <div
                onClick={() => setMode('RESTORE_REPLACE')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  mode === 'RESTORE_REPLACE'
                    ? 'border-amber-600 bg-amber-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  mode === 'RESTORE_REPLACE' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                }`}>
                  {mode === 'RESTORE_REPLACE' && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-950">Full Database Restore</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Switching to Tablet
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Completely replaces mobile data with your Desktop store. An automatic rollback safety backup is generated first.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                className="btn-ghost flex-1 py-3 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Choose Another File
              </button>
              <button
                type="button"
                onClick={handleStartMigration}
                className="btn-primary flex-1 py-3 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5"
              >
                <span>Start Migration</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Migration In Progress */}
        {step === 'MIGRATING' && (
          <div className="py-8 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-700 flex items-center justify-center mx-auto animate-pulse">
              <RefreshCw className="h-7 w-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-950">Migrating Desktop Database</h3>
              <p className="text-xs font-semibold text-emerald-700">{progress.message || 'Processing records...'}</p>
            </div>

            {/* Progress Bar */}
            <div className="max-w-xs mx-auto">
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500 mt-1 block">{progress.percent}%</span>
            </div>

            <p className="text-[11px] text-slate-500 italic max-w-sm mx-auto">
              Please keep TINDA POS open while tables and product catalogs are synchronized.
            </p>
          </div>
        )}

        {/* Step 4: Summary Report */}
        {step === 'SUMMARY' && summary && (
          <div className="pt-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-slate-950">Migration Successful!</h3>
              <p className="text-xs text-slate-600 font-medium">
                Your Desktop data is now active and ready on this mobile/tablet device.
              </p>
            </div>

            {/* Results Grid */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Migration Summary</span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[11px]">Products:</span>
                  <p className="font-black text-slate-900 mt-0.5">
                    {summary.counts.products.total} total
                    {summary.counts.products.added > 0 && <span className="text-emerald-700 font-bold text-[10px] ml-1">({summary.counts.products.added} new)</span>}
                  </p>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[11px]">Categories:</span>
                  <p className="font-black text-slate-900 mt-0.5">
                    {summary.counts.categories.total} categories
                  </p>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[11px]">Customers &amp; Utang:</span>
                  <p className="font-black text-slate-900 mt-0.5">
                    {summary.counts.customers.total} customers
                  </p>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[11px]">Sales Transactions:</span>
                  <p className="font-black text-slate-900 mt-0.5">
                    {summary.counts.sales.total} recorded
                  </p>
                </div>
              </div>

              {summary.safetyBackupFilename && summary.safetyBackupFilename !== 'none' && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Rollback safety backup saved:{' '}
                    <code className="text-emerald-800 font-mono font-bold text-[10px]">{summary.safetyBackupFilename}</code>
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onSuccess?.()
                handleClose()
              }}
              className="btn-primary w-full py-3 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
            >
              Done — Return to Store
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
