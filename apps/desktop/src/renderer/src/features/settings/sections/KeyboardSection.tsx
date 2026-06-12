import { TEST_CASE_KEYMAPS, REQUEST_EDITOR_KEYMAPS, EXPLORER_KEYMAPS } from '@/shared/keymaps'
import { Kbd } from '@/components/ui/kbd'

interface Group {
  title: string
  bindings: Record<string, { label: string; hint: string }>
}

const GROUPS: Group[] = [
  { title: 'Test Case Editor',      bindings: TEST_CASE_KEYMAPS },
  { title: 'Request Editor',        bindings: REQUEST_EDITOR_KEYMAPS },
  { title: 'Explorer',              bindings: EXPLORER_KEYMAPS },
]

const GLOBAL: Record<string, string> = {
  'Settings':    'Ctrl+,',
  'Save':        'Ctrl+S',
}

export function KeyboardSection() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Keyboard Shortcuts</h3>
        <p className="text-xs text-muted-foreground">
          Reference — custom bindings not yet supported.
        </p>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="font-medium text-muted-foreground/70 uppercase tracking-wide text-[10px] pb-1">
          Global
        </div>
        {Object.entries(GLOBAL).map(([label, hint]) => (
          <div key={label} className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-foreground/80">{label}</span>
            <Kbd>{hint}</Kbd>
          </div>
        ))}
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="space-y-1.5 text-xs">
          <div className="font-medium text-muted-foreground/70 uppercase tracking-wide text-[10px] pb-1">
            {group.title}
          </div>
          {Object.values(group.bindings).map((binding) => (
            <div
              key={binding.label}
              className="flex items-center justify-between py-1 border-b border-border/40"
            >
              <span className="text-foreground/80">{binding.label}</span>
              <Kbd>{binding.hint}</Kbd>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
