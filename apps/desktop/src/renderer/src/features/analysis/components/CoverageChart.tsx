import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface CoverageData {
  scannedFiles?: number
  parsedFiles?: number
  failedFiles?: number
  unsupportedFiles?: number
  skippedFiles?: number
  coverage?: number
}

const SEGMENTS = [
  { key: 'parsedFiles', label: 'Parsed', color: '#10b981' },
  { key: 'failedFiles', label: 'Failed', color: '#ef4444' },
  { key: 'unsupportedFiles', label: 'Unsupported', color: '#f59e0b' },
  { key: 'skippedFiles', label: 'Skipped', color: '#6b7280' },
]

export function CoverageChart({ contentJson }: { contentJson: string }) {
  let data: CoverageData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const total = data.scannedFiles ?? 0
  const coveragePct = Math.round((data.coverage ?? 0) * 100)

  const chartData = SEGMENTS.map((seg) => ({
    name: seg.label,
    value: Number((data as Record<string, unknown>)[seg.key] ?? 0),
    color: seg.color,
  })).filter((item) => item.value > 0)

  if (total === 0) {
    return <p className="text-xs text-muted-foreground">No coverage data available.</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Total files" value={total} />
        <StatCard label="Parsed" value={data.parsedFiles ?? 0} color="text-emerald-400" />
        <StatCard label="Failed" value={data.failedFiles ?? 0} color="text-red-400" />
        <StatCard label="Coverage" value={`${coveragePct}%`} color={coveragePct >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 11 }}
              formatter={(value, name) => [`${Number(value)} files`, String(name)]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${color ?? ''}`}>{value}</div>
    </div>
  )
}
