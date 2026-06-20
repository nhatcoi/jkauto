import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SourceRef {
  file: string
  line?: number
  symbol?: string
}

interface ProjectTag {
  type: string
  confidence: number
  evidence: SourceRef[]
}

interface ClassificationData {
  tags?: ProjectTag[]
  primaryStack?: {
    framework?: string
    language?: string
  }
}

const TYPE_COLORS: Record<string, string> = {
  'web-application': 'bg-violet-500',
  'backend-api': 'bg-blue-500',
  'mobile-app': 'bg-emerald-500',
  'desktop-app': 'bg-cyan-500',
  microservice: 'bg-sky-500',
  monorepo: 'bg-indigo-500',
  'library-sdk': 'bg-amber-500',
  'cli-tool': 'bg-orange-500',
  'automation-test': 'bg-lime-500',
  'data-ai': 'bg-pink-500',
  'infrastructure-devops': 'bg-red-500',
  database: 'bg-teal-500',
  'unknown-mixed': 'bg-gray-500',
}

function shortPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').split('/').slice(-3).join('/')
}

export function ProjectClassificationView({ contentJson }: { contentJson: string }) {
  let data: ClassificationData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const tags = (data.tags ?? []).sort((a, b) => b.confidence - a.confidence)

  if (tags.length === 0) {
    return <p className="text-xs text-muted-foreground">No classification data available.</p>
  }

  return (
    <div className="space-y-4">
      {data.primaryStack && (
        <div className="flex gap-2">
          <Badge variant="secondary">{data.primaryStack.framework ?? '—'}</Badge>
          <Badge variant="outline">{data.primaryStack.language ?? '—'}</Badge>
        </div>
      )}

      <div className="space-y-3">
        {tags.map((tag) => {
          const pct = Math.round(tag.confidence * 100)
          const barColor = TYPE_COLORS[tag.type] ?? 'bg-gray-500'
          return (
            <div key={tag.type} className="rounded-lg border border-border bg-card/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium">{tag.type}</span>
                <span className={cn('text-[11px] font-semibold', pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-muted-foreground')}>
                  {pct}%
                </span>
              </div>
              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {tag.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tag.evidence.slice(0, 5).map((ref, i) => (
                    <span
                      key={i}
                      className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                      title={ref.file}
                    >
                      {shortPath(ref.file)}
                    </span>
                  ))}
                  {tag.evidence.length > 5 && (
                    <span className="text-[9px] text-muted-foreground">+{tag.evidence.length - 5} more</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
