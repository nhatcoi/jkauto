import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Save,
  Play,
  Bug,
  History,
  CircleCheck,
  CircleX,
  Circle,
  Loader2,
  Square,
  Upload,
  AlertCircle,
  StepForward,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { invoke } from '@/lib/utils'
import { IpcChannels } from '@jkauto/core'
import type { RunRecord } from '@jkauto/core'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import type { StepStatus } from '@/store/run.store'
import { getKeyword } from './keywords'
import { readEnv } from '@/features/env/api'
import { ImportStepsDialog } from './components/ImportStepsDialog'
import { StepRow } from './components/StepRow'
import { StepContextMenu } from './components/StepContextMenu'
import { RunHistoryPanel } from './components/RunHistoryPanel'
import type { TestCase, TestStep } from './types'

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

export function TestCaseEditor({ filePath }: { filePath: string }) {
  const { markTabDirty, activeProject } = useProjectStore()
  const {
    startRun,
    handleStepEvent,
    handleRunComplete,
    stopRun,
    status: runStatus,
    stepStatuses,
    stepMessages,
    runId,
    runHistory,
    setRunHistory,
    appendRunRecord,
    isDebugMode,
    isDebugPaused,
  } = useRunStore()
  
  const [tc, setTc] = useState<TestCase | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Drag and Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Context Menu and Clipboard State
  const [clipboard, setClipboard] = useState<Partial<TestStep> | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    visible: boolean
    stepIdx: number
  } | null>(null)

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

  // Load run history whenever the file changes
  useEffect(() => {
    invoke<RunRecord[]>(IpcChannels.ENGINE_GET_RUNS, filePath)
      .then((records) => setRunHistory(records ?? []))
      .catch(() => setRunHistory([]))
  }, [filePath, setRunHistory])

  useEffect(() => {
    load()
  }, [load])

  // Subscribe to engine events
  useEffect(() => {
    const offStep = window.api.on(IpcChannels.ENGINE_STEP_EVENT, (event: any) => {
      handleStepEvent(event)
    })
    // ENGINE_DEBUG_NEXT from main signals engine is paused — store already tracks via handleStepEvent
    // We just need to unsub on cleanup; the actual pause state is managed in run.store
    const offDebugNext = window.api.on(IpcChannels.ENGINE_DEBUG_NEXT, () => {})
    const offComplete = window.api.on(IpcChannels.ENGINE_RUN_COMPLETE, (event: any) => {
      handleRunComplete(event)
      // Persist the run record and update in-memory history
      const record: RunRecord = {
        runId: event.runId,
        filePath,
        status: event.status,
        totalSteps: event.totalSteps,
        passedSteps: event.passedSteps,
        failedSteps: event.failedSteps,
        durationMs: event.durationMs,
        startedAt: new Date(Date.now() - event.durationMs).toISOString(),
        endedAt: new Date().toISOString(),
      }
      appendRunRecord(record)
      invoke(IpcChannels.ENGINE_SAVE_RUN, filePath, record).catch(console.error)
    })
    return () => {
      offStep()
      offDebugNext()
      offComplete()
    }
  }, [filePath, handleStepEvent, handleRunComplete, appendRunRecord])

  const handleRun = useCallback(async (debugMode = false) => {
    if (runStatus === 'running') return
    const current = tcRef.current
    if (current) {
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(current, null, 2))
      markTabDirty(filePath, false)
    }
    let profileVariables: Record<string, string> = {}
    if (activeProject) {
      try {
        profileVariables = await readEnv(
          `${activeProject.path}/profiles/${activeProject.activeProfile}.env.json`,
        )
      } catch { /* profile missing — ignore */ }
    }
    const result = await invoke<{ runId: string }>(IpcChannels.ENGINE_RUN_CASE, {
      filePath,
      debugMode,
      profileVariables,
    })
    startRun(result.runId, filePath, debugMode)
  }, [filePath, runStatus, markTabDirty, startRun, activeProject])

  const handleStop = useCallback(async () => {
    if (!runId) return
    await invoke(IpcChannels.ENGINE_STOP, runId)
    stopRun()
  }, [runId, stopRun])

  const handleDebugNext = useCallback(async () => {
    if (!runId) return
    await invoke(IpcChannels.ENGINE_DEBUG_NEXT, runId)
  }, [runId])

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
    setSelectedIdx(tc?.steps.length ?? 0)
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

  const handleImport = (importedSteps: any[]) => {
    mutate((tc) => ({
      ...tc,
      steps: [...tc.steps, ...importedSteps],
    }))
  }

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
  }

  const handleDragEnter = (index: number) => {
    setDragOverIdx(index)
  }

  const handleDragLeave = () => {
    // handled on dragEnd / drop
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      return
    }

    mutate((tc) => {
      const steps = [...tc.steps]
      const [draggedItem] = steps.splice(draggedIdx, 1)
      steps.splice(targetIndex, 0, draggedItem)
      return { ...tc, steps }
    })
    
    setSelectedIdx(targetIndex)
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  // Context Menu Handlers
  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    setSelectedIdx(index)
    
    const menuWidth = 220
    const menuHeight = 280
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    
    let posX = e.clientX
    let posY = e.clientY
    
    if (posX + menuWidth > screenWidth) posX = screenWidth - menuWidth - 8
    if (posY + menuHeight > screenHeight) posY = screenHeight - menuHeight - 8

    setContextMenu({
      x: posX,
      y: posY,
      visible: true,
      stepIdx: index
    })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Action Methods
  const insertStepBefore = (idx: number) => {
    mutate((tc) => {
      const steps = [...tc.steps]
      steps.splice(idx, 0, makeStep())
      return { ...tc, steps }
    })
    setSelectedIdx(idx)
  }

  const insertStepAfter = (idx: number) => {
    mutate((tc) => {
      const steps = [...tc.steps]
      steps.splice(idx + 1, 0, makeStep())
      return { ...tc, steps }
    })
    setSelectedIdx(idx + 1)
  }

  const copyStep = (idx: number) => {
    if (!tc) return
    const stepToCopy = tc.steps[idx]
    setClipboard({ ...stepToCopy, id: undefined })
  }

  const cutStep = (idx: number) => {
    if (!tc) return
    const stepToCut = tc.steps[idx]
    setClipboard({ ...stepToCut, id: undefined })
    deleteStep(idx)
  }

  const pasteStepBefore = (idx: number) => {
    if (!clipboard) return
    mutate((tc) => {
      const steps = [...tc.steps]
      steps.splice(idx, 0, { ...makeStep(clipboard.keyword), ...clipboard, id: crypto.randomUUID() })
      return { ...tc, steps }
    })
    setSelectedIdx(idx)
  }

  const pasteStepAfter = (idx: number) => {
    if (!clipboard) return
    mutate((tc) => {
      const steps = [...tc.steps]
      steps.splice(idx + 1, 0, { ...makeStep(clipboard.keyword), ...clipboard, id: crypto.randomUUID() })
      return { ...tc, steps }
    })
    setSelectedIdx(idx + 1)
  }

  const toggleFailureHandling = (idx: number) => {
    if (!tc) return
    updateStep(idx, { continueOnFailure: !tc.steps[idx].continueOnFailure })
  }

  // Close context menu on window mousedown
  useEffect(() => {
    if (!contextMenu || !contextMenu.visible) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('#step-context-menu')) {
        closeContextMenu()
      }
    }
    
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [contextMenu])

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

        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
        >
          <Upload className="w-3.5 h-3.5" />
          Import Steps
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
          <>
            {isDebugMode && isDebugPaused && (
              <button
                type="button"
                onClick={handleDebugNext}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                title="Execute next step"
              >
                <StepForward className="w-3.5 h-3.5" />
                Next Step
              </button>
            )}
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-red-600 hover:bg-red-500 text-white"
              title="Stop run"
            >
              <Square className="w-3 h-3 fill-white" />
              Stop
            </button>
          </>
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
              <th className="w-12 px-1 py-1.5" />
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
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                isDragOver={dragOverIdx === idx}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onContextMenu={handleContextMenu}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── history panel ── */}
      {showHistory && <RunHistoryPanel records={runHistory} />}

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

      <ImportStepsDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleImport}
      />

      {contextMenu && contextMenu.visible && (
        <StepContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipboard={clipboard}
          stepIdx={contextMenu.stepIdx}
          onInsertBefore={insertStepBefore}
          onInsertAfter={insertStepAfter}
          onCopy={copyStep}
          onCut={cutStep}
          onPasteBefore={pasteStepBefore}
          onPasteAfter={pasteStepAfter}
          onToggleFailure={toggleFailureHandling}
          onDelete={deleteStep}
        />
      )}
    </div>
  )
}
