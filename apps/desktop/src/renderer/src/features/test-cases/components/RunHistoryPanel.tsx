import { History, CheckCircle2, XCircle, Square, Clock, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { RunRecord } from '@jkauto/core'

interface RunHistoryPanelProps {
  records: RunRecord[]
  embedded?: boolean  // true = inside BottomPanel tab (no outer border/max-height)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return `Today ${formatTime(iso)}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + formatTime(iso)
}

function StatusIcon({ status }: { status: RunRecord['status'] }) {
  if (status === 'passed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
  return <Square className="w-3.5 h-3.5 text-amber-500 shrink-0" />
}

function RunRow({ record }: { record: RunRecord }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
          'hover:bg-muted/40',
          expanded && 'bg-muted/30',
        )}
      >
        <StatusIcon status={record.status} />

        <span
          className={cn(
            'text-xs font-medium w-14 shrink-0',
            record.status === 'passed' && 'text-emerald-500',
            record.status === 'failed' && 'text-red-500',
            record.status === 'stopped' && 'text-amber-500',
          )}
        >
          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
        </span>

        <span className="text-xs text-muted-foreground flex-1 truncate">
          {formatDate(record.startedAt)}
        </span>

        <span className="flex items-center gap-1 text-xs text-muted-foreground/70 shrink-0">
          <Clock className="w-3 h-3" />
          {formatDuration(record.durationMs)}
        </span>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="px-10 pb-2 flex gap-4 text-xs text-muted-foreground">
          <span>
            <span className="text-emerald-500 font-medium">{record.passedSteps}</span> passed
          </span>
          <span>
            <span className={record.failedSteps > 0 ? 'text-red-500 font-medium' : ''}>
              {record.failedSteps}
            </span>{' '}
            failed
          </span>
          <span>{record.totalSteps} total</span>
          <span className="text-muted-foreground/50 ml-auto">run {record.runId.slice(0, 8)}</span>
        </div>
      )}
    </div>
  )
}

export function RunHistoryPanel({ records, embedded = false }: RunHistoryPanelProps) {
  return (
    <div className={cn(
      'flex flex-col h-full',
      !embedded && 'border-t border-border bg-muted/10 shrink-0 max-h-52',
    )}>
      {!embedded && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 shrink-0">
          <History className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground/70">Run History</span>
          {records.length > 0 && (
            <span className="text-[10px] text-muted-foreground/50 ml-auto">
              {records.length} run{records.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {records.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
          No run history yet. Run the test case to see results here.
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          {records.map((r) => (
            <RunRow key={r.runId} record={r} />
          ))}
        </div>
      )}
    </div>
  )
}
