import { useState } from 'react'
import { Plus, Trash2, Edit2, Search, Braces, ChevronDown, ChevronRight } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type { KeywordMeta } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProjectStore } from '@/store/project.store'
import { useKeywords } from '@/features/test-cases/hooks/useKeywords'
import { useCustomKeywords } from './hooks/useCustomKeywords'

// ── group built-in keywords ────────────────────────────────────────────────────

function deriveGroup(kw: KeywordMeta): string {
  const n = kw.name
  if (n.startsWith('navigate')) return 'Navigation'
  if (n.startsWith('assert-status') || n.startsWith('assert-response') || n.startsWith('assert-json') || n.startsWith('http-') || n.startsWith('set-base') || n.startsWith('set-request')) return 'API'
  if (n.startsWith('assert')) return 'Assertions'
  if (n.startsWith('wait')) return 'Wait'
  if (n.startsWith('mobile')) return 'Mobile'
  if (n.startsWith('tap') || n.startsWith('swipe') || n.startsWith('long-press')) return 'Mobile'
  if (n.startsWith('assert-window') || n.startsWith('focus-window') || n.startsWith('close-window') || n.startsWith('maximize')) return 'Desktop'
  if (n === 'take-screenshot') return 'Screenshot'
  if (n === 'call-test-case') return 'Control Flow'
  return 'Interaction'
}

function groupKeywords(keywords: KeywordMeta[]): Record<string, KeywordMeta[]> {
  const groups: Record<string, KeywordMeta[]> = {}
  for (const kw of keywords) {
    const g = deriveGroup(kw)
    ;(groups[g] ??= []).push(kw)
  }
  return groups
}

const GROUP_ORDER = ['Navigation', 'Interaction', 'Assertions', 'Wait', 'API', 'Mobile', 'Desktop', 'Screenshot', 'Control Flow']

// ── BuiltinGroup ───────────────────────────────────────────────────────────────

function BuiltinGroup({ name, keywords }: { name: string; keywords: KeywordMeta[] }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-xs font-semibold text-foreground/80">{name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{keywords.length}</span>
      </button>
      {open && (
        <div className="divide-y divide-border/50">
          {keywords.map((kw) => (
            <div key={kw.name} className="flex items-start gap-3 px-3 py-2 hover:bg-muted/20">
              <span className={cn('text-[10px] font-semibold text-white px-1.5 py-0.5 rounded shrink-0 mt-0.5', kw.color)}>
                {kw.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-foreground/70 font-mono">{kw.name}</div>
                {kw.description && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{kw.description}</div>
                )}
                {kw.platforms.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {kw.platforms.map((p) => (
                      <span key={p} className="text-[9px] px-1 py-0 rounded bg-secondary text-muted-foreground">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── KeywordsView ───────────────────────────────────────────────────────────────

type Tab = 'builtin' | 'custom'

export function KeywordsView() {
  const { activeProject, openTab } = useProjectStore()
  const allBuiltins = useKeywords()
  const { entries, reload } = useCustomKeywords(activeProject?.path)

  const [tab, setTab] = useState<Tab>('builtin')
  const [search, setSearch] = useState('')

  // Filter built-ins
  const filteredBuiltins = search
    ? allBuiltins.filter((k) =>
        k.name.toLowerCase().includes(search.toLowerCase()) ||
        k.label.toLowerCase().includes(search.toLowerCase()) ||
        k.description.toLowerCase().includes(search.toLowerCase()),
      )
    : allBuiltins

  const groups = groupKeywords(filteredBuiltins)
  const orderedGroups = GROUP_ORDER.filter((g) => groups[g]?.length)

  // Custom keyword actions
  const handleNew = async () => {
    if (!activeProject) return
    const name = prompt('Keyword name:')
    if (!name?.trim()) return
    const key = name.trim().toLowerCase().replace(/\s+/g, '-')
    const filePath = `${activeProject.path}/keywords/${key}.keywords.json`
    const content = JSON.stringify({ schemaVersion: 1, id: crypto.randomUUID(), name: name.trim(), description: '', params: [], steps: [] }, null, 2)
    await invoke(IpcChannels.FS_CREATE_FILE, filePath, content)
    await reload()
    openTab(filePath, name.trim(), activeProject.path)
  }

  const handleEdit = (entry: { name: string; path: string }) => {
    if (!activeProject) return
    openTab(entry.path, entry.name, activeProject.path)
  }

  const handleDelete = async (entry: { name: string; path: string }) => {
    if (!confirm(`Delete keyword "${entry.name}"? This cannot be undone.`)) return
    await invoke(IpcChannels.FS_DELETE, entry.path)
    await reload()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 bg-panel">
        <Braces className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-xs font-semibold text-foreground/80">Keyword Library</span>
        <span className="ml-1 text-[10px] text-muted-foreground">
          {allBuiltins.length} built-in · {entries.length} custom
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => setTab('builtin')}
          className={cn(
            'px-4 py-1.5 text-xs border-b-2 transition-colors',
            tab === 'builtin' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Built-in ({allBuiltins.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('custom')}
          className={cn(
            'px-4 py-1.5 text-xs border-b-2 transition-colors',
            tab === 'custom' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Custom ({entries.length})
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'builtin' && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <Input
                className="h-7 text-xs pl-7"
                placeholder="Search keywords…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {orderedGroups.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">No keywords match</div>
            )}
            {orderedGroups.map((g) => (
              <BuiltinGroup key={g} name={g} keywords={groups[g]} />
            ))}
          </div>
        )}

        {tab === 'custom' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {entries.length === 0 ? 'No custom keywords yet' : `${entries.length} keyword${entries.length > 1 ? 's' : ''}`}
              </span>
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs gap-1" onClick={handleNew} disabled={!activeProject}>
                <Plus className="w-3 h-3" /> New Keyword
              </Button>
            </div>

            {entries.length === 0 && (
              <div className="border border-dashed border-border rounded-md py-10 text-center">
                <Braces className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">No custom keywords</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Create keywords that compose multiple steps into a reusable action</div>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs gap-1 mt-3" onClick={handleNew} disabled={!activeProject}>
                  <Plus className="w-3 h-3" /> New Keyword
                </Button>
              </div>
            )}

            {entries.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center gap-3 px-3 py-2.5 border border-border rounded-md hover:bg-muted/20 group"
              >
                <Braces className="w-4 h-4 text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{entry.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">{entry.path.split('/').slice(-2).join('/')}</div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleEdit(entry)}
                    title="Edit"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:text-destructive"
                    onClick={() => handleDelete(entry)}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
