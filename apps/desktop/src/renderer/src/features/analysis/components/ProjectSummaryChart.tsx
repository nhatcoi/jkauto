import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface SummaryData {
  stack?: {
    framework?: string
    language?: string
    hasOpenApi?: boolean
    testFramework?: string
  }
  counts?: {
    pages?: number
    endpoints?: number
    elements?: number
    symbols?: number
  }
  sourceFileCount?: number
}

const BAR_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']

export function ProjectSummaryChart({ contentJson }: { contentJson: string }) {
  let data: SummaryData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const counts = data.counts ?? {}
  const stack = data.stack ?? {}

  const chartData = [
    { name: 'Pages', value: counts.pages ?? 0 },
    { name: 'Endpoints', value: counts.endpoints ?? 0 },
    { name: 'UI Elements', value: counts.elements ?? 0 },
    { name: 'Symbols', value: counts.symbols ?? 0 },
  ]

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chartData.map((item, i) => (
          <div key={item.name} className="rounded-lg border border-border bg-card/40 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">{item.name}</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: BAR_COLORS[i] }}>
              {item.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 11 }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InfoRow label="Framework" value={stack.framework ?? '—'} />
        <InfoRow label="Language" value={stack.language ?? '—'} />
        <InfoRow label="Test framework" value={stack.testFramework ?? '—'} />
        <InfoRow label="OpenAPI" value={stack.hasOpenApi ? 'Yes' : 'No'} />
        <InfoRow label="Source files" value={(data.sourceFileCount ?? 0).toLocaleString()} />
        <InfoRow label="Total artifacts" value={total.toLocaleString()} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-border/60 bg-card/20 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium">{value}</span>
    </div>
  )
}
