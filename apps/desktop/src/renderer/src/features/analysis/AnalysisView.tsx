import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Boxes,
  Braces,
  CheckCircle2,
  ChevronRight,
  Code2,
  GitBranch,
  HardDrive,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Route,
  RotateCcw,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type {
  CodeAnalysisArtifact,
  CodeAnalysisProgress,
  CodeAnalysisReport,
  SyncProjectResult,
} from '@jkauto/core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn, invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { CoverageChart } from './components/CoverageChart'
import { TestGenPanel } from './components/TestGenPanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DetailKey = 'endpoints' | 'entities' | 'validations' | 'seeds' | 'symbols' | 'coverage' | 'routes'

interface Endpoint { method: string; path: string; summary?: string; sourceFile?: string }
interface PageRoute { route: string; componentName?: string; componentFile?: string }
interface EntityModel { name: string; tableName?: string; fields?: unknown[]; sourceFile?: string; framework?: string }
interface ValidationSchema { name: string; fields?: unknown[]; sourceFile?: string; framework?: string }
interface SeedEntry { entity: string; count: number; sourceFile?: string; sample?: unknown[] }
interface Symbol { name: string; kind?: string; file?: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(v?: string) {
  if (!v) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v))
}

function methodColor(m: string) {
  const u = m.toUpperCase()
  if (u === 'GET') return 'border-blue-500/40 text-blue-400'
  if (u === 'POST') return 'border-emerald-500/40 text-emerald-400'
  if (u === 'PUT' || u === 'PATCH') return 'border-amber-500/40 text-amber-400'
  if (u === 'DELETE') return 'border-red-500/40 text-red-400'
  return 'border-border text-muted-foreground'
}

// ---------------------------------------------------------------------------
// Stat cards config
// ---------------------------------------------------------------------------

interface StatCard { key: DetailKey; label: string; value: string | number; icon: typeof Code2; color: string }

function buildStatCards(report: CodeAnalysisReport): StatCard[] {
  const get = (type: string) => report.artifacts.find((a) => a.type === type)
  const routeData = (() => { try { return JSON.parse(get('route-catalog')?.contentJson ?? '{}') as { pages?: unknown[]; endpoints?: unknown[] } } catch { return {} } })()
  const covData = (() => { try { return JSON.parse(get('analysis-coverage')?.contentJson ?? '{}') as { coverage?: number } } catch { return {} } })()
  return [
    { key: 'endpoints', label: 'API Endpoints', value: routeData.endpoints?.length ?? 0, icon: Route, color: 'text-blue-400' },
    { key: 'routes', label: 'UI Routes', value: routeData.pages?.length ?? 0, icon: Route, color: 'text-violet-400' },
    { key: 'entities', label: 'Entity Models', value: get('entity-catalog')?.itemCount ?? 0, icon: Boxes, color: 'text-emerald-400' },
    { key: 'validations', label: 'Validation Schemas', value: get('validation-catalog')?.itemCount ?? 0, icon: Braces, color: 'text-amber-400' },
    { key: 'seeds', label: 'Seed Data', value: get('seed-catalog')?.itemCount ?? 0, icon: HardDrive, color: 'text-pink-400' },
    { key: 'symbols', label: 'Code Symbols', value: get('symbol-catalog')?.itemCount ?? 0, icon: Code2, color: 'text-cyan-400' },
    { key: 'coverage', label: 'File Coverage', value: covData.coverage != null ? `${Math.round(covData.coverage * 100)}%` : '—', icon: CheckCircle2, color: 'text-teal-400' },
  ]
}

// ---------------------------------------------------------------------------
// Inline text input
// ---------------------------------------------------------------------------

function InlineInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-violet-500/60 focus:outline-none',
        className,
      )}
    />
  )
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground focus:border-violet-500/60 focus:outline-none"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Row action buttons
// ---------------------------------------------------------------------------

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button type="button" onClick={onEdit}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
        <Pencil className="h-3 w-3" />
      </button>
      <button type="button" onClick={onDelete}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Save/Cancel bar
// ---------------------------------------------------------------------------

function EditBar({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={onSave}
        className="rounded bg-violet-600 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-violet-500">
        Save
      </button>
      <button type="button" onClick={onCancel}
        className="rounded border border-border px-2.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">
        Cancel
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-type CRUD list components
// ---------------------------------------------------------------------------

function EndpointList({ data, onChange }: { data: Endpoint[]; onChange: (next: Endpoint[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<Endpoint>({ method: 'GET', path: '' })
  const [adding, setAdding] = useState(false)

  function commitEdit() {
    if (editIdx === null) return
    const next = data.map((e, i) => i === editIdx ? draft : e)
    onChange(next)
    setEditIdx(null)
  }

  function commitAdd() {
    if (!draft.path.trim()) return
    onChange([...data, { ...draft, path: draft.path.trim() }])
    setAdding(false)
    setDraft({ method: 'GET', path: '' })
  }

  function startEdit(i: number) { setDraft({ ...data[i] }); setEditIdx(i); setAdding(false) }
  function startAdd() { setDraft({ method: 'GET', path: '' }); setAdding(true); setEditIdx(null) }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{data.length} endpoints</span>
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-violet-500/40 hover:text-violet-400">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
          <SelectInput value={draft.method} onChange={(v) => setDraft({ ...draft, method: v })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']} />
          <InlineInput value={draft.path} onChange={(v) => setDraft({ ...draft, path: v })} placeholder="/path" className="flex-1 min-w-[120px]" />
          <InlineInput value={draft.summary ?? ''} onChange={(v) => setDraft({ ...draft, summary: v })} placeholder="summary (optional)" className="flex-1 min-w-[100px]" />
          <EditBar onSave={commitAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      {data.map((ep, i) => (
        <div key={i} className="group">
          {editIdx === i ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
              <SelectInput value={draft.method} onChange={(v) => setDraft({ ...draft, method: v })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']} />
              <InlineInput value={draft.path} onChange={(v) => setDraft({ ...draft, path: v })} placeholder="/path" className="flex-1 min-w-[120px]" />
              <InlineInput value={draft.summary ?? ''} onChange={(v) => setDraft({ ...draft, summary: v })} placeholder="summary (optional)" className="flex-1 min-w-[100px]" />
              <EditBar onSave={commitEdit} onCancel={() => setEditIdx(null)} />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded border border-border/50 bg-card/40 px-2.5 py-1.5">
              <Badge variant="outline" className={cn('shrink-0 font-mono text-[9px] px-1', methodColor(ep.method))}>
                {ep.method}
              </Badge>
              <code className="flex-1 truncate text-[11px]">{ep.path}</code>
              {ep.summary && <span className="shrink-0 text-[10px] text-muted-foreground">{ep.summary}</span>}
              <RowActions onEdit={() => startEdit(i)} onDelete={() => onChange(data.filter((_, j) => j !== i))} />
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && !adding && <p className="text-xs text-muted-foreground">No endpoints. Click Add to create one.</p>}
    </div>
  )
}

function RouteList({ data, onChange }: { data: PageRoute[]; onChange: (next: PageRoute[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<PageRoute>({ route: '' })
  const [adding, setAdding] = useState(false)

  function commitEdit() { if (editIdx === null) return; onChange(data.map((r, i) => i === editIdx ? draft : r)); setEditIdx(null) }
  function commitAdd() { if (!draft.route.trim()) return; onChange([...data, { ...draft, route: draft.route.trim() }]); setAdding(false); setDraft({ route: '' }) }
  function startEdit(i: number) { setDraft({ ...data[i] }); setEditIdx(i); setAdding(false) }
  function startAdd() { setDraft({ route: '' }); setAdding(true); setEditIdx(null) }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{data.length} routes</span>
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-violet-500/40 hover:text-violet-400">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
          <InlineInput value={draft.route} onChange={(v) => setDraft({ ...draft, route: v })} placeholder="/route" className="flex-1 min-w-[120px]" />
          <InlineInput value={draft.componentName ?? ''} onChange={(v) => setDraft({ ...draft, componentName: v })} placeholder="Component (optional)" className="flex-1 min-w-[100px]" />
          <EditBar onSave={commitAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      {data.map((r, i) => (
        <div key={i} className="group">
          {editIdx === i ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
              <InlineInput value={draft.route} onChange={(v) => setDraft({ ...draft, route: v })} placeholder="/route" className="flex-1 min-w-[120px]" />
              <InlineInput value={draft.componentName ?? ''} onChange={(v) => setDraft({ ...draft, componentName: v })} placeholder="Component (optional)" className="flex-1 min-w-[100px]" />
              <EditBar onSave={commitEdit} onCancel={() => setEditIdx(null)} />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded border border-border/50 bg-card/40 px-2.5 py-1.5">
              <Route className="h-3 w-3 shrink-0 text-violet-400" />
              <code className="flex-1 truncate text-[11px]">{r.route}</code>
              {r.componentName && <span className="shrink-0 text-[10px] text-muted-foreground">{r.componentName}</span>}
              <RowActions onEdit={() => startEdit(i)} onDelete={() => onChange(data.filter((_, j) => j !== i))} />
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && !adding && <p className="text-xs text-muted-foreground">No UI routes. Click Add to create one.</p>}
    </div>
  )
}

function EntityList({ data, onChange }: { data: EntityModel[]; onChange: (next: EntityModel[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<EntityModel>({ name: '' })
  const [adding, setAdding] = useState(false)

  function commitEdit() { if (editIdx === null) return; onChange(data.map((e, i) => i === editIdx ? { ...data[i], ...draft } : e)); setEditIdx(null) }
  function commitAdd() { if (!draft.name.trim()) return; onChange([...data, { ...draft, name: draft.name.trim() }]); setAdding(false); setDraft({ name: '' }) }
  function startEdit(i: number) { setDraft({ name: data[i].name, tableName: data[i].tableName, framework: data[i].framework, sourceFile: data[i].sourceFile }); setEditIdx(i); setAdding(false) }
  function startAdd() { setDraft({ name: '' }); setAdding(true); setEditIdx(null) }

  const row = (d: typeof draft, onSave: () => void, onCancel: () => void) => (
    <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
      <InlineInput value={d.name} onChange={(v) => setDraft({ ...d, name: v })} placeholder="EntityName*" className="min-w-[120px]" />
      <InlineInput value={d.tableName ?? ''} onChange={(v) => setDraft({ ...d, tableName: v })} placeholder="table_name" className="min-w-[100px]" />
      <InlineInput value={d.framework ?? ''} onChange={(v) => setDraft({ ...d, framework: v })} placeholder="framework" className="min-w-[80px]" />
      <EditBar onSave={onSave} onCancel={onCancel} />
    </div>
  )

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{data.length} entities</span>
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-violet-500/40 hover:text-violet-400">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      {adding && row(draft, commitAdd, () => setAdding(false))}
      {data.map((e, i) => (
        <div key={i} className="group">
          {editIdx === i ? row(draft, commitEdit, () => setEditIdx(null)) : (
            <div className="rounded border border-border/50 bg-card/40 px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <Boxes className="h-3 w-3 shrink-0 text-emerald-400" />
                <span className="text-[11px] font-medium">{e.name}</span>
                {e.tableName && e.tableName !== e.name && <code className="text-[9px] text-muted-foreground">→ {e.tableName}</code>}
                <span className="ml-auto text-[9px] text-muted-foreground">{(e.fields ?? []).length} fields</span>
                {e.framework && <Badge variant="secondary" className="text-[8px] px-1">{e.framework}</Badge>}
                <RowActions onEdit={() => startEdit(i)} onDelete={() => onChange(data.filter((_, j) => j !== i))} />
              </div>
              {e.sourceFile && <p className="mt-0.5 truncate pl-5 font-mono text-[9px] text-muted-foreground">{e.sourceFile}</p>}
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && !adding && <p className="text-xs text-muted-foreground">No entities. Click Add to create one.</p>}
    </div>
  )
}

function ValidationList({ data, onChange }: { data: ValidationSchema[]; onChange: (next: ValidationSchema[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<ValidationSchema>({ name: '' })
  const [adding, setAdding] = useState(false)

  function commitEdit() { if (editIdx === null) return; onChange(data.map((s, i) => i === editIdx ? { ...data[i], ...draft } : s)); setEditIdx(null) }
  function commitAdd() { if (!draft.name.trim()) return; onChange([...data, { ...draft, name: draft.name.trim() }]); setAdding(false); setDraft({ name: '' }) }
  function startEdit(i: number) { setDraft({ name: data[i].name, framework: data[i].framework, sourceFile: data[i].sourceFile }); setEditIdx(i); setAdding(false) }
  function startAdd() { setDraft({ name: '' }); setAdding(true); setEditIdx(null) }

  const row = (d: typeof draft, onSave: () => void, onCancel: () => void) => (
    <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
      <InlineInput value={d.name} onChange={(v) => setDraft({ ...d, name: v })} placeholder="SchemaName*" className="min-w-[120px]" />
      <InlineInput value={d.framework ?? ''} onChange={(v) => setDraft({ ...d, framework: v })} placeholder="zod / joi / class-validator" className="min-w-[140px]" />
      <EditBar onSave={onSave} onCancel={onCancel} />
    </div>
  )

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{data.length} schemas</span>
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-violet-500/40 hover:text-violet-400">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      {adding && row(draft, commitAdd, () => setAdding(false))}
      {data.map((s, i) => (
        <div key={i} className="group">
          {editIdx === i ? row(draft, commitEdit, () => setEditIdx(null)) : (
            <div className="rounded border border-border/50 bg-card/40 px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <Braces className="h-3 w-3 shrink-0 text-amber-400" />
                <span className="text-[11px] font-medium">{s.name}</span>
                <span className="ml-auto text-[9px] text-muted-foreground">{(s.fields ?? []).length} fields</span>
                {s.framework && <Badge variant="secondary" className="text-[8px] px-1">{s.framework}</Badge>}
                <RowActions onEdit={() => startEdit(i)} onDelete={() => onChange(data.filter((_, j) => j !== i))} />
              </div>
              {s.sourceFile && <p className="mt-0.5 truncate pl-5 font-mono text-[9px] text-muted-foreground">{s.sourceFile}</p>}
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && !adding && <p className="text-xs text-muted-foreground">No schemas. Click Add to create one.</p>}
    </div>
  )
}

function SeedList({ data, onChange }: { data: SeedEntry[]; onChange: (next: SeedEntry[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<SeedEntry>({ entity: '', count: 0 })
  const [adding, setAdding] = useState(false)

  function commitEdit() { if (editIdx === null) return; onChange(data.map((s, i) => i === editIdx ? { ...data[i], ...draft } : s)); setEditIdx(null) }
  function commitAdd() { if (!draft.entity.trim()) return; onChange([...data, { ...draft, entity: draft.entity.trim() }]); setAdding(false); setDraft({ entity: '', count: 0 }) }
  function startEdit(i: number) { setDraft({ entity: data[i].entity, count: data[i].count, sourceFile: data[i].sourceFile }); setEditIdx(i); setAdding(false) }
  function startAdd() { setDraft({ entity: '', count: 0 }); setAdding(true); setEditIdx(null) }

  const row = (d: typeof draft, onSave: () => void, onCancel: () => void) => (
    <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
      <InlineInput value={d.entity} onChange={(v) => setDraft({ ...d, entity: v })} placeholder="entityName*" className="min-w-[120px]" />
      <InlineInput value={String(d.count)} onChange={(v) => setDraft({ ...d, count: Number(v) || 0 })} placeholder="count" className="w-16" />
      <InlineInput value={d.sourceFile ?? ''} onChange={(v) => setDraft({ ...d, sourceFile: v })} placeholder="source file (optional)" className="flex-1 min-w-[120px]" />
      <EditBar onSave={onSave} onCancel={onCancel} />
    </div>
  )

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{data.length} seed sources</span>
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-violet-500/40 hover:text-violet-400">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      {adding && row(draft, commitAdd, () => setAdding(false))}
      {data.map((s, i) => (
        <div key={i} className="group">
          {editIdx === i ? row(draft, commitEdit, () => setEditIdx(null)) : (
            <div className="rounded border border-border/50 bg-card/40 px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <HardDrive className="h-3 w-3 shrink-0 text-pink-400" />
                <span className="text-[11px] font-medium capitalize">{s.entity}</span>
                <span className="ml-auto text-[9px] text-muted-foreground">{s.count} records</span>
                <RowActions onEdit={() => startEdit(i)} onDelete={() => onChange(data.filter((_, j) => j !== i))} />
              </div>
              {s.sourceFile && <p className="mt-0.5 truncate pl-5 font-mono text-[9px] text-muted-foreground">{s.sourceFile}</p>}
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && !adding && <p className="text-xs text-muted-foreground">No seed data. Click Add to create one.</p>}
    </div>
  )
}

function SymbolList({ data, onChange }: { data: Symbol[]; onChange: (next: Symbol[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<Symbol>({ name: '' })
  const [adding, setAdding] = useState(false)

  function commitEdit() { if (editIdx === null) return; onChange(data.map((s, i) => i === editIdx ? draft : s)); setEditIdx(null) }
  function commitAdd() { if (!draft.name.trim()) return; onChange([...data, { ...draft, name: draft.name.trim() }]); setAdding(false); setDraft({ name: '' }) }
  function startEdit(i: number) { setDraft({ ...data[i] }); setEditIdx(i); setAdding(false) }
  function startAdd() { setDraft({ name: '' }); setAdding(true); setEditIdx(null) }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{data.length} symbols</span>
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-violet-500/40 hover:text-violet-400">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
          <InlineInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="symbolName*" className="flex-1 min-w-[120px]" />
          <InlineInput value={draft.kind ?? ''} onChange={(v) => setDraft({ ...draft, kind: v })} placeholder="kind" className="w-24" />
          <EditBar onSave={commitAdd} onCancel={() => setAdding(false)} />
        </div>
      )}
      {data.slice(0, 200).map((s, i) => (
        <div key={i} className="group">
          {editIdx === i ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
              <InlineInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="symbolName*" className="flex-1 min-w-[120px]" />
              <InlineInput value={draft.kind ?? ''} onChange={(v) => setDraft({ ...draft, kind: v })} placeholder="kind" className="w-24" />
              <EditBar onSave={commitEdit} onCancel={() => setEditIdx(null)} />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded border border-border/50 bg-card/40 px-2.5 py-1">
              <Code2 className="h-3 w-3 shrink-0 text-cyan-400" />
              <span className="flex-1 truncate text-[11px]">{s.name}</span>
              {s.kind && <Badge variant="outline" className="shrink-0 text-[8px] px-1">{s.kind}</Badge>}
              <RowActions onEdit={() => startEdit(i)} onDelete={() => onChange(data.filter((_, j) => j !== i))} />
            </div>
          )}
        </div>
      ))}
      {data.length > 200 && <p className="text-center text-[10px] text-muted-foreground">+{data.length - 200} more (showing first 200)</p>}
      {data.length === 0 && !adding && <p className="text-xs text-muted-foreground">No symbols. Click Add to create one.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({ detailKey, artifact, projectPath, onClose, onSaved }: {
  detailKey: DetailKey
  artifact: CodeAnalysisArtifact | undefined
  projectPath: string
  onClose: () => void
  onSaved: (updated: CodeAnalysisArtifact) => void
}) {
  const label: Record<DetailKey, string> = {
    endpoints: 'API Endpoints', routes: 'UI Routes', entities: 'Entity Models',
    validations: 'Validation Schemas', seeds: 'Seed Data', symbols: 'Code Symbols', coverage: 'File Coverage',
  }

  // Parse artifact content into mutable state
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Local mutable copies of list data — keyed by artifact id to reset on artifact change
  const parsed = (() => { try { return artifact ? JSON.parse(artifact.contentJson) : {} } catch { return {} } })()

  const [endpoints, setEndpoints] = useState<Endpoint[]>(() => parsed.endpoints ?? [])
  const [pages, setPages] = useState<PageRoute[]>(() => parsed.pages ?? [])
  const [entities, setEntities] = useState<EntityModel[]>(() => parsed.entities ?? [])
  const [validations, setValidations] = useState<ValidationSchema[]>(() => parsed.validations ?? [])
  const [seeds, setSeeds] = useState<SeedEntry[]>(() => parsed.seeds ?? [])
  const [symbols, setSymbols] = useState<Symbol[]>(() => parsed.symbols ?? [])

  // Reset when artifact changes
  const prevId = useRef(artifact?.id)
  if (prevId.current !== artifact?.id) {
    prevId.current = artifact?.id
    const p = (() => { try { return artifact ? JSON.parse(artifact.contentJson) : {} } catch { return {} } })()
    setEndpoints(p.endpoints ?? [])
    setPages(p.pages ?? [])
    setEntities(p.entities ?? [])
    setValidations(p.validations ?? [])
    setSeeds(p.seeds ?? [])
    setSymbols(p.symbols ?? [])
    setDirty(false)
  }

  function buildContentJson(): { json: string; count: number; summary: string } {
    if (detailKey === 'endpoints' || detailKey === 'routes') {
      const content = { ...parsed, endpoints, pages }
      const count = endpoints.length + pages.length
      return { json: JSON.stringify(content), count, summary: `${pages.length} UI routes and ${endpoints.length} API endpoints.` }
    }
    if (detailKey === 'entities') {
      return { json: JSON.stringify({ entities }), count: entities.length, summary: `${entities.length} entity models.` }
    }
    if (detailKey === 'validations') {
      return { json: JSON.stringify({ validations }), count: validations.length, summary: `${validations.length} DTO/validation schemas.` }
    }
    if (detailKey === 'seeds') {
      return { json: JSON.stringify({ seeds }), count: seeds.length, summary: `${seeds.length} seed/fixture sources.` }
    }
    if (detailKey === 'symbols') {
      return { json: JSON.stringify({ symbols }), count: symbols.length, summary: `${symbols.length} exported symbols.` }
    }
    return { json: artifact?.contentJson ?? '{}', count: artifact?.itemCount ?? 0, summary: artifact?.summary ?? '' }
  }

  async function handleSave() {
    if (!artifact) return
    setSaving(true)
    try {
      const { json, count, summary } = buildContentJson()
      await invoke(IpcChannels.CODE_ANALYSIS_ARTIFACT_UPDATE, {
        projectPath,
        artifactId: artifact.id,
        contentJson: json,
        itemCount: count,
        summary,
      })
      onSaved({ ...artifact, contentJson: json, itemCount: count, summary })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  function wrapChange<T>(setter: React.Dispatch<React.SetStateAction<T>>) {
    return (next: T) => { setter(next); setDirty(true) }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-xs font-semibold">{label[detailKey]}</span>
        {artifact && (
          <Badge variant="secondary" className="text-[9px]">{artifact.itemCount} items</Badge>
        )}
        {dirty && (
          <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">unsaved</Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-6 px-2.5 text-[10px]">
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Save changes
            </Button>
          )}
          <button type="button" onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!artifact && detailKey !== 'coverage' ? (
          <p className="text-xs text-muted-foreground">No data. Run analysis first.</p>
        ) : detailKey === 'coverage' ? (
          <CoverageChart contentJson={artifact?.contentJson ?? '{}'} />
        ) : detailKey === 'endpoints' ? (
          <EndpointList data={endpoints} onChange={wrapChange(setEndpoints)} />
        ) : detailKey === 'routes' ? (
          <RouteList data={pages} onChange={wrapChange(setPages)} />
        ) : detailKey === 'entities' ? (
          <EntityList data={entities} onChange={wrapChange(setEntities)} />
        ) : detailKey === 'validations' ? (
          <ValidationList data={validations} onChange={wrapChange(setValidations)} />
        ) : detailKey === 'seeds' ? (
          <SeedList data={seeds} onChange={wrapChange(setSeeds)} />
        ) : detailKey === 'symbols' ? (
          <SymbolList data={symbols} onChange={wrapChange(setSymbols)} />
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function AnalysisView({ projectPath }: { projectPath: string }) {
  const project = useProjectStore((state) => state.projects.find((p) => p.path === projectPath))
  type ProjWithSource = { sourceType?: 'git' | 'local'; sourcePath?: string; repoUrl?: string }
  const proj = project?.project as ProjWithSource | undefined
  const sourceType = proj?.sourceType ?? 'git'
  const displaySourceRef = sourceType === 'local' ? (proj?.sourcePath ?? '') : (proj?.repoUrl ?? '')

  const [report, setReport] = useState<CodeAnalysisReport | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<DetailKey | null>(null)
  const [progress, setProgress] = useState<CodeAnalysisProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    invoke<CodeAnalysisReport | null>(IpcChannels.CODE_ANALYSIS_REPORT, { projectPath })
      .then((r) => {
        if (!active) return
        setReport(r)
        // Auto-trigger analysis when project has a source but no prior analysis
        if (!r && displaySourceRef) {
          runAnalysis()
        }
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)) })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath])

  useEffect(() => {
    return window.api.on(IpcChannels.CODE_ANALYSIS_PROGRESS, (v: unknown) => setProgress(v as CodeAnalysisProgress))
  }, [])

  async function runAnalysis(sourceRef?: string) {
    setRunning(true); setError(null); setSelectedDetail(null)
    setProgress({ phase: 'source', message: 'Preparing analysis...', percent: 1 })
    try {
      const r = await invoke<CodeAnalysisReport>(IpcChannels.CODE_ANALYSIS_START, { projectPath, sourceRef })
      setReport(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false); setProgress(null)
    }
  }

  async function handleSync() {
    setSyncing(true); setError(null)
    try {
      const result = await invoke<SyncProjectResult>(IpcChannels.PROJECT_SYNC, { projectPath })
      await runAnalysis(result.sourceRef)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  function handleArtifactSaved(updated: CodeAnalysisArtifact) {
    if (!report) return
    setReport({ ...report, artifacts: report.artifacts.map((a) => a.id === updated.id ? updated : a) })
  }

  const statCards = report ? buildStatCards(report) : []

  // Resolve artifact for selected detail
  const selectedArtifact = selectedDetail && report
    ? report.artifacts.find((a) => {
        if (selectedDetail === 'endpoints' || selectedDetail === 'routes') return a.type === 'route-catalog'
        if (selectedDetail === 'entities') return a.type === 'entity-catalog'
        if (selectedDetail === 'validations') return a.type === 'validation-catalog'
        if (selectedDetail === 'seeds') return a.type === 'seed-catalog'
        if (selectedDetail === 'symbols') return a.type === 'symbol-catalog'
        if (selectedDetail === 'coverage') return a.type === 'analysis-coverage'
        return false
      })
    : undefined

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <Wand2 className="h-4 w-4 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold">Auto Generate Test</h1>
          <p className="text-[11px] text-muted-foreground">AI-assisted test generation from codebase analysis</p>
        </div>
        {report && (
          <Badge variant="outline" className={cn('gap-1 text-[10px]',
            report.run.status === 'completed' && 'border-emerald-500/40 text-emerald-400',
            report.run.status === 'failed' && 'border-destructive/40 text-destructive',
          )}>
            {report.run.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {report.run.status}
          </Badge>
        )}
      </header>

      {/* Source + actions */}
      <section className="shrink-0 border-b border-border bg-panel/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-border/60 bg-muted/30 px-2.5 py-1.5">
            {sourceType === 'git' ? <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={displaySourceRef}>
              {displaySourceRef || <span className="italic text-muted-foreground/60">No source configured — open Project Settings</span>}
            </span>
            <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px]">{sourceType}</Badge>
          </div>
          <Button size="sm" variant="outline" disabled={running || syncing || !displaySourceRef} onClick={handleSync} className="h-8 shrink-0 gap-1.5 text-xs">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Sync
          </Button>
          <Button size="sm" disabled={running || syncing || !displaySourceRef} onClick={() => runAnalysis()} className="h-8 shrink-0 text-xs">
            {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : report ? <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {report ? 'Refresh' : 'Analyze'}
          </Button>
        </div>

        {(running || syncing) && progress && (
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{progress.message}</span>
              <span>{progress.percent}%</span>
            </div>
            <Progress value={progress.percent} className="h-1" />
          </div>
        )}
        {error && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{error}
          </div>
        )}
      </section>

      {/* Empty state */}
      {!report && !running && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Wand2 className="h-10 w-10 text-muted-foreground/25" />
          <div>
            <p className="text-sm font-medium">No analysis data yet</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Click Analyze to scan the codebase and extract endpoints, entities, validations, and seed data for test generation.
            </p>
          </div>
          <Button size="sm" disabled={!displaySourceRef} onClick={() => runAnalysis()} className="mt-1 gap-1.5">
            <Play className="h-3.5 w-3.5" /> Analyze now
          </Button>
        </div>
      )}

      {/* Main content */}
      {report && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Tech info */}
          <div className="shrink-0 border-b border-border/60 bg-card/20 px-4 py-2">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground/80">{report.run.framework ?? 'unknown'} / {report.run.language ?? 'unknown'}</span>
              <span className="truncate" title={report.run.sourceRef}>{report.run.sourceRef}</span>
              <span className="ml-auto shrink-0">Updated {formatDate(report.run.completedAt)}</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="shrink-0 p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Analysis summary</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon
                const isSelected = selectedDetail === card.key
                return (
                  <button key={card.key} type="button"
                    onClick={() => setSelectedDetail(isSelected ? null : card.key)}
                    className={cn(
                      'group flex flex-col gap-2 rounded-lg border bg-card/40 p-3 text-left transition-colors hover:bg-card/70',
                      isSelected ? 'border-violet-500/40 bg-violet-500/5' : 'border-border/60',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={cn('h-3.5 w-3.5', card.color)} />
                      <span className={cn('flex items-center gap-0.5 text-[9px] transition-colors',
                        isSelected ? 'text-violet-400' : 'text-muted-foreground group-hover:text-foreground/60',
                      )}>
                        {isSelected ? 'Hide' : 'Detail'}
                        <ChevronRight className={cn('h-2.5 w-2.5 transition-transform', isSelected && 'rotate-90')} />
                      </span>
                    </div>
                    <div>
                      <div className={cn('text-xl font-bold tabular-nums', card.color)}>{card.value}</div>
                      <div className="text-[10px] text-muted-foreground">{card.label}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Detail panel */}
          {selectedDetail ? (
            <div className="min-h-0 flex-1 overflow-auto border-t border-border">
              <DetailPanel
                detailKey={selectedDetail}
                artifact={selectedArtifact}
                projectPath={projectPath}
                onClose={() => setSelectedDetail(null)}
                onSaved={handleArtifactSaved}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <TestGenPanel projectPath={projectPath} artifacts={report.artifacts} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
