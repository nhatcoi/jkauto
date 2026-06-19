import { Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KeywordMeta } from '@jkauto/core'
import type { StepStatus } from '@/store/run.store'
import type { TestStep } from '../types'
import { getKeyword } from '../keywords'
import { StepStatusIcon } from './StepRow'

const HTTP_KEYWORDS = new Set(['http-request', 'http-request-body'])
const ASSERT_KEYWORDS = new Set([
  'assert-status-code', 'assert-response-contains', 'assert-json-path',
  'assert-header', 'assert-status-range', 'assert-response-time',
])
const SETUP_KEYWORDS = new Set([
  'set-base-url', 'set-request-header', 'set-auth-bearer', 'set-auth-basic', 'set-variable',
])

function stepAutoLabel(step: TestStep): string {
  if (step.description) return step.description
  if (HTTP_KEYWORDS.has(step.keyword)) {
    const method = step.objectRef || 'GET'
    const url = step.input || '/'
    return `${method} ${url}`
  }
  if (step.keyword === 'set-base-url') return step.input || 'Set Base URL'
  if (step.keyword === 'set-auth-bearer') return `Bearer ${step.input || '…'}`
  if (step.keyword === 'extract-body') return `→ {{${step.input || 'var'}}}`
  if (step.keyword === 'assert-status-code') return `Status = ${step.expected || '?'}`
  if (step.keyword === 'assert-json-path') return `${step.objectRef || 'path'} = ${step.expected || '?'}`
  return step.keyword
}

function categoryColor(keyword: string): string {
  if (HTTP_KEYWORDS.has(keyword)) return 'border-l-blue-500'
  if (ASSERT_KEYWORDS.has(keyword)) return 'border-l-amber-500'
  if (SETUP_KEYWORDS.has(keyword)) return 'border-l-slate-400'
  if (keyword === 'extract-body') return 'border-l-violet-500'
  return 'border-l-border'
}

interface StepItemProps {
  step: TestStep
  index: number
  selected: boolean
  kw: KeywordMeta
  status?: StepStatus
  onSelect: () => void
  onDelete: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent, i: number) => void
  onDragOver: (e: React.DragEvent, i: number) => void
  onDrop: (e: React.DragEvent, i: number) => void
  onDragEnd: () => void
  isDragOver: boolean
}

function StepItem({
  step, index, selected, kw, status,
  onSelect, onDelete, onContextMenu,
  onDragStart, onDragOver, onDrop, onDragEnd, isDragOver,
}: StepItemProps) {
  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, index) }}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none transition-colors',
        'border-l-2 border-b border-b-border/30',
        categoryColor(step.keyword),
        selected ? 'bg-primary/10' : 'hover:bg-secondary/40',
        isDragOver && 'border-t-2 border-t-primary',
        !step.enabled && 'opacity-40',
      )}
    >
      <div className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5 shrink-0">
        <GripVertical className="w-3 h-3" />
      </div>
      <span className="text-[10px] text-muted-foreground/40 w-5 text-right shrink-0 font-mono">
        {index + 1}
      </span>
      <div className="shrink-0">
        <StepStatusIcon status={status} />
      </div>
      <span className={cn('text-[10px] font-semibold text-white px-1.5 py-0.5 rounded shrink-0', kw.color)}>
        {kw.label}
      </span>
      <span className="text-xs text-foreground/70 truncate flex-1 min-w-0">
        {stepAutoLabel(step)}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5 rounded shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

interface Props {
  steps: TestStep[]
  keywords: KeywordMeta[]
  selectedIdx: number | null
  stepStatuses: Record<number, StepStatus>
  onSelect: (i: number) => void
  onDelete: (i: number) => void
  onAddStep: () => void
  onContextMenu: (e: React.MouseEvent, i: number) => void
  onDragStart: (e: React.DragEvent, i: number) => void
  onDragOver: (e: React.DragEvent, i: number) => void
  onDrop: (e: React.DragEvent, i: number) => void
  onDragEnd: () => void
  dragOverIdx: number | null
}

export function ApiStepList({
  steps, keywords, selectedIdx, stepStatuses,
  onSelect, onDelete, onAddStep, onContextMenu,
  onDragStart, onDragOver, onDrop, onDragEnd, dragOverIdx,
}: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Steps ({steps.length})
        </span>
        <button
          type="button"
          onClick={onAddStep}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8 text-muted-foreground/50">
            <p className="text-xs">No steps yet</p>
            <button
              type="button"
              onClick={onAddStep}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" />
              Add HTTP Request
            </button>
          </div>
        ) : (
          steps.map((step, i) => (
            <StepItem
              key={step.id}
              step={step}
              index={i}
              selected={selectedIdx === i}
              kw={getKeyword(keywords, step.keyword)}
              status={stepStatuses[i]}
              onSelect={() => onSelect(i)}
              onDelete={() => onDelete(i)}
              onContextMenu={(e) => onContextMenu(e, i)}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              isDragOver={dragOverIdx === i}
            />
          ))
        )}
      </div>
    </div>
  )
}
