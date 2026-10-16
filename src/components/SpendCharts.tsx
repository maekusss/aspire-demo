import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '../lib/format'

export type SpendOverTimePoint = {
  month: string
  spend: number
  previousSpend?: number | null
}

export type SpendByCategoryPoint = {
  category: string
  spend: number
  previousSpend?: number
}

type SpendChartsProps = {
  spendOverTime: SpendOverTimePoint[]
  spendByCategory: SpendByCategoryPoint[]
  onCategorySelect: (category: string) => void
  previous?: { aLabel: string; bLabel: string }
}

export default function SpendCharts({ spendOverTime, spendByCategory, onCategorySelect, previous }: SpendChartsProps) {
  return (
    <section className={`chart-row${previous ? ' comparing' : ''}`} aria-label="Spend charts">
      <div className="chart-panel">
        <div className="panel-title chart-heading">Spend over time {previous && <span className="compare-legend"><span><i className="legend-current" />{previous.aLabel}</span><span><i className="legend-previous line" />{previous.bLabel}</span></span>}</div>
        <ResponsiveContainer width="100%" height={112}>
          <AreaChart data={spendOverTime} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="spend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border-soft)" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={1} padding={{ left: 18, right: 18 }} />
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), previous ? name === 'previousSpend' ? previous.bLabel : previous.aLabel : 'Spend']} />
            <Area
              type="monotone"
              dataKey="spend"
              stroke="var(--accent)"
              fill="url(#spend-fill)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            {previous && <Line type="monotone" dataKey="previousSpend" stroke="var(--text-soft)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-panel">
        <div className="panel-title chart-heading">Spend by category {previous && <span className="compare-legend"><span><i className="legend-current" />{previous.aLabel}</span><span><i className="legend-previous" />{previous.bLabel}</span></span>}</div>
        <ResponsiveContainer width="100%" height={112}>
          <BarChart data={spendByCategory} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border-soft)" vertical={false} />
            <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis hide />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), previous ? name === 'previousSpend' ? previous.bLabel : previous.aLabel : 'Spend']} />
            <Bar
              dataKey="spend"
              fill="var(--accent)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              onClick={(data) => {
                const category = data?.payload?.category
                if (typeof category === 'string') onCategorySelect(category)
              }}
            />
            {previous && <Bar dataKey="previousSpend" fill="var(--prev)" radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={(data) => { const category = data?.payload?.category; if (typeof category === 'string') onCategorySelect(category) }} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
