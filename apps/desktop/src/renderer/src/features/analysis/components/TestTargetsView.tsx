import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface TestTarget {
  type: 'page' | 'api' | 'flow' | 'data'
  id: string
  name: string
  status: string
  confidence: number
  sourceRefs: string[]
}

interface TargetsData {
  targets?: TestTarget[]
}

const TYPE_CONFIG: Record<
  TestTarget['type'],
  { label: string; color: string }
> = {
  page: { label: 'Pages', color: 'text-violet-400' },
  api: { label: 'API Endpoints', color: 'text-blue-400' },
  flow: { label: 'Flows', color: 'text-emerald-400' },
  data: { label: 'Data', color: 'text-amber-400' },
}

const TYPES: TestTarget['type'][] = ['page', 'api', 'flow', 'data']

function confidenceBadge(confidence: number) {
  const pct = Math.round(confidence * 100)
  const cls =
    pct >= 90
      ? 'border-emerald-500/30 text-emerald-400'
      : pct >= 70
        ? 'border-amber-500/30 text-amber-400'
        : 'border-red-500/30 text-red-400'
  return { pct, cls }
}

export function TestTargetsView({ contentJson }: { contentJson: string }) {
  let data: TargetsData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const targets = data.targets ?? []
  const [activeType, setActiveType] = useState<TestTarget['type']>('page')

  const counts = TYPES.reduce<Record<string, number>>((acc, type) => {
    acc[type] = targets.filter((item) => item.type === type).length
    return acc
  }, {})

  const visibleTypes = TYPES.filter((type) => counts[type] > 0)
  const filtered = targets.filter((item) => item.type === activeType)

  if (targets.length === 0) {
    return <p className="text-xs text-muted-foreground">No test targets found.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {visibleTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              activeType === type
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
            )}
          >
            <span className={TYPE_CONFIG[type].color}>{TYPE_CONFIG[type].label}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{counts[type]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card/20">
        <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] border-b border-border/60 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Target</span>
          <span>Status</span>
          <span>Confidence</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">No {TYPE_CONFIG[activeType].label.toLowerCase()} targets.</p>
          ) : (
            filtered.map((target) => {
              const { pct, cls } = confidenceBadge(target.confidence)
              return (
                <div
                  key={target.id}
                  className="grid grid-cols-[minmax(0,1fr)_80px_80px] items-start border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-secondary/20"
                >
                  <div className="min-w-0 pr-2">
                    {activeType === 'api' && (
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <MethodBadge id={target.id} />
                      </div>
                    )}
                    <p className="truncate font-mono text-[10px]" title={target.name}>{target.name}</p>
                    {target.sourceRefs[0] && (
                      <p className="mt-0.5 truncate text-[9px] text-muted-foreground" title={target.sourceRefs[0]}>
                        {shortPath(target.sourceRefs[0])}
                      </p>
                    )}
                  </div>
                  <div className="pt-0.5">
                    <Badge variant="outline" className="text-[9px]">{target.status}</Badge>
                  </div>
                  <div className="pt-0.5">
                    <Badge variant="outline" className={cn('text-[9px]', cls)}>{pct}%</Badge>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function MethodBadge({ id }: { id: string }) {
  const method = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.exec(id)?.[1]
  if (!method) return null
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-400',
    POST: 'bg-blue-500/15 text-blue-400',
    PUT: 'bg-amber-500/15 text-amber-400',
    PATCH: 'bg-violet-500/15 text-violet-400',
    DELETE: 'bg-red-500/15 text-red-400',
    HEAD: 'bg-gray-500/15 text-gray-400',
    OPTIONS: 'bg-gray-500/15 text-gray-400',
  }
  return (
    <span className={cn('rounded px-1 py-0.5 font-mono text-[9px] font-bold', colors[method] ?? '')}>
      {method}
    </span>
  )
}

function shortPath(fullPath: string): string {
  const parts = fullPath.replace(/\\/g, '/').split('/')
  return parts.slice(-3).join('/')
}
