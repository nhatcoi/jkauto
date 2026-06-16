import { CheckCircle2, XCircle, Square, Clock, RefreshCw, BarChart2, ChevronDown, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { RunRecord, StepResult } from '@jkauto/core'
import { useReports } from './hooks/useReports'
import { useProjectStore } from '@/store/project.store'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (isToday) return `Today ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time
}

function fileLabel(filePath: string): string {
  const parts = filePath.split('/')
  const file = parts[parts.length - 1] ?? filePath
  return file.replace(/\.(test|suite)\.(json|yaml|yml)$/, '')
}

function RunStatusBadge({ status }: { status: RunRecord['status'] }) {
  const map = {
    passed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    failed: 'text-red-400 bg-red-500/10 border-red-500/20',
    stopped: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', map[status])}>
      {status.toUpperCase()}
    </span>
  )
}

function StepResultRow({ result, index }: { result: StepResult; index: number }) {
  const Icon = result.status === 'passed' ? CheckCircle2 : result.status === 'failed' ? XCircle : SkipForward
  return (
    <div className={cn(
      'flex items-start gap-2 py-0.5 px-2 rounded text-xs',
      result.status === 'failed' && 'bg-red-500/5',
    )}>
      <span className="text-muted-foreground/40 w-5 text-right shrink-0 mt-0.5 font-mono">{index + 1}</span>
      <Icon className={cn(
        'w-3 h-3 shrink-0 mt-0.5',
        result.status === 'passed' && 'text-emerald-500',
        result.status === 'failed' && 'text-red-500',
        result.status === 'skipped' && 'text-muted-foreground/30',
      )} />
      <span className={cn(
        'flex-1 font-mono',
        result.status === 'failed' && 'text-red-400',
        result.status === 'skipped' && 'text-muted-foreground/40',
        result.status === 'passed' && 'text-muted-foreground/60',
      )}>
        {result.status === 'failed' && result.message ? result.message : result.status}
      </span>
      {result.durationMs !== undefined && (
        <span className="text-muted-foreground/30 shrink-0">{result.durationMs}ms</span>
      )}
    </div>
  )
}

function RunCard({ record }: { record: RunRecord }) {
  const [expanded, setExpanded] = useState(false)
  const hasSteps = (record.stepResults?.length ?? 0) > 0

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden bg-card/30 hover:bg-card/50 transition-colors">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-foreground truncate">
              {fileLabel(record.filePath)}
            </span>
            <RunStatusBadge status={record.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatDate(record.startedAt)}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(record.durationMs)}
            </span>
            <span>
              <span className="text-emerald-400">{record.passedSteps}</span>
              <span className="text-muted-foreground/40">/</span>
              {record.totalSteps} steps
            </span>
            {record.failedSteps > 0 && (
              <span className="text-red-400">{record.failedSteps} failed</span>
            )}
          </div>
        </div>

        <ChevronDown className={cn(
          'w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform',
          expanded && 'rotate-180',
        )} />
      </button>

      {expanded && hasSteps && (
        <div className="border-t border-border/30 bg-background/30 py-2">
          {record.stepResults!.map((r, i) => (
            <StepResultRow key={r.stepIndex} result={r} index={i} />
          ))}
        </div>
      )}

      {expanded && !hasSteps && (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground/50 italic">
          No step detail — run again to capture step results.
        </div>
      )}
    </div>
  )
}

type FilterStatus = 'all' | 'passed' | 'failed' | 'stopped'

export function ReportsView() {
  const { activeProject } = useProjectStore()
  const { records, loading, reload } = useReports()
  const [filter, setFilter] = useState<FilterStatus>('all')

  const filtered = filter === 'all' ? records : records.filter((r) => r.status === filter)

  const passedCount = records.filter((r) => r.status === 'passed').length
  const failedCount = records.filter((r) => r.status === 'failed').length
  const stoppedCount = records.filter((r) => r.status === 'stopped').length

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No project open
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0 bg-muted/10">
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Reports</span>

        <div className="flex items-center gap-1 ml-2">
          {(['all', 'passed', 'failed', 'stopped'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'text-xs px-2.5 py-1 rounded transition-colors',
                filter === f
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              )}
            >
              {f === 'all' ? `All (${records.length})` : f === 'passed' ? `Passed (${passedCount})` : f === 'failed' ? `Failed (${failedCount})` : `Stopped (${stoppedCount})`}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40 transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      {records.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-2 border-b border-border/30 bg-muted/5 shrink-0">
          <span className="text-xs text-muted-foreground">{records.length} total runs</span>
          <span className="text-xs text-emerald-400">{passedCount} passed</span>
          <span className="text-xs text-red-400">{failedCount} failed</span>
          {stoppedCount > 0 && <span className="text-xs text-amber-400">{stoppedCount} stopped</span>}
          {records.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round((passedCount / records.length) * 100)}% pass rate
            </span>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-xs text-muted-foreground/50 text-center py-8">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground/50 text-center py-8">
            {records.length === 0 ? 'No runs yet. Run a test case or suite to see results.' : 'No runs match filter.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((r) => (
              <RunCard key={`${r.runId}-${r.startedAt}`} record={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
