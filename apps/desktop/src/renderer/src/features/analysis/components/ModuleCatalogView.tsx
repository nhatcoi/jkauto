import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DetectedModule {
  id: string
  name: string
  root: string
  relativeRoot: string
  role: string
  stack: {
    framework?: string
    language?: string
    hasOpenApi?: boolean
    testFramework?: string
  }
  tags: Array<{ type: string; confidence: number }>
  manifests: string[]
}

interface ModuleCatalogData {
  modules?: DetectedModule[]
}

const ROLE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  frontend: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  backend: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  mobile: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  desktop: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  library: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  cli: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  automation: { color: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30' },
  data: { color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  unknown: { color: 'text-muted-foreground', bg: 'bg-secondary/30', border: 'border-border' },
}

function shortPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').split('/').slice(-2).join('/')
}

export function ModuleCatalogView({ contentJson }: { contentJson: string }) {
  let data: ModuleCatalogData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const modules = data.modules ?? []

  if (modules.length === 0) {
    return <p className="text-xs text-muted-foreground">No modules discovered.</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((mod) => {
        const roleStyle = ROLE_CONFIG[mod.role] ?? ROLE_CONFIG.unknown
        return (
          <div
            key={mod.id}
            className={cn(
              'rounded-lg border p-3 transition-colors hover:bg-secondary/10',
              roleStyle.border,
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold" title={mod.name}>
                  {mod.name || mod.relativeRoot || 'root'}
                </p>
                <p className="truncate font-mono text-[9px] text-muted-foreground" title={mod.relativeRoot}>
                  {mod.relativeRoot || '/'}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn('shrink-0 text-[9px]', roleStyle.color, roleStyle.border)}
              >
                {mod.role}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex gap-1.5">
                {mod.stack.framework && (
                  <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {mod.stack.framework}
                  </span>
                )}
                {mod.stack.language && (
                  <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {mod.stack.language}
                  </span>
                )}
              </div>

              {mod.stack.testFramework && (
                <p className="text-[9px] text-muted-foreground">
                  Tests: {mod.stack.testFramework}
                </p>
              )}

              {mod.manifests.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {mod.manifests.slice(0, 3).map((manifest, i) => (
                    <p key={i} className="truncate font-mono text-[9px] text-muted-foreground" title={manifest}>
                      {shortPath(manifest)}
                    </p>
                  ))}
                </div>
              )}

              {mod.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {mod.tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className="rounded bg-secondary/40 px-1 py-0.5 text-[8px] text-muted-foreground"
                    >
                      {tag.type} {Math.round(tag.confidence * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
