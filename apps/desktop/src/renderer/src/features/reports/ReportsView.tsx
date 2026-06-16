import {
  CheckCircle2, XCircle, Clock, RefreshCw, BarChart2,
  ChevronDown, SkipForward, PieChart as PieIcon, TrendingUp, Camera,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { RunRecord, StepResult } from '@jkauto/core'
import { useReports } from './hooks/useReports'
import { useProjectStore } from '@/store/project.store'
import { SummaryCards } from './components/SummaryCards'
import { StatusDonut } from './components/StatusDonut'
import { TrendChart } from './components/TrendChart'
import { ScreenshotViewer } from './components/ScreenshotViewer'

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
  const map: Record<RunRecord['status'], string> = {
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

function StepResultRow({ result, index, onViewScreenshot }: {
  result: StepResult
  index: number
  onViewScreenshot?: (path: string, stepIndex: number) => void
}) {
  const Icon =
    result.status === 'passed' ? CheckCircle2
    : result.status === 'failed' ? XCircle
    : SkipForward
  return (
    <div className={cn(
      'flex items-start gap-2 py-0.5 px-2 rounded text-xs group',
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
      {result.screenshotPath && onViewScreenshot && (
        <button
          type="button"
          title="View screenshot"
          onClick={() => onViewScreenshot(result.screenshotPath!, index)}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Camera className="w-3 h-3 text-amber-400 hover:text-amber-300" />
        </button>
      )}
      {result.durationMs !== undefined && (
        <span className="text-muted-foreground/30 shrink-0">{result.durationMs}ms</span>
      )}
    </div>
  )
}

function RunCard({ record }: { record: RunRecord }) {
  const [expanded, setExpanded] = useState(false)
  const [viewerState, setViewerState] = useState<{ path: string; stepIndex: number } | null>(null)
  const hasSteps = (record.stepResults?.length ?? 0) > 0

  return (
    <>
      {viewerState && (
        <ScreenshotViewer
          screenshotPath={viewerState.path}
          stepIndex={viewerState.stepIndex}
          onClose={() => setViewerState(null)}
        />
      )}
    <div className="border border-border/40 rounded-lg overflow-hidden bg-card/30 hover:bg-card/50 transition-colors">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            record.status === 'passed' && 'bg-emerald-400',
            record.status === 'failed' && 'bg-red-400',
            record.status === 'stopped' && 'bg-amber-400',
          )}
        />
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
            <StepResultRow
              key={r.stepIndex}
              result={r}
              index={i}
              onViewScreenshot={(path, stepIndex) => setViewerState({ path, stepIndex })}
            />
          ))}
        </div>
      )}
      {expanded && !hasSteps && (
        <div className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground/50 italic">
          No step detail — run again to capture step results.
        </div>
      )}
    </div>
    </>
  )
}

type FilterStatus = 'all' | 'passed' | 'failed' | 'stopped'
type ViewMode = 'dashboard' | 'list'

export function ReportsView() {
  const { activeProject } = useProjectStore()
  const { records, loading, reload } = useReports()
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [view, setView] = useState<ViewMode>('dashboard')

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0 bg-muted/10">
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Reports</span>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 ml-2 bg-muted/30 rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            title="Dashboard"
            className={cn(
              'p-1.5 rounded transition-colors',
              view === 'dashboard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <PieIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            title="Run list"
            className={cn(
              'p-1.5 rounded transition-colors',
              view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 ml-1">
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
              {f === 'all'
                ? `All (${records.length})`
                : f === 'passed'
                ? `Passed (${passedCount})`
                : f === 'failed'
                ? `Failed (${failedCount})`
                : `Stopped (${stoppedCount})`}
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

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50">
          Loading...
        </div>
      ) : records.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <BarChart2 className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/50">No runs yet. Run a test case or suite to see results.</p>
        </div>
      ) : view === 'dashboard' ? (
        <DashboardView records={records} filtered={filtered} filter={filter} />
      ) : (
        <ListView filtered={filtered} />
      )}
    </div>
  )
}

function DashboardView({
  records,
  filtered,
  filter,
}: {
  records: RunRecord[]
  filtered: RunRecord[]
  filter: FilterStatus
}) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 flex flex-col gap-4">
        {/* Summary cards */}
        <SummaryCards records={records} />

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status Distribution
            </span>
            <div className="h-52 rounded-lg border border-border/30 bg-card/30 p-2">
              <StatusDonut records={records} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Steps Trend (last 20 runs)
            </span>
            <div className="h-52 rounded-lg border border-border/30 bg-card/30 p-2">
              <TrendChart records={records} />
            </div>
          </div>
        </div>

        {/* Recent runs section */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {filter === 'all' ? 'Recent Runs' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Runs`}
            <span className="ml-1 text-muted-foreground/50">({filtered.length})</span>
          </span>
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 text-center py-6">
              No runs match filter.
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
    </div>
  )
}

function ListView({ filtered }: { filtered: RunRecord[] }) {
  return (
    <div className="flex-1 overflow-auto p-4">
      {filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground/50 text-center py-8">
          No runs match filter.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((r) => (
            <RunCard key={`${r.runId}-${r.startedAt}`} record={r} />
          ))}
        </div>
      )}
    </div>
  )
}
