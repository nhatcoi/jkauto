import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { listEnvs, readProfile, writeEnv, createEnv, deleteEnv } from './api'
import { ApiProfileForm, fromApiProfileConfig, toApiProfileConfig } from './ApiProfileForm'
import type { ApiConfigState } from './ApiProfileForm'
import type { EnvEntry } from '@jkauto/core'

type Tab = 'variables' | 'api'


interface EnvRow {
  id: string
  key: string
  value: string
}

function toRows(vars: Record<string, string>): EnvRow[] {
  return Object.entries(vars).map(([key, value]) => ({ id: crypto.randomUUID(), key, value }))
}

function fromRows(rows: EnvRow[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const row of rows) {
    if (row.key.trim()) result[row.key.trim()] = row.value
  }
  return result
}

interface Props {
  open: boolean
  onClose: () => void
}

export function EnvManagerDialog({ open, onClose }: Props) {
  const { activeProject, setActiveProfile } = useProjectStore()

  const [envs, setEnvs] = useState<EnvEntry[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [rows, setRows] = useState<EnvRow[]>([])
  const [apiConfig, setApiConfig] = useState<ApiConfigState>(fromApiProfileConfig(undefined))
  const [tab, setTab] = useState<Tab>('variables')
  const [loadingVars, setLoadingVars] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [error, setError] = useState('')

  const projectPath = activeProject?.path ?? null
  const activeProfileName = activeProject?.activeProfile ?? 'default'

  const loadEnvs = useCallback(async () => {
    if (!projectPath) return
    const list = await listEnvs(projectPath)
    setEnvs(list)
    if (list.length > 0 && !selectedPath) {
      const active = list.find((e) => e.name === activeProfileName) ?? list[0]
      setSelectedPath(active.path)
    }
  }, [projectPath, activeProfileName, selectedPath])

  useEffect(() => {
    if (open) loadEnvs()
  }, [open, loadEnvs])

  useEffect(() => {
    if (!selectedPath) return
    setLoadingVars(true)
    setDirty(false)
    readProfile(selectedPath)
      .then((profile) => {
        setRows(toRows(profile.variables))
        setApiConfig(fromApiProfileConfig(profile.api))
      })
      .catch(() => { setRows([]); setApiConfig(fromApiProfileConfig(undefined)) })
      .finally(() => setLoadingVars(false))
  }, [selectedPath])

  const selectEnv = (path: string) => {
    if (dirty) {
      if (!confirm('Discard unsaved changes?')) return
    }
    setSelectedPath(path)
  }

  const addRow = () => {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])
    setDirty(true)
  }

  const updateRow = (id: string, field: 'key' | 'value', val: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
    setDirty(true)
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setDirty(true)
  }

  const save = async () => {
    if (!selectedPath) return
    setSaving(true)
    try {
      await writeEnv(selectedPath, fromRows(rows), toApiProfileConfig(apiConfig))
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateEnv = async () => {
    const name = newName.trim()
    if (!name || !projectPath) return
    if (envs.some((e) => e.name === name)) {
      setError(`Profile "${name}" already exists`)
      return
    }
    try {
      const entry = await createEnv(projectPath, name)
      setEnvs((prev) => [...prev, entry].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedPath(entry.path)
      setNewName('')
      setAddingNew(false)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const handleDeleteEnv = async (entry: EnvEntry) => {
    if (!confirm(`Delete environment "${entry.name}"? This cannot be undone.`)) return
    try {
      await deleteEnv(entry.path)
      const updated = envs.filter((e) => e.path !== entry.path)
      setEnvs(updated)
      if (selectedPath === entry.path) {
        const fallback = updated[0] ?? null
        setSelectedPath(fallback?.path ?? null)
      }
      if (activeProfileName === entry.name && projectPath && updated[0]) {
        setActiveProfile(projectPath, updated[0].name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const setAsActive = (entry: EnvEntry) => {
    if (!projectPath) return
    setActiveProfile(projectPath, entry.name)
  }

  const selectedEnv = envs.find((e) => e.path === selectedPath)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden h-[560px] flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-sm">Manage Environments</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: env list */}
          <div className="w-52 border-r border-border flex flex-col shrink-0">
            <div className="flex-1 overflow-auto">
              {envs.map((entry) => {
                const isActive = entry.name === activeProfileName
                const isSelected = entry.path === selectedPath
                return (
                  <div
                    key={entry.path}
                    onClick={() => selectEnv(entry.path)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 cursor-pointer group hover:bg-secondary/50 transition-colors',
                      isSelected && 'bg-secondary',
                    )}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        isActive ? 'bg-green-400' : 'bg-transparent border border-border',
                      )}
                    />
                    <span className={cn('flex-1 text-xs truncate', isSelected ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                      {entry.name}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAsActive(entry) }}
                          title="Set as active"
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-green-400/20 text-muted-foreground hover:text-green-400"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      {envs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteEnv(entry) }}
                          title="Delete environment"
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add new env */}
            <div className="px-3 py-2 border-t border-border">
              {addingNew ? (
                <div className="flex gap-1">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="env name"
                    className="h-6 text-xs px-2 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateEnv()
                      if (e.key === 'Escape') { setAddingNew(false); setNewName('') }
                    }}
                  />
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={handleCreateEnv}>
                    Add
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingNew(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-0.5"
                >
                  <Plus className="w-3 h-3" />
                  New Environment
                </button>
              )}
            </div>
          </div>

          {/* Right: variable editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedEnv ? (
              <>
                {/* header with tabs */}
                <div className="flex items-center border-b border-border shrink-0">
                  <div className="flex items-center gap-0 px-2 py-1.5 flex-1">
                    <span className="text-xs font-medium text-foreground mr-2">{selectedEnv.name}</span>
                    {selectedEnv.name === activeProfileName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-400/15 text-green-400 font-medium mr-2">
                        active
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setTab('variables')}
                      className={cn('text-[11px] px-2.5 py-1 rounded transition-colors', tab === 'variables' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                      Variables
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('api')}
                      className={cn('text-[11px] px-2.5 py-1 rounded transition-colors', tab === 'api' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                      API Config
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-3">
                    {dirty && <span className="text-[10px] text-yellow-400">unsaved</span>}
                    <Button size="sm" onClick={save} disabled={saving || !dirty} className="h-6 px-3 text-xs">
                      {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                      Save
                    </Button>
                  </div>
                </div>

                {tab === 'api' ? (
                  <ApiProfileForm
                    state={apiConfig}
                    onChange={(s) => { setApiConfig(s); setDirty(true) }}
                  />
                ) : (
                  <div className="flex-1 overflow-auto p-3">
                    {loadingVars ? (
                      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                        Loading…
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0">
                        <div className="grid grid-cols-[1fr_1fr_24px] gap-2 px-2 py-1 mb-1">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Variable</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Value</span>
                          <span />
                        </div>
                        {rows.map((row) => (
                          <div key={row.id} className="grid grid-cols-[1fr_1fr_24px] gap-2 items-center py-0.5">
                            <Input
                              value={row.key}
                              onChange={(e) => updateRow(row.id, 'key', e.target.value)}
                              placeholder="VARIABLE_NAME"
                              className="h-7 text-xs font-mono"
                            />
                            <Input
                              value={row.value}
                              onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                              placeholder="value"
                              className="h-7 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addRow}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 py-1 rounded hover:bg-secondary/50 transition-colors w-fit px-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Variable
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
                Select an environment to edit its variables
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="px-5 py-1.5 border-t border-border bg-destructive/10 text-xs text-destructive shrink-0">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
