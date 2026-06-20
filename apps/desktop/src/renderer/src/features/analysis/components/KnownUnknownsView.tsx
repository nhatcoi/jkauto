import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface KnowledgeGap {
  id: string
  kind: string
  title: string
  reason: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  moduleId?: string
  suggestedActions: string[]
}

interface UnknownsData {
  gaps?: KnowledgeGap[]
}

const PRIORITY_CONFIG: Record<
  KnowledgeGap['priority'],
  { label: string; icon: typeof AlertCircle; color: string; border: string; bg: string }
> = {
  critical: {
    label: 'Critical',
    icon: AlertCircle,
    color: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
  },
  normal: {
    label: 'Normal',
    icon: Info,
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
  },
  low: {
    label: 'Low',
    icon: Info,
    color: 'text-muted-foreground',
    border: 'border-border',
    bg: 'bg-card/20',
  },
}

const PRIORITY_ORDER: KnowledgeGap['priority'][] = ['critical', 'high', 'normal', 'low']

export function KnownUnknownsView({ contentJson }: { contentJson: string }) {
  let data: UnknownsData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const gaps = data.gaps ?? []

  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground/25" />
        <p className="text-sm text-muted-foreground">No knowledge gaps detected.</p>
      </div>
    )
  }

  const grouped = PRIORITY_ORDER.reduce<Record<string, KnowledgeGap[]>>((acc, priority) => {
    const items = gaps.filter((gap) => gap.priority === priority)
    if (items.length > 0) acc[priority] = items
    return acc
  }, {})

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([priority, items]) => (
        <PriorityGroup
          key={priority}
          priority={priority as KnowledgeGap['priority']}
          gaps={items}
        />
      ))}
    </div>
  )
}

function PriorityGroup({
  priority,
  gaps,
}: {
  priority: KnowledgeGap['priority']
  gaps: KnowledgeGap[]
}) {
  const config = PRIORITY_CONFIG[priority]
  const Icon = config.icon

  return (
    <div className={cn('rounded-lg border', config.border, config.bg)}>
      <div className={cn('flex items-center gap-2 px-3 py-2 text-[11px] font-medium', config.color)}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
        <span className="ml-auto rounded-full bg-current/10 px-1.5 py-0.5 text-[9px]">
          {gaps.length}
        </span>
      </div>
      <div className="divide-y divide-border/40">
        {gaps.map((gap) => (
          <GapRow key={gap.id} gap={gap} />
        ))}
      </div>
    </div>
  )
}

function GapRow({ gap }: { gap: KnowledgeGap }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="px-3 py-2">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium">{gap.title}</span>
            <span className="rounded bg-secondary px-1 py-0.5 text-[9px] text-muted-foreground">
              {gap.kind}
            </span>
          </div>
          {!open && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{gap.reason}</p>
          )}
        </div>
      </button>

      {open && (
        <div className="ml-5 mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">{gap.reason}</p>
          {gap.suggestedActions.length > 0 && (
            <div>
              <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Suggested actions
              </p>
              <ul className="space-y-0.5">
                {gap.suggestedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px]">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gap.moduleId && (
            <p className="text-[10px] text-muted-foreground">
              Module: <span className="font-mono">{gap.moduleId}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
