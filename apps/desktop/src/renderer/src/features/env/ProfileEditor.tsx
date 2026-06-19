import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { readProfile, writeEnv } from './api'
import { ApiProfileForm, fromApiProfileConfig, toApiProfileConfig } from './ApiProfileForm'
import type { ApiConfigState } from './ApiProfileForm'

type Tab = 'variables' | 'api'

interface VarRow { id: string; key: string; value: string }

function toRows(vars: Record<string, string>): VarRow[] {
  return Object.entries(vars).map(([key, value]) => ({ id: crypto.randomUUID(), key, value }))
}

function fromRows(rows: VarRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) { if (r.key.trim()) out[r.key.trim()] = r.value }
  return out
}

function profileName(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath
  return base.replace('.env.json', '')
}

export function ProfileEditor({ filePath }: { filePath: string }) {
  const { markTabDirty } = useProjectStore()
  const [tab, setTab] = useState<Tab>('variables')
  const [rows, setRows] = useState<VarRow[]>([])
  const [apiConfig, setApiConfig] = useState<ApiConfigState>(fromApiProfileConfig(undefined))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setDirty(false)
    setError('')
    setTab('variables')
    readProfile(filePath)
      .then((p) => {
        setRows(toRows(p.variables))
        setApiConfig(fromApiProfileConfig(p.api))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [filePath])

  const markDirty = useCallback(() => {
    setDirty(true)
    markTabDirty(filePath, true)
  }, [filePath, markTabDirty])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await writeEnv(filePath, fromRows(rows), toApiProfileConfig(apiConfig))
      setDirty(false)
      markTabDirty(filePath, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [filePath, rows, apiConfig, markTabDirty])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void save() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  const updateRow = (id: string, field: 'key' | 'value', val: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: val } : r))
    markDirty()
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    markDirty()
  }

  const addRow = () => {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])
    markDirty()
  }

  const name = profileName(filePath)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0 bg-panel">
        <SlidersHorizontal className="w-4 h-4 text-primary/70 shrink-0" />
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
          profile
        </span>
        <div className="flex items-center gap-0.5 ml-2">
          {(['variables', 'api'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'text-[11px] px-3 py-1 rounded transition-colors',
                tab === t ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'variables' ? 'Variables' : 'API Config'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {dirty && <span className="text-[10px] text-yellow-400">unsaved</span>}
        <Button size="sm" onClick={() => void save()} disabled={saving || !dirty} className="h-7 px-3 text-xs">
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Save
        </Button>
      </div>

      {error && (
        <div className="px-4 py-1.5 text-xs text-destructive bg-destructive/10 border-b border-border shrink-0">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">
          Loading…
        </div>
      ) : tab === 'api' ? (
        <ApiProfileForm
          state={apiConfig}
          onChange={(s) => { setApiConfig(s); markDirty() }}
        />
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-2xl flex flex-col gap-1">
            {/* column header */}
            <div className="grid grid-cols-[1fr_1fr_28px] gap-2 px-1 mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Variable</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Value</span>
              <span />
            </div>

            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                <Input
                  value={row.key}
                  onChange={(e) => updateRow(row.id, 'key', e.target.value)}
                  placeholder="VARIABLE_NAME"
                  className="h-7 text-xs font-mono"
                />
                <Input
                  value={row.value}
                  onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                  placeholder="value or {{other_var}}"
                  className="h-7 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit px-1 py-1 rounded hover:bg-secondary/50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Variable
            </button>

            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground/40 italic mt-2">
                No variables yet. Add a variable to use {"{{VAR_NAME}}"} in test steps.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
