import { useEffect, useCallback, useRef, useState } from 'react'
import { Plus, Trash2, Save, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { cn } from '@/lib/utils'
import type { ObjectRepository, ObjectItem, Locator, LocatorStrategy } from './types'

const STRATEGIES: LocatorStrategy[] = ['testid', 'css', 'xpath', 'text', 'role', 'label', 'placeholder']

function makeObject(): ObjectItem {
  return {
    id: crypto.randomUUID(),
    name: 'New Object',
    description: '',
    locators: [{ strategy: 'css', value: '', priority: 0 }],
  }
}

function makeLocator(): Locator {
  return { strategy: 'css', value: '', priority: 0 }
}

export function ObjectEditor({ filePath }: { filePath: string }) {
  const { markTabDirty } = useProjectStore()
  const [repo, setRepo] = useState<ObjectRepository | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const repoRef = useRef<ObjectRepository | null>(null)
  repoRef.current = repo

  const load = useCallback(async () => {
    try {
      setError('')
      const raw = await invoke<string>(IpcChannels.FS_READ_FILE, filePath)
      const parsed = JSON.parse(raw) as ObjectRepository
      setRepo(parsed)
      // expand first object by default
      if (parsed.objects[0]) setExpandedIds(new Set([parsed.objects[0].id]))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [filePath])

  useEffect(() => { load() }, [load])

  const mutate = (fn: (prev: ObjectRepository) => ObjectRepository) => {
    setRepo((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      markTabDirty(filePath, true)
      return next
    })
  }

  const save = useCallback(async () => {
    const current = repoRef.current
    if (!current) return
    setSaving(true)
    try {
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(current, null, 2))
      markTabDirty(filePath, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [filePath, markTabDirty])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addObject = () => {
    const obj = makeObject()
    mutate((r) => ({ ...r, objects: [...r.objects, obj] }))
    setExpandedIds((prev) => new Set([...prev, obj.id]))
  }

  const deleteObject = (id: string) => {
    mutate((r) => ({ ...r, objects: r.objects.filter((o) => o.id !== id) }))
  }

  const updateObject = (id: string, patch: Partial<ObjectItem>) => {
    mutate((r) => ({
      ...r,
      objects: r.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }))
  }

  const addLocator = (objId: string) => {
    mutate((r) => ({
      ...r,
      objects: r.objects.map((o) =>
        o.id === objId ? { ...o, locators: [...o.locators, makeLocator()] } : o,
      ),
    }))
  }

  const updateLocator = (objId: string, idx: number, patch: Partial<Locator>) => {
    mutate((r) => ({
      ...r,
      objects: r.objects.map((o) =>
        o.id === objId
          ? { ...o, locators: o.locators.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }
          : o,
      ),
    }))
  }

  const deleteLocator = (objId: string, idx: number) => {
    mutate((r) => ({
      ...r,
      objects: r.objects.map((o) =>
        o.id === objId ? { ...o, locators: o.locators.filter((_, i) => i !== idx) } : o,
      ),
    }))
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-destructive text-xs">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-panel shrink-0">
        <button
          type="button"
          onClick={addObject}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Object
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* object list */}
      <div className="flex-1 overflow-auto">
        {repo.objects.length === 0 && (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground/50">
            No objects yet. Click <strong className="mx-1">Add Object</strong> to get started.
          </div>
        )}

        {repo.objects.map((obj) => {
          const expanded = expandedIds.has(obj.id)
          return (
            <div key={obj.id} className="border-b border-border">
              {/* object header */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary/30 group"
                onClick={() => toggleExpand(obj.id)}
              >
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                  {expanded
                    ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  }
                </span>
                <input
                  value={obj.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateObject(obj.id, { name: e.target.value })}
                  className="flex-1 bg-transparent text-xs font-medium text-foreground outline-none hover:bg-input focus:bg-input px-1 rounded"
                />
                <input
                  value={obj.description}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateObject(obj.id, { description: e.target.value })}
                  placeholder="description"
                  className="w-48 bg-transparent text-xs text-muted-foreground outline-none hover:bg-input focus:bg-input px-1 rounded"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteObject(obj.id) }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* locators */}
              {expanded && (
                <div className="pl-8 pr-3 pb-2 flex flex-col gap-1">
                  <div className="grid grid-cols-[130px_1fr_80px_24px] gap-1 px-1 py-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Strategy</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Value</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Priority</span>
                    <span />
                  </div>

                  {obj.locators.map((loc, li) => (
                    <div key={li} className="grid grid-cols-[130px_1fr_80px_24px] gap-1 items-center">
                      <select
                        value={loc.strategy}
                        onChange={(e) => updateLocator(obj.id, li, { strategy: e.target.value as LocatorStrategy })}
                        className="bg-input text-foreground text-xs px-1.5 py-0.5 rounded border border-border focus:border-primary outline-none"
                      >
                        {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input
                        value={loc.value}
                        onChange={(e) => updateLocator(obj.id, li, { value: e.target.value })}
                        placeholder="#selector"
                        className="bg-input text-foreground text-xs px-2 py-0.5 rounded border border-border focus:border-primary outline-none font-mono"
                      />
                      <input
                        type="number"
                        value={loc.priority}
                        onChange={(e) => updateLocator(obj.id, li, { priority: parseInt(e.target.value) || 0 })}
                        className="bg-input text-foreground text-xs px-2 py-0.5 rounded border border-border focus:border-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => deleteLocator(obj.id, li)}
                        disabled={obj.locators.length <= 1}
                        className={cn(
                          'w-6 h-6 flex items-center justify-center rounded transition-colors',
                          'text-muted-foreground hover:text-destructive hover:bg-destructive/20',
                          'disabled:opacity-30 disabled:cursor-not-allowed',
                        )}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addLocator(obj.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5 rounded hover:bg-secondary/50 transition-colors w-fit"
                  >
                    <Plus className="w-3 h-3" />
                    Add Locator
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
