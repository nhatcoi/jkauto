import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { RunRecord } from '@jkauto/core'

const COLORS = {
  passed: '#34d399',
  failed: '#f87171',
  stopped: '#fbbf24',
}

const RADIAN = Math.PI / 180
function CustomLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: {
  cx: number; cy: number; midAngle: number
  innerRadius: number; outerRadius: number; percent: number
}) {
  if (percent < 0.06) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function StatusDonut({ records }: { records: RunRecord[] }) {
  const passed = records.filter((r) => r.status === 'passed').length
  const failed = records.filter((r) => r.status === 'failed').length
  const stopped = records.filter((r) => r.status === 'stopped').length

  const data = [
    { name: 'Passed', value: passed },
    { name: 'Failed', value: failed },
    { name: 'Stopped', value: stopped },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
        No data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="48%"
          innerRadius="45%"
          outerRadius="68%"
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          label={CustomLabel as never}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS]}
              strokeWidth={0}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
            color: 'hsl(var(--foreground))',
          }}
          formatter={(value, name) => [Number(value ?? 0), String(name)]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
