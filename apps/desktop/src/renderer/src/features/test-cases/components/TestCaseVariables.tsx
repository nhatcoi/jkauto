import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  variables: Record<string, string>
  onChange: (vars: Record<string, string>) => void
}

export function TestCaseVariables({ variables, onChange }: Props) {
  const entries = Object.entries(variables)
  const [open, setOpen] = useState(entries.length > 0)

  const setVar = (oldKey: string, newKey: string, value: string) => {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(variables)) {
      if (k === oldKey) next[newKey] = value
      else next[k] = v
    }
    onChange(next)
  }

  const addVar = () => {
    const base = 'VAR'
    let key = base
    let n = 1
    while (key in variables) key = `${base}_${n++}`
    onChange({ ...variables, [key]: '' })
    if (!open) setOpen(true)
  }

  const removeVar = (key: string) => {
    const next = { ...variables }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="border-b border-border shrink-0">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Variables</span>
        {entries.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50 font-mono">({entries.length})</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); addVar() }}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Add variable"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {entries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/40 italic py-1">
              No variables. Click + to add.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 mb-0.5">
                <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide">Name</span>
                <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide">Value</span>
                <span className="w-5" />
              </div>
              {entries.map(([key, val]) => (
                <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                  <input
                    value={key}
                    onChange={(e) => setVar(key, e.target.value, val)}
                    className={cn(
                      'text-[11px] bg-input text-foreground font-mono px-2 py-1 rounded border border-border',
                      'focus:border-primary outline-none placeholder:text-muted-foreground/30 transition-colors',
                    )}
                    placeholder="VAR_NAME"
                  />
                  <input
                    value={val}
                    onChange={(e) => setVar(key, key, e.target.value)}
                    className={cn(
                      'text-[11px] bg-input text-foreground font-mono px-2 py-1 rounded border border-border',
                      'focus:border-primary outline-none placeholder:text-muted-foreground/30 transition-colors',
                    )}
                    placeholder="value"
                  />
                  <button
                    type="button"
                    onClick={() => removeVar(key)}
                    className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
