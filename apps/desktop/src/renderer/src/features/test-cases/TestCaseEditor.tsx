import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  AlertCircle,
  Play,
  Bug,
  History,
  CircleCheck,
  CircleX,
  Circle,
  Loader2,
  Square,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { invoke } from '@/lib/utils'
import { IpcChannels } from '@jkauto/core'
import type { StepEvent, RunCompleteEvent } from '@jkauto/core'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import type { StepStatus } from '@/store/run.store'
import { BUILT_IN_KEYWORDS, getKeyword } from './keywords'
import type { KeywordDef } from './keywords'

// ── types ──────────────────────────────────────────────────────────────────────
interface TestStep {
  id: string
  keyword: string
  description: string
  objectRef: string
  input: string
  expected: string
  enabled: boolean
  continueOnFailure: boolean
  timeout: number | null
}

interface TestCase {
  schemaVersion: number
  id: string
  name: string
  description: string
  steps: TestStep[]
}

function makeStep(keyword = 'click'): TestStep {
  return {
    id: crypto.randomUUID(),
    keyword,
    description: '',
    objectRef: '',
    input: '',
    expected: '',
    enabled: true,
    continueOnFailure: false,
    timeout: null,
  }
}

// ── keyword picker ─────────────────────────────────────────────────────────────
function KeywordBadge({
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
function CellInput({
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
function StepStatusIcon({ status }: { status?: StepStatus }) {
  if (!status || status === 'idle') return <span className="w-3.5 h-3.5" />
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
  if (status === 'passed') return <CircleCheck className="w-3.5 h-3.5 text-green-500" />
  if (status === 'failed') return <CircleX className="w-3.5 h-3.5 text-red-500" />
  if (status === 'skipped') return <Minus className="w-3.5 h-3.5 text-muted-foreground/50" />
  return null
}

// ── step row ───────────────────────────────────────────────────────────────────
function StepRow({
  step,
  index,
  selected,
  onSelect,
  onChange,
  onDelete,
  kw,
  stepStatus,
  stepMessage,
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
}) {
  return (
    <tr
      onClick={onSelect}
      className={cn(
        'border-b border-border/40 group',
        selected ? 'bg-primary/8' : 'hover:bg-secondary/20',
        !step.enabled && 'opacity-40',
        stepStatus === 'failed' && 'bg-red-500/5',
        stepStatus === 'passed' && 'bg-green-500/5',
        stepStatus === 'running' && 'bg-yellow-500/5',
      )}
    >
      {/* status icon */}
      <td className="w-8 text-center px-1">
        <div className="flex items-center justify-center" title={stepMessage}>
          <StepStatusIcon status={stepStatus} />
        </div>
      </td>

      {/* enabled */}
      <td className="w-7 text-center px-1">
        <input
          type="checkbox"
          checked={step.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          onClick={(e) => e.stopPropagation()}
          className="w-3 h-3 cursor-pointer accent-primary"
        />
      </td>

      {/* keyword */}
      <td className="w-40 px-1 py-1" onClick={(e) => e.stopPropagation()}>
        <KeywordBadge keyword={step.keyword} onChange={(id) => onChange({ keyword: id })} />
      </td>

      {/* description */}
      <td className="px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
        <CellInput
          value={step.description}
          placeholder="Description"
          onChange={(v) => onChange({ description: v })}
        />
      </td>

      {/* object/selector */}
      <td className="w-36 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
        {kw.hasObject ? (
          <CellInput
            value={step.objectRef}
            placeholder={kw.objectPlaceholder ?? 'Selector'}
            onChange={(v) => onChange({ objectRef: v })}
          />
        ) : (
          <span className="text-muted-foreground/20 text-xs px-1.5">—</span>
        )}
      </td>

      {/* input */}
      <td className="w-36 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
        {kw.hasInput ? (
          <CellInput
            value={step.input}
            placeholder={kw.inputPlaceholder ?? 'Input'}
            onChange={(v) => onChange({ input: v })}
          />
        ) : (
          <span className="text-muted-foreground/20 text-xs px-1.5">—</span>
        )}
      </td>

      {/* expected */}
      <td className="w-36 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
        {kw.hasExpected ? (
          <CellInput
            value={step.expected}
            placeholder={kw.expectedPlaceholder ?? 'Expected'}
            onChange={(v) => onChange({ expected: v })}
          />
        ) : (
          <span className="text-muted-foreground/20 text-xs px-1.5">—</span>
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

// ── main editor ────────────────────────────────────────────────────────────────
export function TestCaseEditor({ filePath }: { filePath: string }) {
  const { markTabDirty } = useProjectStore()
  const { startRun, handleStepEvent, handleRunComplete, stopRun, status: runStatus, stepStatuses, stepMessages, runId } = useRunStore()
  const [tc, setTc] = useState<TestCase | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // keep ref for save callback (avoids stale closure in keydown)
  const tcRef = useRef<TestCase | null>(null)
  tcRef.current = tc

  const load = useCallback(async () => {
    try {
      setError('')
      const raw = await invoke<string>(IpcChannels.FS_READ_FILE, filePath)
      const parsed = JSON.parse(raw) as TestCase
      setTc(parsed)
      setSelectedIdx(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [filePath])

  useEffect(() => { load() }, [load])

  // Subscribe to engine events
  useEffect(() => {
    const offStep = window.api.on(IpcChannels.ENGINE_STEP_EVENT, (event: any) => {
      handleStepEvent(event)
    })
    const offComplete = window.api.on(IpcChannels.ENGINE_RUN_COMPLETE, (event: any) => {
      handleRunComplete(event)
    })
    return () => {
      offStep()
      offComplete()
    }
  }, [handleStepEvent, handleRunComplete])

  const handleRun = useCallback(async (debugMode = false) => {
    if (runStatus === 'running') return
    // Auto-save before run
    const current = tcRef.current
    if (current) {
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(current, null, 2))
      markTabDirty(filePath, false)
    }
    const result = await invoke<{ runId: string }>(IpcChannels.ENGINE_RUN_CASE, {
      filePath,
      debugMode,
    })
    startRun(result.runId, filePath)
  }, [filePath, runStatus, markTabDirty, startRun])

  const handleStop = useCallback(async () => {
    if (!runId) return
    await invoke(IpcChannels.ENGINE_STOP, runId)
    stopRun()
  }, [runId, stopRun])

  const save = useCallback(async () => {
    const current = tcRef.current
    if (!current) return
    setSaving(true)
    try {
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(current, null, 2))
      markTabDirty(filePath, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [filePath, markTabDirty])

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  const mutate = (fn: (prev: TestCase) => TestCase) => {
    setTc((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      markTabDirty(filePath, true)
      return next
    })
  }

  const updateStep = (idx: number, patch: Partial<TestStep>) => {
    mutate((tc) => ({
      ...tc,
      steps: tc.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }))
  }

  const addStep = () => {
    mutate((tc) => ({
      ...tc,
      steps: [...tc.steps, makeStep()],
    }))
    setSelectedIdx((tc?.steps.length ?? 0))
  }

  const deleteStep = (idx: number) => {
    mutate((tc) => ({ ...tc, steps: tc.steps.filter((_, i) => i !== idx) }))
    setSelectedIdx(null)
  }

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    mutate((tc) => {
      if (target < 0 || target >= tc.steps.length) return tc
      const steps = [...tc.steps]
      ;[steps[idx], steps[target]] = [steps[target], steps[idx]]
      return { ...tc, steps }
    })
    setSelectedIdx(target)
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-destructive text-xs">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    )
  }

  if (!tc) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading…
      </div>
    )
  }

  const sel = selectedIdx !== null ? tc.steps[selectedIdx] : null

  const RunStatusBadge = () => {
    const map: Record<string, { icon: React.ElementType; label: string; cls: string }> = {
      idle: { icon: Circle, label: 'Never run', cls: 'text-muted-foreground/50' },
      running: { icon: Loader2, label: 'Running…', cls: 'text-yellow-400' },
      passed: { icon: CircleCheck, label: 'Passed', cls: 'text-green-500' },
      failed: { icon: CircleX, label: 'Failed', cls: 'text-red-500' },
      stopped: { icon: Square, label: 'Stopped', cls: 'text-muted-foreground' },
    }
    const { icon: Icon, label, cls } = map[runStatus] ?? map.idle
    return (
      <span className={cn('flex items-center gap-1 text-xs font-medium', cls)}>
        <Icon className={cn('w-3.5 h-3.5', runStatus === 'running' && 'animate-spin')} />
        {label}
      </span>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── toolbar ── */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-panel shrink-0">
        {/* edit actions */}
        <button
          type="button"
          onClick={addStep}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Step
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        <button
          type="button"
          disabled={selectedIdx === null || selectedIdx === 0}
          onClick={() => selectedIdx !== null && moveStep(selectedIdx, -1)}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move Up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={selectedIdx === null || selectedIdx === tc.steps.length - 1}
          onClick={() => selectedIdx !== null && moveStep(selectedIdx, 1)}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move Down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        {/* run status + run controls */}
        <RunStatusBadge />

        <div className="w-px h-4 bg-border mx-0.5" />

        {runStatus === 'running' ? (
          <button
            type="button"
            onClick={handleStop}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-red-600 hover:bg-red-500 text-white"
            title="Stop run"
          >
            <Square className="w-3 h-3 fill-white" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleRun(false)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-[hsl(142,72%,29%)] hover:bg-[hsl(142,72%,34%)] text-white"
            title="Run test case"
          >
            <Play className="w-3 h-3 fill-white" />
            Run
          </button>
        )}

        <button
          type="button"
          disabled={runStatus === 'running'}
          onClick={() => handleRun(true)}
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
            'bg-secondary hover:bg-secondary/80 text-foreground/80',
            'disabled:opacity-40',
          )}
          title="Debug (1s pause between steps)"
        >
          <Bug className="w-3.5 h-3.5" />
          Debug
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
            'hover:bg-secondary text-muted-foreground hover:text-foreground',
            showHistory && 'bg-secondary text-foreground',
          )}
          title="View Test Run History"
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-50"
          title="Save (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* ── table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/30 sticky top-0 z-10">
              <th className="w-8 px-1 py-1.5" />
              <th className="w-7 px-1" />
              <th className="w-40 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                Keyword
              </th>
              <th className="text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                Description
              </th>
              <th className="w-36 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                Object / Selector
              </th>
              <th className="w-36 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                Input
              </th>
              <th className="w-36 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                Expected
              </th>
              <th className="w-8 px-1" />
            </tr>
          </thead>
          <tbody>
            {tc.steps.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-xs text-muted-foreground/50 py-12"
                >
                  No steps yet. Click <strong>Add Step</strong> to get started.
                </td>
              </tr>
            )}
            {tc.steps.map((step, idx) => (
              <StepRow
                key={step.id}
                step={step}
                index={idx}
                selected={selectedIdx === idx}
                onSelect={() => setSelectedIdx(idx)}
                onChange={(patch) => updateStep(idx, patch)}
                onDelete={() => deleteStep(idx)}
                kw={getKeyword(step.keyword)}
                stepStatus={stepStatuses[idx]}
                stepMessage={stepMessages[idx]}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── history panel ── */}
      {showHistory && (
        <div className="border-t border-border bg-muted/10 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground/70">Run History</span>
          </div>
          <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
            No run history yet. Run the test case to see results here.
          </div>
        </div>
      )}

      {/* ── step detail (continue-on-failure, timeout) ── */}
      {sel && (
        <div className="flex items-center gap-4 px-3 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground shrink-0">
          <span className="font-medium text-foreground/60">Step {selectedIdx! + 1}</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sel.continueOnFailure}
              onChange={(e) => updateStep(selectedIdx!, { continueOnFailure: e.target.checked })}
              className="w-3 h-3 accent-primary"
            />
            Continue on failure
          </label>
          <label className="flex items-center gap-1.5">
            Timeout (ms):
            <input
              type="number"
              value={sel.timeout ?? ''}
              placeholder="default"
              onChange={(e) =>
                updateStep(selectedIdx!, {
                  timeout: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20 bg-input text-foreground text-xs px-1.5 py-0.5 rounded border border-border focus:border-primary outline-none"
            />
          </label>
        </div>
      )}
    </div>
  )
}
