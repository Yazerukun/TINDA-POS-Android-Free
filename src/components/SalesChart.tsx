import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '@shared/format'

interface SalesChartProps {
  data: { label: string; total_c: number }[]
}

const axisMoney = (cents: number): string => new Intl.NumberFormat('en-PH', {
  notation: 'compact', maximumFractionDigits: 1
}).format(cents / 100)

export function SalesChart({ data }: SalesChartProps): React.JSX.Element {
  return <section className="mb-4 min-w-0 border-t border-ink-line pt-4" aria-label="Sales chart">
    <h3 className="mb-3 text-sm font-bold text-slate-300">Sales by Period</h3>
    {data.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No sales in this period.</p> : <>
      <div className="h-[260px] w-full min-w-0 overflow-hidden" data-testid="sales-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 0 }} accessibilityLayer>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false}
              axisLine={false} minTickGap={24} interval="preserveStartEnd" />
            <YAxis tickFormatter={axisMoney} tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false} axisLine={false} width={56} />
            <Tooltip formatter={(value) => [money(Number(value)), 'Sales']}
              contentStyle={{ background: '#161b22', border: '1px solid #334155', borderRadius: 6 }}
              labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#34d399' }}
              cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="total_c" name="Sales" fill="#10b981" maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Sales chart values</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">Sales</th></tr></thead>
        <tbody>{data.map((point, index) => <tr key={`${point.label}-${index}`}><th scope="row">{point.label}</th><td>{money(point.total_c)}</td></tr>)}</tbody>
      </table>
    </>}
  </section>
}
