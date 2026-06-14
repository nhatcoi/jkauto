import { useState } from 'react'
import { Pencil, RotateCcw, Check, X } from 'lucide-react'
import { KEYMAP_REGISTRY, KEYMAP_SCOPES } from '@/shared/keymaps'
import { useAppSettingsStore } from '@/store/app-settings.store'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

const SCOPE_TITLES: Record<string, string> = {
  [KEYMAP_SCOPES.APP]:            'Global',
  [KEYMAP_SCOPES.TEST_CASE]:      'Test Case Editor',
  [KEYMAP_SCOPES.REQUEST_EDITOR]: 'Request Editor',
  [KEYMAP_SCOPES.EXPLORER]:       'Explorer',
}

function captureCombo(e: React.KeyboardEvent): string | null {
  const key = e.key.toLowerCase()
  if (['control', 'meta', 'alt', 'shift'].includes(key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('mod')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(key === ' ' ? 'space' : key)
  return parts.join('+')
}

interface RowProps {
  scopedId: string
  label: string
  defaultHint: string
  overrideKeys: string[] | undefined
  onSave: (scopedId: string, combo: string) => void
  onReset: (scopedId: string) => void
}

function KeymapRow({ scopedId, label, defaultHint, overrideKeys, onSave, onReset }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [captured, setCaptured] = useState('')

  const isOverridden = overrideKeys !== undefined
  const displayHint = isOverridden
    ? (overrideKeys.length ? overrideKeys[0] : '—')
    : (defaultHint || '—')

  if (editing) {
    return (
      <div className="flex items-center justify-between py-1 border-b border-border/40 gap-2">
        <span className="text-foreground/80 text-xs shrink-0">{label}</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            className={cn(
              'text-xs px-2 py-0.5 rounded border bg-muted/40 outline-none w-32 text-center',
              captured ? 'border-primary text-foreground' : 'border-border text-muted-foreground',
            )}
            placeholder="Press shortcut…"
            readOnly
            autoFocus
            value={captured}
            onKeyDown={(e) => {
              e.preventDefault()
              if (e.key === 'Escape') { setEditing(false); setCaptured(''); return }
              const combo = captureCombo(e)
              if (combo) setCaptured(combo)
            }}
          />
          <button
            type="button"
            disabled={!captured}
            onClick={() => { onSave(scopedId, captured); setEditing(false); setCaptured('') }}
            className="text-primary hover:text-primary/80 disabled:opacity-30"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setCaptured('') }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center justify-between py-1 border-b border-border/40">
      <span className="text-foreground/80 text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <Kbd className={cn(isOverridden && 'border-primary/50 text-primary')}>{displayHint}</Kbd>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
        >
          <Pencil className="w-3 h-3" />
        </button>
        {isOverridden && (
          <button
            type="button"
            onClick={() => onReset(scopedId)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Reset to default"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

export function KeyboardSection() {
  const overrides = useAppSettingsStore((s) => s.settings?.keymaps ?? {})
  const update = useAppSettingsStore((s) => s.update)

  const handleSave = (scopedId: string, combo: string) => {
    update({ keymaps: { ...overrides, [scopedId]: [combo] } })
  }

  const handleReset = (scopedId: string) => {
    const { [scopedId]: _, ...rest } = overrides
    update({ keymaps: rest })
  }

  const grouped = Object.keys(KEYMAP_SCOPES).reduce(
    (acc, key) => {
      const scope = KEYMAP_SCOPES[key as keyof typeof KEYMAP_SCOPES]
      acc[scope] = KEYMAP_REGISTRY.filter((r) => r.scopedId.startsWith(`${scope}.`))
      return acc
    },
    {} as Record<string, typeof KEYMAP_REGISTRY>,
  )

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Keyboard Shortcuts</h3>
        <p className="text-xs text-muted-foreground">
          Click the pencil icon to rebind. Overrides saved to settings.json.
        </p>
      </div>

      {Object.entries(grouped).map(([scope, entries]) => (
        <div key={scope} className="space-y-0.5">
          <div className="font-medium text-muted-foreground/70 uppercase tracking-wide text-[10px] pb-1">
            {SCOPE_TITLES[scope] ?? scope}
          </div>
          {entries.map(({ scopedId, binding }) => (
            <KeymapRow
              key={scopedId}
              scopedId={scopedId}
              label={binding.label}
              defaultHint={binding.hint}
              overrideKeys={overrides[scopedId]}
              onSave={handleSave}
              onReset={handleReset}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
