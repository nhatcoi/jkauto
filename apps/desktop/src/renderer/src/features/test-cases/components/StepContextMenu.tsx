import { Plus, Copy, Scissors, Clipboard, AlertCircle, Trash2, PhoneCall } from 'lucide-react'
import type { TestStep } from '../types'

interface StepContextMenuProps {
  x: number
  y: number
  clipboard: Partial<TestStep> | null
  stepIdx: number
  onInsertBefore: (idx: number) => void
  onInsertAfter: (idx: number) => void
  onCallTestCase: (idx: number) => void
  onCopy: (idx: number) => void
  onCut: (idx: number) => void
  onPasteBefore: (idx: number) => void
  onPasteAfter: (idx: number) => void
  onToggleFailure: (idx: number) => void
  onDelete: (idx: number) => void
}

export function StepContextMenu({
  x,
  y,
  clipboard,
  stepIdx,
  onInsertBefore,
  onInsertAfter,
  onCallTestCase,
  onCopy,
  onCut,
  onPasteBefore,
  onPasteAfter,
  onToggleFailure,
  onDelete,
}: StepContextMenuProps) {
  return (
    <div
      id="step-context-menu"
      className="fixed z-[100] w-56 bg-popover border border-border rounded-md shadow-lg py-1 text-xs text-popover-foreground outline-none select-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <button
        onClick={() => onInsertBefore(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors"
      >
        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        Insert Step Before
      </button>
      <button
        onClick={() => onInsertAfter(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors"
      >
        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        Insert Step After
      </button>
      <button
        onClick={() => onCallTestCase(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors"
      >
        <PhoneCall className="w-3.5 h-3.5 text-cyan-500" />
        Call Test Case
      </button>

      <div className="h-px bg-border my-1" />

      <button
        onClick={() => onCopy(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors"
      >
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        Copy Step
      </button>
      <button
        onClick={() => onCut(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors"
      >
        <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
        Cut Step
      </button>
      <button
        disabled={!clipboard}
        onClick={() => onPasteBefore(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Clipboard className="w-3.5 h-3.5 text-muted-foreground" />
        Paste Step Before
      </button>
      <button
        disabled={!clipboard}
        onClick={() => onPasteAfter(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Clipboard className="w-3.5 h-3.5 text-muted-foreground" />
        Paste Step After
      </button>

      <div className="h-px bg-border my-1" />

      <button
        onClick={() => onToggleFailure(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors"
      >
        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
        Toggle Continue on Failure
      </button>
      <button
        onClick={() => onDelete(stepIdx)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
        Delete Step
      </button>
    </div>
  )
}
