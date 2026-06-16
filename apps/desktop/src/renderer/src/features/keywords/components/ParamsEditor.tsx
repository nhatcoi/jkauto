import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { KeywordParam } from '../types'

interface Props {
  params: KeywordParam[]
  onChange: (params: KeywordParam[]) => void
}

export function ParamsEditor({ params, onChange }: Props) {
  const update = (idx: number, patch: Partial<KeywordParam>) => {
    onChange(params.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }

  const add = () => {
    onChange([...params, { name: '', description: '', required: false, defaultValue: '' }])
  }

  const remove = (idx: number) => {
    onChange(params.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameters</span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={add}>
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {params.length === 0 && (
        <div className="text-xs text-muted-foreground/60 py-2 text-center border border-dashed border-border rounded">
          No parameters — custom keywords can reference <code className="font-mono">{'${paramName}'}</code> in inputs
        </div>
      )}

      {params.map((param, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
          <Input
            className="h-7 text-xs"
            placeholder="name"
            value={param.name}
            onChange={(e) => update(idx, { name: e.target.value })}
          />
          <Input
            className="h-7 text-xs"
            placeholder="default value"
            value={param.defaultValue}
            onChange={(e) => update(idx, { defaultValue: e.target.value })}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={param.required}
              onChange={(e) => update(idx, { required: e.target.checked })}
              className="w-3.5 h-3.5 accent-primary"
            />
            Required
          </label>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => remove(idx)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
