import { useEffect, useState } from 'react'
import { FileDown, BarChart3, Printer, LockKeyhole, Coins, Eye, RefreshCw, Share2 } from 'lucide-react'
import type { SalesReportRow, ReportSummary, ReadReport, ZRead, CashCountRecord } from '@shared/types'
import { cashCountLines, CASH_COUNT_DENOMINATION_CENTS } from '@shared/cashCount'
import { readReportLines } from '@shared/readReport'
import { money, shortDate, todayKey } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { ReceiptPaper } from '../components/ReceiptPaper'
import { SalesChart } from '../components/SalesChart'
import { Modal } from '../components/ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'
import { useAuth } from '../stores/auth'
import { useSettings } from '../stores/settings'

interface CompState {
  rows: SalesReportRow[]
  summary: ReportSummary
  chart: { label: string; total_c: number; profit_c: number }[]
}

export function Reports(): React.JSX.Element {
  const [from, setFrom] = useState(() => todayKey())
  const [to, setTo] = useState(() => todayKey())
  const [groupBy, setGroupBy] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY')
  const [data, setData] = useState<CompState | null>(null)
  const [tab, setTab] = useState<'SALES' | 'INVENTORY' | 'UTANG' | 'X' | 'Z' | 'ZHISTORY' | 'CASHCOUNT'>('SALES')
  const [inv, setInv] = useState<{ rows: { name: string; stock: number; base_unit: string; inventory_value_c: number }[]; summary: { total_units: number; inventory_value_c: number; low_stock: number; out_of_stock: number } } | null>(null)
  const [utang, setUtang] = useState<{ rows: { full_name: string; balance_c: number; credit_limit_c: number }[]; total_outstanding_c: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [read, setRead] = useState<ReadReport | null>(null)
  const [history, setHistory] = useState<ZRead[]>([])
  const [readError, setReadError] = useState<string | null>(null)
  const [readRevision, setReadRevision] = useState(0)

  useEffect(() => {
    if (tab !== 'X') return
    let alive = true
    let sequence = 0
    const refresh = async () => {
      const request = ++sequence
      try {
        const result = await window.api.reports.xRead()
        if (!alive || request !== sequence) return
        setRead(result)
        setReadError(null)
      } catch (error) {
        if (!alive || request !== sequence) return
        setRead(null)
        setReadError(String((error as Error)?.message || error))
      }
    }
    setRead(null)
    const reload = () => { void refresh() }
    reload()
    const unsubscribe = window.api.inventory.onChanged(reload)
    window.addEventListener('focus', reload)
    const timer = window.setInterval(reload, 15000)
    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener('focus', reload)
      window.clearInterval(timer)
    }
  }, [tab, readRevision])

  const loadSales = async () => {
    setLoading(true)
    try {
      const res = await window.api.reports.sales({ from, to, groupBy })
      setData(res)
    } catch (e) { toastError('Failed to load report', String((e as Error)?.message || e)) } finally { setLoading(false) }
  }
  const loadInv = async () => {
    setLoading(true)
    try { setInv(await window.api.reports.inventory()) } catch (e) { toastError('Failed to load', String((e as Error)?.message || e)) } finally { setLoading(false) }
  }
  const loadUtang = async () => {
    setLoading(true)
    try { setUtang(await window.api.reports.utang()) } catch (e) { toastError('Failed to load', String((e as Error)?.message || e)) } finally { setLoading(false) }
  }

  // Loaders are redefined per render; this effect intentionally keys on tab and
  // (re)loads only when the active report changes, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'SALES') void loadSales(); else if (tab === 'INVENTORY') void loadInv(); else if (tab === 'UTANG') void loadUtang(); else if (tab === 'Z') void window.api.reports.xRead().then(setRead).catch(e=>{setRead(null);toastError('No open shift',String((e as Error).message||e))}); else if (tab === 'ZHISTORY') void window.api.reports.zHistory().then(setHistory) }, [tab])

  const exportCsv = async () => {
    try {
      const kind = tab === 'SALES' ? 'SALES' : tab === 'INVENTORY' ? 'INVENTORY' : 'UTANG'
      const res = await window.api.reports.exportCsv(kind, { from, to })
      toastSuccess('Export saved', res.path)
    } catch (e) { toastError('Export failed', String((e as Error)?.message || e)) }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Reports"
        actions={(['SALES','INVENTORY','UTANG'] as const).includes(tab as 'SALES'|'INVENTORY'|'UTANG') ? <button onClick={() => void exportCsv()} className="btn-primary flex items-center gap-2"><FileDown className="h-4 w-4" /> Export CSV</button> : undefined}
      />

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'SALES', label: 'Sales' },
          { id: 'INVENTORY', label: 'Inventory' },
          { id: 'UTANG', label: 'Utang' },
          { id: 'X', label: 'X-Read' },
          { id: 'Z', label: 'Z-Read' },
          { id: 'ZHISTORY', label: 'Z-Read History' },
          { id: 'CASHCOUNT', label: <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5"/> Cash Count</span> }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? 'border-brand-500/50 bg-brand-600/20 text-brand-300' : 'border-ink-line bg-ink-850 text-slate-300 hover:bg-ink-800 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'SALES' && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div><label className="label">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-44" /></div>
            <div><label className="label">To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-44" /></div>
            <div><label className="label">Group by</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as never)} className="input w-40">
                <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <button onClick={() => void loadSales()} className="btn-primary">Run</button>
          </div>

          {loading ? <div className="h-40 animate-pulse card" /> : data ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                <Stat label="Sales" v={money(data.summary.sales_total_c)} />
                <Stat label="Profit" v={money(data.summary.profit_c)} />
                <Stat label="Cost" v={money(data.summary.cost_c)} />
                <Stat label="Discounts" v={money(data.summary.discount_c)} />
                <Stat label="Transactions" v={String(data.summary.transactions)} />
              </div>
              <div className="card mb-4 overflow-hidden">
                <table className="table">
                  <thead><tr><th>Receipt</th><th>Date</th><th>Cashier</th><th>Method</th><th className="text-right">Total</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.sale_id}>
                        <td className="font-medium text-brand-400">{r.transaction_no}</td>
                        <td className="text-slate-400">{shortDate(r.created_at)}</td>
                        <td className="text-slate-300">{r.cashier}</td>
                        <td className="text-slate-400">{r.method}</td>
                        <td className="text-right font-bold text-white tabular-nums">{money(r.total_c)}</td>
                        <td><span className="badge bg-ink-700 text-slate-300">{r.status}</span></td>
                      </tr>
                    ))}
                    {data.rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No sales in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
              <SalesChart data={data.chart} />
            </>
          ) : null}
        </>
      )}

      {tab === 'INVENTORY' && (loading ? <div className="h-40 animate-pulse card" /> : inv ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Total Units" v={String(inv.summary.total_units)} />
            <Stat label="Stock Value" v={money(inv.summary.inventory_value_c)} />
            <Stat label="Low Stock" v={String(inv.summary.low_stock)} />
            <Stat label="Out of Stock" v={String(inv.summary.out_of_stock)} />
          </div>
          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>Product</th><th className="text-right">Stock</th><th className="text-right">Unit Value</th><th className="text-right">Total Value</th></tr></thead>
              <tbody>
                {inv.rows.map((p, i) => (
                  <tr key={i}>
                    <td className="text-slate-200">{p.name}</td>
                    <td className="text-right text-slate-300 tabular-nums">{p.stock} {p.base_unit}</td>
                    <td colSpan={2}></td>
                  </tr>
                ))}
                {inv.rows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-500">No products.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : null)}

      {tab === 'X' && !read && <div role="status"><p>{readError ? 'Hindi ma-load ang X-Read. Tiyaking may bukas na shift sa account na ito.' : 'Loading X-Read...'}</p>{readError && <><p className="mt-2 text-sm text-slate-400">{readError}</p><button className="btn-ghost mt-3" title="Refresh X-Read" onClick={()=>setReadRevision(n=>n+1)}><RefreshCw className="h-4 w-4"/></button></>}</div>}
      {(tab === 'X' || tab === 'Z') && read && <ReadPanel key={`${tab}-${read.shift_id}`} report={read} finalize={tab === 'Z'} onUpdate={setRead} onRefresh={()=>setReadRevision(n=>n+1)} onFinalized={()=>{setRead(null);setTab('ZHISTORY')}} onCashCount={()=>setTab('CASHCOUNT')}/>}
      {tab === 'ZHISTORY' && <div className="card overflow-hidden"><table className="table"><thead><tr><th>Report</th><th>Finalized</th><th>Cashier</th><th>Net Sales</th><th></th></tr></thead><tbody>{history.map(z=><tr key={z.id}><td>{z.report_no}</td><td>{shortDate(z.finalized_at)}</td><td>{z.snapshot.cashier_name}</td><td className="tabular-nums">{money(z.snapshot.net_sales_c)}</td><td><button className="btn-ghost flex gap-1" onClick={()=>void window.api.reports.printZRead(z.id)}><Printer className="h-4 w-4"/>Print</button></td></tr>)}{history.length===0&&<tr><td colSpan={5} className="py-8 text-center text-slate-500">No finalized Z-Reads yet.</td></tr>}</tbody></table></div>}
      {tab === 'CASHCOUNT' && <CashCountPanel />}

      {tab === 'UTANG' && (loading ? <div className="h-40 animate-pulse card" /> : utang ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat label="Total Outstanding" v={money(utang.total_outstanding_c)} />
            <Stat label="Customers" v={String(utang.rows.length)} />
          </div>
          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>Customer</th><th className="text-right">Limit</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {utang.rows.map((c, i) => (
                  <tr key={i}>
                    <td className="text-slate-200">{c.full_name}</td>
                    <td className="text-right text-slate-400 tabular-nums">{money(c.credit_limit_c)}</td>
                    <td className={`text-right font-bold tabular-nums ${c.balance_c > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{money(c.balance_c)}</td>
                  </tr>
                ))}
                {utang.rows.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate-500">No outstanding balances.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : null)}
    </div>
  )
}

function CashCountPanel(): React.JSX.Element {
  const labels = ['₱1,000 bill','₱500 bill','₱200 bill','₱100 bill','₱50 bill','₱20 bill','₱20 coin','₱10 coin','₱5 coin','₱1 coin','₱0.25 coin']
  const [q,setQ]=useState<number[]>(()=>Array(11).fill(0)); const [expected,setExpected]=useState(0); const [notes,setNotes]=useState(''); const [saved,setSaved]=useState<CashCountRecord[]>([]); const [lastSaved,setLastSaved]=useState<CashCountRecord|null>(null); const [preview,setPreview]=useState<CashCountRecord|null>(null); const [busy,setBusy]=useState(false)
  const den=CASH_COUNT_DENOMINATION_CENTS; const actual=q.reduce((s,n,i)=>s+n*(den[i]??0),0); const diff=actual-expected; const status=diff===0?'BALANCED':diff>0?'OVER':'SHORT'
  const { settings } = useSettings(); const { user } = useAuth()
  const storeName=settings?.store_name ?? ''; const cashierName=user?.full_name || user?.username || ''
  useEffect(()=>{void window.api.reports.cashCountExpected().then(r=>setExpected(r.expected_cash_c)).catch(()=>setExpected(0)); void window.api.reports.cashCounts().then(rows=>setSaved(rows))},[])
  const tallyPreview=():CashCountRecord=>({id:0,shift_id:0,user_id:0,cashier_name:cashierName,business_date:todayKey(),starting_cash_c:expected,expected_cash_c:expected,actual_cash_c:actual,difference_c:diff,status,denominations:q,notes:notes||null,created_at:new Date().toLocaleString('en-PH')})
  const save=async()=>{try{const rec=await window.api.reports.cashCount({quantities:q,notes});toastSuccess('Cash Count saved');setLastSaved(rec);setSaved(await window.api.reports.cashCounts())}catch(e){toastError('Cash Count failed',String((e as Error).message||e))}}
  const printRecord=async(rec:CashCountRecord)=>{setBusy(true);try{const res=await window.api.reports.cashCountPrint(rec.id);if(res.ok){toastSuccess(res.message)}else{toastError('Unable to print Cash Count. The Cash Count was saved successfully. You can try printing it again from Cash Count History.',res.message)}}catch(e){toastError('Unable to print Cash Count. The Cash Count was saved successfully. You can try printing it again from Cash Count History.',String((e as Error).message||e))}finally{setBusy(false)}}
  return <div><div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3"><Stat label="Expected Cash" v={money(expected)}/><Stat label="Actual Cash" v={money(actual)}/><Stat label={`Difference · ${status}`} v={money(diff)}/></div><div className="card p-4"><h3 className="mb-3 font-bold">Count bills and coins</h3>{labels.map((l,i)=><div className="mb-2 grid grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)] items-center gap-3" key={l}><span className="whitespace-nowrap text-left text-sm font-medium text-slate-200 select-none">{l}</span><input className="input h-10 w-full min-h-0 text-center font-bold tabular-nums px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" type="number" inputMode="numeric" min="0" step="1" value={q[i]??0} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0){const a=[...q];a[i]=n;setQ(a)}}}/><span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums pr-2 text-slate-100">{money((q[i]??0)*(den[i]??0))}</span></div>)}<textarea className="input mt-3 w-full" placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)}/><div className="mt-3 flex flex-wrap gap-2"><button className="btn-primary" onClick={()=>void save()}>Save Cash Count</button><button className="btn-primary flex items-center gap-1" disabled={busy} onClick={()=>lastSaved?void printRecord(lastSaved):null} title={lastSaved?'Print the last saved Cash Count':'Save a cash count first to print it'}><Printer className="h-4 w-4"/>Print</button><button className="btn-ghost flex items-center gap-1" onClick={()=>setPreview(tallyPreview())}><Eye className="h-4 w-4"/>Print Preview</button></div><p className="mt-2 text-xs text-slate-500">Print prints the last saved Cash Count using the configured receipt printer. Preview shows exactly what the printer receives.</p></div><div className="card mt-4 overflow-hidden"><h3 className="p-4 font-bold">Cash Count History</h3><table className="table"><thead><tr><th>Date</th><th>Cashier</th><th>Expected</th><th>Actual</th><th>Status</th><th></th></tr></thead><tbody>{saved.map((r)=><tr key={r.id}><td>{shortDate(r.created_at)}</td><td>{r.cashier_name}</td><td className="tabular-nums">{money(r.expected_cash_c)}</td><td className="tabular-nums">{money(r.actual_cash_c)}</td><td><span className={`badge border ${r.status==='BALANCED'?'border-emerald-500/30 text-emerald-400':r.status==='OVER'?'border-brand-500/30 text-brand-300':'border-amber-500/30 text-amber-400'}`}>{r.status}</span></td><td><div className="flex gap-1"><button className="btn-ghost flex items-center gap-1" onClick={()=>setPreview(r)}><Eye className="h-4 w-4"/>View</button><button className="btn-ghost flex items-center gap-1" disabled={busy} onClick={()=>void printRecord(r)}><Printer className="h-4 w-4"/>Print</button></div></td></tr>)}<tr>{saved.length===0&&<td colSpan={6} className="py-8 text-center text-slate-500">No cash counts saved yet.</td>}</tr></tbody></table></div>{preview && (
  <Modal open onClose={() => setPreview(null)} title="Cash Count Print Preview" maxWidth="max-w-md" footer={
    <div className="flex flex-wrap items-center justify-end gap-2 w-full">
      <button type="button" onClick={() => void window.api.printer.shareReceipt?.(cashCountLines({ ...preview, store_name: storeName }), 'Cash Count Report')} className="btn-ghost flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Share</button>
      {preview.id > 0 ? (
        <button type="button" disabled={busy} onClick={() => void printRecord(preview)} className="btn-primary flex items-center gap-1.5"><Printer className="h-4 w-4" /> Print</button>
      ) : lastSaved ? (
        <button type="button" disabled={busy} onClick={() => void printRecord(lastSaved)} className="btn-primary flex items-center gap-1.5"><Printer className="h-4 w-4" /> Print Saved</button>
      ) : null}
      <button type="button" onClick={() => setPreview(null)} className="btn-ghost">Close</button>
    </div>
  }>
    <ReceiptPaper lines={cashCountLines({ ...preview, store_name: storeName })} />
  </Modal>
)}</div>
}

function ReadPanel({report,finalize,onFinalized,onCashCount,onUpdate,onRefresh}:{report:ReadReport;finalize:boolean;onFinalized:()=>void;onCashCount:()=>void;onUpdate:(report:ReadReport)=>void;onRefresh:()=>void}):React.JSX.Element {
  const [actual,setActual]=useState(String(report.expected_cash_c/100)); const [busy,setBusy]=useState(false)
  const [reminder,setReminder]=useState(false)
  const [preview, setPreview] = useState<ReadReport | null>(null)
  const { settings } = useSettings()
  const showPreview = async () => {
    setBusy(true)
    try {
      const latest = await window.api.reports.xRead()
      onUpdate(latest)
      setPreview(latest)
    } catch (error) {
      toastError('Unable to preview X-Read', String((error as Error)?.message || error))
    } finally { setBusy(false) }
  }
  const print = async () => {
    setBusy(true)
    try {
      const result = await window.api.reports.printXRead()
      onUpdate(result.report)
      if (preview) setPreview(result.report)
      if (result.ok) toastSuccess('X-Read sent to printer')
      else toastError('Unable to print X-Read', result.message)
    } catch (error) {
      toastError('Unable to print X-Read', String((error as Error)?.message || error))
    } finally { setBusy(false) }
  }
  const requestFinalize = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const counts = await window.api.reports.cashCounts()
      if (counts.some(count => count.shift_id === report.shift_id)) {
        await finish()
      } else {
        setReminder(true)
      }
    } catch {
      toastError('Hindi masuri ang Cash Count', 'Pakisubukan muli bago mag-Z-Read.')
    } finally {
      setBusy(false)
    }
  }
  const finish=async()=>{if(!confirm('Finalize Z-Read? This will finalize the current reporting period. Transactions and history will remain saved.'))return;setBusy(true);try{await window.api.reports.finalizeZ({actual_cash_c:Math.round(Number(actual)*100)});toastSuccess('Z-Read finalized');onFinalized()}catch(e){toastError('Z-Read failed',String((e as Error).message||e))}finally{setBusy(false)}}
  const groups: { title: string; stats: [string, number | string][] }[] = [
    { title: 'Sales Summary', stats: [['Gross Sales', report.gross_sales_c], ['Discounts', report.discount_c], ['Refunds', report.refunds_c], ['Voids', report.voids_c], ['Net Sales', report.net_sales_c]] },
    { title: 'Payment Breakdown', stats: [['Cash', report.cash_c], ['GCash', report.gcash_c], ['Maya', report.maya_c], ['Utang', report.utang_c]] },
    { title: 'Cash Reconciliation', stats: [['Starting Cash', report.starting_cash_c], ['Cash In', report.cash_in_c], ['Cash Out', report.cash_out_c], ['Cash Refunds', report.cash_refunds_c ?? report.refunds_c], ['Expenses', report.expenses_c], ['Expected Cash', report.expected_cash_c]] },
    { title: 'Transactions', stats: [['Transactions', String(report.transaction_count)], ['Voided Transactions', String(report.void_count)], ['Split Payments', String(report.split_count)]] }
  ]
  return <div>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-ink-line pb-4">
      <div><h3 className="font-bold">{finalize ? 'Z-Read Final Summary' : 'X-Read - Current Shift - Not Final'}</h3>
        <p className="text-sm text-slate-400">Cashier: {report.cashier_name} · Shift #{report.shift_no ?? report.shift_id}</p>
        <p className="text-sm text-slate-400">Opened: {new Date(report.opened_at.replace(' ', 'T')).toLocaleString('en-PH')}</p>
        <p className="text-sm text-slate-400">Updated: {new Date(report.report_at).toLocaleString('en-PH')}</p>
      </div>
      {!finalize && <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" disabled={busy} title="Refresh X-Read" onClick={onRefresh}><RefreshCw className="h-4 w-4"/></button>
        <button className="btn-ghost flex items-center gap-2" disabled={busy} onClick={()=>void showPreview()}><Eye className="h-4 w-4"/>Print Preview</button>
        <button className="btn-primary flex items-center gap-2" disabled={busy} onClick={()=>void print()}><Printer className="h-4 w-4"/>Print X-Read</button>
      </div>}
    </div>
    {groups.map(group=><section key={group.title} className="mb-5">
      <h4 className="mb-2 text-sm font-bold">{group.title}</h4>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
        {group.stats.map(([label,value])=><div key={label} className="min-w-0 border-b border-ink-line py-2">
          <dt className="text-xs text-slate-400">{label}</dt>
          <dd className={`mt-1 break-words font-bold tabular-nums ${label==='Net Sales'||label==='Expected Cash'?'text-xl text-emerald-300':'text-base'}`}>{typeof value==='number'?money(value):value}</dd>
        </div>)}
      </dl>
    </section>)}
    {finalize && <div className="mt-4 flex flex-wrap gap-2">
      <div><label className="label">Actual Cash (₱)</label><input className="input tabular-nums" type="number" min="0" value={actual} onChange={e=>setActual(e.target.value)}/></div>
      <button className="btn-primary flex gap-2 self-end" disabled={busy} onClick={()=>void requestFinalize()}><LockKeyhole className="h-4 w-4"/>Finalize Z-Read</button>
    </div>}
    {finalize && <p className="mt-3 text-sm text-amber-300">Finalization closes this shift. Transactions, payments, stock history, expenses, and customer ledgers remain saved.</p>}
    {reminder && <Modal open onClose={()=>setReminder(false)} title="Cash Count Required" maxWidth="max-w-md" footer={<button className="btn-primary flex items-center gap-2" onClick={()=>{setReminder(false);onCashCount()}}><Coins className="h-4 w-4"/>Pumunta sa Cash Count</button>}>
      <p>Wala pang naka-save na Cash Count para sa shift na ito. I-save muna ang Cash Count bago mag-Z-Read at isara ang shift. Hindi pa maaaring magpatuloy sa Z-Read.</p>
    </Modal>}
    {preview && (
      <Modal open onClose={() => setPreview(null)} title="X-Read Print Preview" maxWidth="max-w-md" footer={
        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
          <button type="button" onClick={() => void window.api.printer.shareReceipt?.(readReportLines(preview, undefined, undefined, settings?.store_name), `${preview.report_type}-Read Report`)} className="btn-ghost flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Share</button>
          <button type="button" className="btn-primary flex items-center gap-1.5" disabled={busy} onClick={() => void print()}><Printer className="h-4 w-4" /> Print Latest X-Read</button>
          <button type="button" onClick={() => setPreview(null)} className="btn-ghost">Close</button>
        </div>
      }>
        <ReceiptPaper lines={readReportLines(preview, undefined, undefined, settings?.store_name)}/>
      </Modal>
    )}
  </div>
}

function Stat({ label, v }: { label: string; v: string }): React.JSX.Element {
  return (
    <div className="card p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white tabular-nums">{v}</p>
    </div>
  )
}

export function ReportsIcon(): React.JSX.Element {
  return <BarChart3 className="h-4 w-4" />
}
