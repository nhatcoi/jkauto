import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Locator {
  strategy: string
  value: string
}

interface UIElement {
  name?: string
  tag?: string
  locators: Locator[]
  sourceFile: string
}

interface UICatalogData {
  elements?: UIElement[]
}

const STRATEGY_COLORS: Record<string, string> = {
  testid: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
  role: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
  css: 'border-violet-500/30 text-violet-400 bg-violet-500/5',
  xpath: 'border-amber-500/30 text-amber-400 bg-amber-500/5',
  text: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5',
}

function shortPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').split('/').slice(-3).join('/')
}

export function UICatalogView({ contentJson }: { contentJson: string }) {
  let data: UICatalogData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const elements = data.elements ?? []
  const [filter, setFilter] = useState('')

  const filtered = elements.filter(
    (el) =>
      !filter ||
      (el.name ?? '').toLowerCase().includes(filter.toLowerCase()) ||
      el.locators.some((loc) => loc.value.toLowerCase().includes(filter.toLowerCase())),
  )

  if (elements.length === 0) {
    return <p className="text-xs text-muted-foreground">No UI elements discovered.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or selector..."
          className="h-7 max-w-64 text-[11px]"
        />
        <span className="text-[10px] text-muted-foreground">{filtered.length} of {elements.length}</span>
      </div>

      <div className="rounded-lg border border-border bg-card/20">
        <div className="grid grid-cols-[1fr_2fr_1fr] border-b border-border/60 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Name / Tag</span>
          <span>Locators</span>
          <span>File</span>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {filtered.slice(0, 200).map((el, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_2fr_1fr] items-start gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-secondary/20"
            >
              <div>
                {el.name && <p className="text-[11px] font-medium">{el.name}</p>}
                {el.tag && <p className="font-mono text-[9px] text-muted-foreground">&lt;{el.tag}&gt;</p>}
              </div>
              <div className="flex flex-wrap gap-1">
                {el.locators.map((loc, j) => (
                  <div key={j} className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[8px] ${STRATEGY_COLORS[loc.strategy] ?? 'text-muted-foreground'}`}
                    >
                      {loc.strategy}
                    </Badge>
                    <span className="max-w-[120px] truncate font-mono text-[9px] text-muted-foreground" title={loc.value}>
                      {loc.value}
                    </span>
                  </div>
                ))}
              </div>
              <span className="truncate font-mono text-[9px] text-muted-foreground" title={el.sourceFile}>
                {shortPath(el.sourceFile)}
              </span>
            </div>
          ))}
          {filtered.length > 200 && (
            <p className="px-3 py-2 text-[10px] text-muted-foreground">
              Showing 200 of {filtered.length}. Use filter to narrow results.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
