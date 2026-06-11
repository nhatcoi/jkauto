import { Plus, Trash2, CircleCheck, CircleX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Assertion, AssertionResult } from '../types'

interface Props {
  assertions: Assertion[]
  results: AssertionResult[]
  onChange: (assertions: Assertion[]) => void
}

const TARGETS = [
  { value: 'status', label: 'Status Code' },
  { value: 'header', label: 'Header' },
  { value: 'body-json-path', label: 'JSON Path' },
  { value: 'response-time', label: 'Response Time (ms)' },
] as const

const OPS = [
  { value: 'eq', label: '==' },
  { value: 'ne', label: '!=' },
  { value: 'contains', label: 'contains' },
  { value: 'not-contains', label: "doesn't contain" },
  { value: 'lt', label: '<' },
  { value: 'gt', label: '>' },
  { value: 'exists', label: 'exists' },
  { value: 'not-exists', label: "doesn't exist" },
] as const

export function AssertionsPanel({ assertions, results, onChange }: Props) {
  const addRow = () =>
    onChange([
      ...assertions,
      { id: crypto.randomUUID(), target: 'status', op: 'eq', expected: '200' },
    ])

  const updateRow = (idx: number, patch: Partial<Assertion>) =>
    onChange(assertions.map((a, i) => (i === idx ? { ...a, ...patch } : a)))

  const removeRow = (idx: number) =>
    onChange(assertions.filter((_, i) => i !== idx))

  const resultMap = new Map(results.map((r) => [r.id, r]))
  const needsPath = (a: Assertion) => a.target === 'header' || a.target === 'body-json-path'
  const hasExpected = (a: Assertion) => !['exists', 'not-exists'].includes(a.op)

  return (
    <div className="p-3 flex flex-col gap-2">
      {assertions.length === 0 && (
        <p className="text-xs text-muted-foreground/60 py-2">No assertions. Add one to validate responses.</p>
      )}

      {assertions.map((assertion, idx) => {
        const result = resultMap.get(assertion.id)
        return (
          <div
            key={assertion.id}
            className={cn(
              'flex items-center gap-2 p-2 rounded border',
              result
                ? result.passed
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-red-500/30 bg-red-500/5'
                : 'border-border bg-muted/20',
            )}
          >
            {result && (
              <span className="shrink-0">
                {result.passed
                  ? <CircleCheck className="w-3.5 h-3.5 text-green-500" />
                  : <CircleX className="w-3.5 h-3.5 text-red-500" />
                }
              </span>
            )}

            <select
              value={assertion.target}
              onChange={(e) => updateRow(idx, { target: e.target.value as Assertion['target'], path: undefined })}
              className="bg-input text-foreground text-xs px-1.5 py-0.5 rounded border border-border focus:border-primary outline-none"
            >
              {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {needsPath(assertion) && (
              <input
                value={assertion.path ?? ''}
                onChange={(e) => updateRow(idx, { path: e.target.value })}
                placeholder={assertion.target === 'header' ? 'Content-Type' : '$.data.id'}
                className="w-28 bg-input text-foreground text-xs px-2 py-0.5 rounded border border-border focus:border-primary outline-none font-mono"
              />
            )}

            <select
              value={assertion.op}
              onChange={(e) => updateRow(idx, { op: e.target.value as Assertion['op'] })}
              className="bg-input text-foreground text-xs px-1.5 py-0.5 rounded border border-border focus:border-primary outline-none"
            >
              {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {hasExpected(assertion) && (
              <input
                value={assertion.expected}
                onChange={(e) => updateRow(idx, { expected: e.target.value })}
                placeholder="expected"
                className="flex-1 bg-input text-foreground text-xs px-2 py-0.5 rounded border border-border focus:border-primary outline-none font-mono"
              />
            )}

            {result && !result.passed && (
              <span className="text-[10px] text-red-400 truncate max-w-[140px]" title={result.message}>
                {result.message}
              </span>
            )}

            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 rounded hover:bg-secondary/50 transition-colors w-fit"
      >
        <Plus className="w-3 h-3" />
        Add Assertion
      </button>
    </div>
  )
}
