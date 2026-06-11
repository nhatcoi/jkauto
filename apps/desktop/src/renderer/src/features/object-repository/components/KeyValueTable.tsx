import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KeyValueItem } from '../types'

interface Props {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  readOnly?: boolean
}

export function KeyValueTable({
  items,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  readOnly = false,
}: Props) {
  const addRow = () =>
    onChange([...items, { key: '', value: '', enabled: true }])

  const updateRow = (idx: number, patch: Partial<KeyValueItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const removeRow = (idx: number) =>
    onChange(items.filter((_, i) => i !== idx))

  return (
    <div className="flex flex-col gap-1">
      {items.length > 0 && (
        <div className="grid grid-cols-[20px_1fr_1fr_24px] gap-1 px-2 py-0.5">
          <span />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Key</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Value</span>
          <span />
        </div>
      )}

      {items.map((item, idx) => (
        <div
          key={idx}
          className={cn(
            'grid grid-cols-[20px_1fr_1fr_24px] gap-1 px-2 items-center',
            !item.enabled && 'opacity-50',
          )}
        >
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => updateRow(idx, { enabled: e.target.checked })}
            disabled={readOnly}
            className="w-3.5 h-3.5 accent-primary"
          />
          <input
            value={item.key}
            onChange={(e) => updateRow(idx, { key: e.target.value })}
            placeholder={keyPlaceholder}
            readOnly={readOnly}
            className="bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:border-primary outline-none w-full"
          />
          <input
            value={item.value}
            onChange={(e) => updateRow(idx, { value: e.target.value })}
            placeholder={valuePlaceholder}
            readOnly={readOnly}
            className="bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:border-primary outline-none w-full font-mono"
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary/50 transition-colors w-fit ml-1"
        >
          <Plus className="w-3 h-3" />
          Add Row
        </button>
      )}

      {items.length === 0 && readOnly && (
        <div className="text-xs text-muted-foreground/50 px-2 py-2">No items</div>
      )}
    </div>
  )
}
