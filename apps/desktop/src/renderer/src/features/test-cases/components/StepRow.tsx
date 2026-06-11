import { useEffect, useRef, useState } from 'react'
import {
  Trash2,
  CircleCheck,
  CircleX,
  Loader2,
  Minus,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepStatus } from '@/store/run.store'
import { BUILT_IN_KEYWORDS, getKeyword } from '../keywords'
import type { KeywordDef } from '../keywords'
import type { TestStep } from '../types'

// ── keyword picker ─────────────────────────────────────────────────────────────
export function KeywordBadge({
  keyword,
  onChange,
}: {
  keyword: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const kw = getKeyword(keyword)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = BUILT_IN_KEYWORDS.filter((k) =>
    k.label.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch('') }}
        className={cn(
          'text-[11px] font-semibold text-white px-2 py-0.5 rounded cursor-pointer whitespace-nowrap',
          kw.color,
          'hover:opacity-90 transition-opacity',
        )}
      >
        {kw.label}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-52 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keyword…"
              className="w-full text-xs bg-input text-foreground px-2 py-1 rounded outline-none border border-border focus:border-primary"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => { onChange(k.id); setOpen(false) }}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-secondary transition-colors',
                  k.id === keyword && 'bg-secondary/60',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', k.color)} />
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── cell input ─────────────────────────────────────────────────────────────────
export function CellInput({
  value,
  placeholder,
  onChange,
  disabled,
  className,
}: {
  value: string
  placeholder?: string
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'w-full bg-transparent text-xs text-foreground/85 px-1.5 py-0.5 rounded outline-none',
        'border border-transparent hover:border-border focus:border-primary transition-colors',
        'placeholder:text-muted-foreground/40 disabled:opacity-40',
        className,
      )}
    />
  )
}

// ── step status icon ───────────────────────────────────────────────────────────
export function StepStatusIcon({ status }: { status?: StepStatus }) {
  if (!status || status === 'idle') return <span className="w-3.5 h-3.5" />
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
  if (status === 'passed') return <CircleCheck className="w-3.5 h-3.5 text-green-500" />
  if (status === 'failed') return <CircleX className="w-3.5 h-3.5 text-red-500" />
  if (status === 'skipped') return <Minus className="w-3.5 h-3.5 text-muted-foreground/50" />
  return null
}

// ── step row ───────────────────────────────────────────────────────────────────
export function StepRow({
  step,
  index,
  selected,
  onSelect,
  onChange,
  onDelete,
  kw,
  stepStatus,
  stepMessage,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onContextMenu,
}: {
  step: TestStep
  index: number
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<TestStep>) => void
  onDelete: () => void
  kw: KeywordDef
  stepStatus?: StepStatus
  stepMessage?: string
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent, index: number) => void
  isDragOver: boolean
  onDragEnter: (index: number) => void
  onDragLeave: () => void
  onContextMenu: (e: React.MouseEvent, index: number) => void
}) {
  const [isDraggable, setIsDraggable] = useState(false)

  return (
    <tr
      onClick={onSelect}
      onContextMenu={(e) => onContextMenu(e, index)}
      draggable={isDraggable}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnter={() => onDragEnter(index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        'border-b border-border/40 group transition-all duration-150',
        selected ? 'bg-primary/8' : 'hover:bg-secondary/20',
        isDragOver && 'border-t-2 border-primary bg-primary/5',
        !step.enabled && 'opacity-40',
        stepStatus === 'failed' && 'bg-red-500/5',
        stepStatus === 'passed' && 'bg-green-500/5',
        stepStatus === 'running' && 'bg-yellow-500/5',
      )}
    >
      {/* drag handle + status icon */}
      <td className="w-12 text-center px-1">
        <div className="flex items-center justify-center gap-1 select-none">
          <div
            onMouseEnter={() => setIsDraggable(true)}
            onMouseLeave={() => setIsDraggable(false)}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground p-0.5 rounded transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className="w-3 h-3" />
          </div>
          <div className="min-w-[14px]">
            <StepStatusIcon status={stepStatus} />
          </div>
        </div>
      </td>

      {/* enabled */}
      <td className="w-7 text-center px-1">
        <input
          type="checkbox"
          checked={step.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="w-3 h-3 cursor-pointer accent-primary"
        />
      </td>

      {/* keyword */}
      <td className="w-40 px-1 py-1">
        <KeywordBadge keyword={step.keyword} onChange={(id) => onChange({ keyword: id })} />
      </td>

      {/* description */}
      <td className="px-1 py-0.5">
        <CellInput
          value={step.description}
          placeholder="Description"
          onChange={(v) => onChange({ description: v })}
        />
      </td>

      {/* object/selector */}
      <td className="w-36 px-1 py-0.5">
        {kw.hasObject ? (
          <CellInput
            value={step.objectRef}
            placeholder={kw.objectPlaceholder ?? 'Selector'}
            onChange={(v) => onChange({ objectRef: v })}
          />
        ) : (
          <span className="text-muted-foreground/20 text-xs px-1.5 select-none">—</span>
        )}
      </td>

      {/* input */}
      <td className="w-36 px-1 py-0.5">
        {kw.hasInput ? (
          <CellInput
            value={step.input}
            placeholder={kw.inputPlaceholder ?? 'Input'}
            onChange={(v) => onChange({ input: v })}
          />
        ) : (
          <span className="text-muted-foreground/20 text-xs px-1.5 select-none">—</span>
        )}
      </td>

      {/* expected */}
      <td className="w-36 px-1 py-0.5">
        {kw.hasExpected ? (
          <CellInput
            value={step.expected}
            placeholder={kw.expectedPlaceholder ?? 'Expected'}
            onChange={(v) => onChange({ expected: v })}
          />
        ) : (
          <span className="text-muted-foreground/20 text-xs px-1.5 select-none">—</span>
        )}
      </td>

      {/* delete */}
      <td className="w-8 text-center px-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5 rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}
