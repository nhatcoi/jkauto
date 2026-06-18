import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentThinkingStep } from './types'

interface ThinkingSectionProps {
  steps: AgentThinkingStep[]
  isStreaming?: boolean
}

export function ThinkingSection({ steps, isStreaming }: ThinkingSectionProps) {
  const [open, setOpen] = useState(false)

  const doneCount = steps.filter((s) => s.result !== undefined).length
  const label = isStreaming
    ? `Using tools… (${doneCount}/${steps.length})`
    : `${steps.length} tool call${steps.length !== 1 ? 's' : ''}`

  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 text-xs overflow-hidden mb-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <Wrench className="w-3 h-3 shrink-0" />
        <span className="font-medium">{label}</span>
        {isStreaming && doneCount < steps.length && (
          <Loader2 className="w-3 h-3 animate-spin ml-auto shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/40 px-2.5 py-2 flex flex-col gap-2">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'font-mono font-medium px-1 py-0.5 rounded text-[10px]',
                    !isStreaming || step.result !== undefined
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-amber-500/15 text-amber-400',
                  )}
                >
                  {step.name}
                </span>
                {isStreaming && step.result === undefined && (
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground" />
                )}
              </div>
              {step.args && Object.keys(step.args).length > 0 && (
                <div className="ml-2 text-[10px] text-muted-foreground font-mono truncate">
                  {Object.entries(step.args)
                    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v).slice(0, 60)}`)
                    .join(', ')}
                </div>
              )}
              {step.result !== undefined && (
                <div className="ml-2 text-[10px] text-muted-foreground/70 font-mono truncate">
                  → {step.result.slice(0, 120)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
