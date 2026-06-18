import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wrench,
} from 'lucide-react'
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
    ? `Working · ${doneCount}/${steps.length} actions`
    : `Completed ${steps.length} action${steps.length !== 1 ? 's' : ''}`

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border/50 bg-secondary/20 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        {isStreaming && doneCount < steps.length ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-400" />
        ) : (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
        )}
        <span className="font-medium">{label}</span>
        <Wrench className="ml-auto h-3 w-3 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border/40 px-3 py-2.5">
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
                    .map(
                      ([k, v]) =>
                        `${k}: ${typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v).slice(0, 60)}`,
                    )
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
