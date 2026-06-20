import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface CodePage {
  route: string
  componentFile: string
  componentName: string
}

interface ApiEndpoint {
  method: string
  path: string
  sourceFile: string
  summary?: string
}

interface RouteCatalogData {
  pages?: CodePage[]
  endpoints?: ApiEndpoint[]
}

type ActiveTab = 'pages' | 'endpoints'

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  PATCH: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
  HEAD: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  OPTIONS: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
}

function shortPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').split('/').slice(-3).join('/')
}

export function RouteCatalogView({ contentJson }: { contentJson: string }) {
  let data: RouteCatalogData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const pages = data.pages ?? []
  const endpoints = data.endpoints ?? []
  const [activeTab, setActiveTab] = useState<ActiveTab>('pages')
  const [filter, setFilter] = useState('')

  const filteredPages = pages.filter(
    (p) =>
      !filter ||
      p.route.toLowerCase().includes(filter.toLowerCase()) ||
      p.componentName.toLowerCase().includes(filter.toLowerCase()),
  )
  const filteredEndpoints = endpoints.filter(
    (e) =>
      !filter ||
      e.path.toLowerCase().includes(filter.toLowerCase()) ||
      e.method.toLowerCase().includes(filter.toLowerCase()),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          {([['pages', pages.length], ['endpoints', endpoints.length]] as [ActiveTab, number][]).map(([tab, count]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{count}</span>
            </button>
          ))}
        </div>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="h-7 max-w-48 text-[11px]"
        />
      </div>

      {activeTab === 'pages' ? (
        <div className="rounded-lg border border-border bg-card/20">
          <div className="grid grid-cols-[1fr_1.5fr_1.5fr] border-b border-border/60 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Route</span>
            <span>Component</span>
            <span>File</span>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {filteredPages.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">No pages found.</p>
            ) : (
              filteredPages.map((page, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1.5fr_1.5fr] items-center gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-secondary/20"
                >
                  <span className="font-mono text-[10px] text-violet-300">{page.route}</span>
                  <span className="truncate text-[10px]">{page.componentName}</span>
                  <span className="truncate font-mono text-[9px] text-muted-foreground" title={page.componentFile}>
                    {shortPath(page.componentFile)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card/20">
          <div className="grid grid-cols-[80px_1fr_1.5fr] border-b border-border/60 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Method</span>
            <span>Path</span>
            <span>File</span>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {filteredEndpoints.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">No endpoints found.</p>
            ) : (
              filteredEndpoints.map((ep, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[80px_1fr_1.5fr] items-center gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-secondary/20"
                >
                  <Badge
                    variant="outline"
                    className={cn('w-fit text-[9px] font-bold', METHOD_STYLES[ep.method] ?? 'text-muted-foreground')}
                  >
                    {ep.method}
                  </Badge>
                  <span className="truncate font-mono text-[10px]" title={ep.path}>{ep.path}</span>
                  <span className="truncate font-mono text-[9px] text-muted-foreground" title={ep.sourceFile}>
                    {shortPath(ep.sourceFile)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
