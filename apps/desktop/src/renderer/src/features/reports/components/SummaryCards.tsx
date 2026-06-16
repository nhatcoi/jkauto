import { CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RunRecord } from '@jkauto/core'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function Card({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 rounded-lg bg-card/40 border border-border/30">
      <div className={cn('p-2 rounded-md', accent)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground leading-none mb-1">{label}</div>
        <div className="text-xl font-semibold leading-none">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
      </div>
    </div>
  )
}

export function SummaryCards({ records }: { records: RunRecord[] }) {
  const total = records.length
  const passed = records.filter((r) => r.status === 'passed').length
  const failed = records.filter((r) => r.status === 'failed').length
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0
  const avgDuration =
    total > 0
      ? Math.round(records.reduce((s, r) => s + r.durationMs, 0) / total)
      : 0
  const last = records[0]
  const lastRun = last
    ? new Date(last.startedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <div className="flex gap-3">
      <Card
        label="Total Runs"
        value={total}
        sub={`${passed}P · ${failed}F`}
        icon={TrendingUp}
        accent="bg-blue-500/10 text-blue-400"
      />
      <Card
        label="Pass Rate"
        value={`${passRate}%`}
        sub={`${passed} passed`}
        icon={CheckCircle2}
        accent={passRate >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
      />
      <Card
        label="Avg Duration"
        value={formatDuration(avgDuration)}
        sub="per run"
        icon={Clock}
        accent="bg-purple-500/10 text-purple-400"
      />
      <Card
        label="Last Run"
        value={lastRun}
        sub={last ? last.status : undefined}
        icon={XCircle}
        accent="bg-muted/60 text-muted-foreground"
      />
    </div>
  )
}
