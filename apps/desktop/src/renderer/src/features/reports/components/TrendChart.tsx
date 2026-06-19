import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import type { RunRecord } from '@jkauto/core'

function fileLabel(p: string): string {
  const f = p.split('/').pop() ?? p
  return f.replace(/\.(test|suite)\.(json|yaml|yml)$/, '').slice(0, 12)
}

export function TrendChart({ records }: { records: RunRecord[] }) {
  const last20 = [...records].reverse().slice(0, 20)

  const data = last20.map((r, i) => ({
    idx: i + 1,
    label: fileLabel(r.filePath),
    passed: r.passedSteps,
    failed: r.failedSteps,
    duration: +(r.durationMs / 1000).toFixed(2),
    status: r.status,
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
        No data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="idx"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 11,
            color: 'hsl(var(--foreground))',
          }}
          cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
          formatter={(value, name) => [
            Number(value ?? 0),
            name === 'passed' ? 'Passed steps' : 'Failed steps',
          ]}
          labelFormatter={(i) => data[+i - 1] ? `Run #${i}: ${data[+i - 1].label}` : `Run #${i}`}
        />
        <Legend
          iconType="square"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              {value === 'passed' ? 'Passed steps' : 'Failed steps'}
            </span>
          )}
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" />
        <Bar dataKey="passed" fill="#34d399" radius={[2, 2, 0, 0]} maxBarSize={24} />
        <Bar dataKey="failed" fill="#f87171" radius={[2, 2, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}
