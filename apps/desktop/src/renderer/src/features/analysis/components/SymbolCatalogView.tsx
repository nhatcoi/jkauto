import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface CodeSymbol {
  kind: string
  name: string
  file: string
  line: number
  exported: boolean
}

interface SymbolCatalogData {
  symbols?: CodeSymbol[]
}

const KIND_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  function: { label: 'Functions', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  component: { label: 'Components', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  class: { label: 'Classes', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  service: { label: 'Services', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  model: { label: 'Models', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  interface: { label: 'Interfaces', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  type: { label: 'Types', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  variable: { label: 'Variables', color: 'text-orange-400', bg: 'bg-orange-500/10' },
}

const KIND_ORDER = ['component', 'service', 'model', 'class', 'interface', 'function', 'type', 'variable']

function shortPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').split('/').slice(-3).join('/')
}

export function SymbolCatalogView({ contentJson }: { contentJson: string }) {
  let data: SymbolCatalogData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const symbols = data.symbols ?? []
  const [filter, setFilter] = useState('')
  const [activeKind, setActiveKind] = useState<string>('all')

  const allKinds = Array.from(new Set(symbols.map((s) => s.kind)))
  const orderedKinds = [
    ...KIND_ORDER.filter((k) => allKinds.includes(k)),
    ...allKinds.filter((k) => !KIND_ORDER.includes(k)),
  ]

  const filtered = symbols.filter((s) => {
    const kindMatch = activeKind === 'all' || s.kind === activeKind
    const textMatch =
      !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.file.toLowerCase().includes(filter.toLowerCase())
    return kindMatch && textMatch
  })

  const kindCounts = orderedKinds.reduce<Record<string, number>>((acc, kind) => {
    acc[kind] = symbols.filter((s) => s.kind === kind).length
    return acc
  }, {})

  if (symbols.length === 0) {
    return <p className="text-xs text-muted-foreground">No symbols found.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or file..."
          className="h-7 max-w-64 text-[11px]"
        />
        <span className="text-[10px] text-muted-foreground">{filtered.length} of {symbols.length}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setActiveKind('all')}
          className={cn(
            'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
            activeKind === 'all'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/60',
          )}
        >
          All {symbols.length}
        </button>
        {orderedKinds.map((kind) => {
          const config = KIND_CONFIG[kind]
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setActiveKind(kind)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                activeKind === kind
                  ? cn('bg-secondary text-foreground', config?.color)
                  : 'text-muted-foreground hover:bg-secondary/60',
              )}
            >
              {config?.label ?? kind}
              <span className="rounded-full bg-muted px-1 py-0.5 text-[8px]">{kindCounts[kind]}</span>
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-border bg-card/20">
        <div className="grid grid-cols-[80px_1fr_1fr_50px] border-b border-border/60 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Kind</span>
          <span>Name</span>
          <span>File</span>
          <span>Line</span>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {filtered.slice(0, 300).map((symbol, i) => {
            const config = KIND_CONFIG[symbol.kind]
            return (
              <div
                key={i}
                className="grid grid-cols-[80px_1fr_1fr_50px] items-center gap-2 border-b border-border/40 px-3 py-1.5 last:border-b-0 hover:bg-secondary/20"
              >
                <span className={cn('text-[9px] font-medium', config?.color ?? 'text-muted-foreground')}>
                  {symbol.kind}
                </span>
                <span className="truncate font-mono text-[10px]" title={symbol.name}>
                  {symbol.name}
                  {symbol.exported && (
                    <span className="ml-1 text-[8px] text-muted-foreground">↑</span>
                  )}
                </span>
                <span className="truncate font-mono text-[9px] text-muted-foreground" title={symbol.file}>
                  {shortPath(symbol.file)}
                </span>
                <span className="text-[9px] text-muted-foreground">{symbol.line}</span>
              </div>
            )
          })}
          {filtered.length > 300 && (
            <p className="px-3 py-2 text-[10px] text-muted-foreground">
              Showing 300 of {filtered.length}. Use filter to narrow results.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
