import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  FilePlus2,
  Layers,
  Loader2,
  Play,
  Save,
  Square,
  Trash2,
} from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type { FsTreeNode, RunRecord, StepEvent, SuiteEvent, TestCase, TestSuite } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import { readEnv } from '@/features/env/api'

type SuiteItem = TestSuite['items'][number]
type CaseStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped'

interface TestCaseOption {
  id: string
  name: string
  path: string
}

function isTestCasePath(path: string) {
  return path.endsWith('.test.json') || path.endsWith('.test.yaml') || path.endsWith('.test.yml')
}

function collectTestCasePaths(nodes: FsTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'file' && isTestCasePath(node.path)) paths.push(node.path)
    if (node.children) paths.push(...collectTestCasePaths(node.children))
  }
  return paths
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

function stripTestCaseExtension(path: string) {
  return basename(path).replace(/\.test\.(json|ya?ml)$/i, '')
}

function normalizeSuite(raw: Partial<TestSuite> & { testCaseIds?: string[] }, filePath: string): TestSuite {
  const now = new Date().toISOString()
  const legacyItems =
    raw.testCaseIds?.map((testCaseId, order) => ({
      testCaseId,
      testCasePath: testCaseId,
      enabled: true,
      order,
    })) ?? []

  return {
    schemaVersion: 1,
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name ?? basename(filePath).replace(/\.suite\.(json|ya?ml)$/i, ''),
    description: raw.description ?? '',
    profile: raw.profile ?? 'default',
    continueOnFailure: raw.continueOnFailure ?? false,
    items: (raw.items ?? legacyItems).map((item, index) => ({
      testCaseId: item.testCaseId,
      testCasePath: item.testCasePath,
      enabled: item.enabled ?? true,
      order: item.order ?? index,
    })),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  }
}

async function readTestCaseOption(path: string): Promise<TestCaseOption> {
  try {
    const raw = await invoke<string>(IpcChannels.FS_READ_FILE, path)
    const parsed = JSON.parse(raw) as Partial<TestCase>
    return {
      id: parsed.id ?? path,
      name: parsed.name ?? stripTestCaseExtension(path),
      path,
    }
  } catch {
    return {
      id: path,
      name: stripTestCaseExtension(path),
      path,
    }
  }
}

export function SuiteEditor({ filePath }: { filePath: string }) {
  const { activeProject, markTabDirty, openTab } = useProjectStore()
  const {
    startRun,
    handleStepEvent,
    handleSuiteEvent,
    handleRunComplete,
    stopRun,
    appendRunRecord,
    runId,
    status: runStatus,
  } = useRunStore()
  const [suite, setSuite] = useState<TestSuite | null>(null)
  const [testCases, setTestCases] = useState<TestCaseOption[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [caseStatuses, setCaseStatuses] = useState<Record<string, CaseStatus>>({})
  const [caseMessages, setCaseMessages] = useState<Record<string, string>>({})
  const suiteRef = useRef<TestSuite | null>(null)
  suiteRef.current = suite

  const sortedItems = useMemo(
    () => [...(suite?.items ?? [])].sort((a, b) => a.order - b.order),
    [suite],
  )

  const itemNames = useMemo(() => {
    const byId = new Map(testCases.map((tc) => [tc.id, tc]))
    const byPath = new Map(testCases.map((tc) => [tc.path, tc]))
    return new Map(
      sortedItems.map((item) => {
        const match = byId.get(item.testCaseId) ?? byPath.get(item.testCasePath)
        return [item.testCasePath, match?.name ?? stripTestCaseExtension(item.testCasePath)]
      }),
    )
  }, [sortedItems, testCases])

  const loadSuite = useCallback(async () => {
    try {
      setError('')
      const raw = await invoke<string>(IpcChannels.FS_READ_FILE, filePath)
      const parsed = normalizeSuite(JSON.parse(raw), filePath)
      setSuite(parsed)
      setSelectedIdx(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suite')
    }
  }, [filePath])

  const loadTestCases = useCallback(async () => {
    if (!activeProject) return
    const tree = await invoke<FsTreeNode[]>(IpcChannels.FS_TREE, activeProject.path)
    const paths = collectTestCasePaths(tree).sort((a, b) => a.localeCompare(b))
    const options = await Promise.all(paths.map(readTestCaseOption))
    setTestCases(options)
    setSelectedPath((current) => current || options[0]?.path || '')
  }, [activeProject])

  useEffect(() => {
    loadSuite()
  }, [loadSuite])

  useEffect(() => {
    loadTestCases().catch(() => setTestCases([]))
  }, [loadTestCases])

  useEffect(() => {
    const offSuite = window.api.on(IpcChannels.ENGINE_SUITE_EVENT, (payload: unknown) => {
      const event = payload as SuiteEvent
      handleSuiteEvent(event)

      if (event.type === 'case-start' && event.testCasePath) {
        setCaseStatuses((prev) => ({ ...prev, [event.testCasePath!]: 'running' }))
      }
      if (event.type === 'case-complete' && event.testCasePath) {
        setCaseStatuses((prev) => ({
          ...prev,
          [event.testCasePath!]: event.status === 'stopped' ? 'skipped' : event.status ?? 'idle',
        }))
        if (event.message) {
          setCaseMessages((prev) => ({ ...prev, [event.testCasePath!]: event.message ?? '' }))
        }
      }
    })
    const offStep = window.api.on(IpcChannels.ENGINE_STEP_EVENT, (payload: unknown) => {
      const event = payload as StepEvent
      handleStepEvent(event)
      const item = suiteRef.current?.items.find((candidate) => candidate.testCaseId === event.testCaseId)
      if (!item) return
      setCaseStatuses((prev) => ({
        ...prev,
        [item.testCasePath]: event.status === 'failed' ? 'failed' : 'running',
      }))
      if (event.message) {
        setCaseMessages((prev) => ({ ...prev, [item.testCasePath]: event.message ?? '' }))
      }
    })
    const offComplete = window.api.on(IpcChannels.ENGINE_RUN_COMPLETE, (event: any) => {
      handleRunComplete(event)
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
      offSuite()
      offStep()
      offComplete()
    }
  }, [filePath, handleSuiteEvent, handleStepEvent, handleRunComplete, appendRunRecord])

  const mutate = (fn: (prev: TestSuite) => TestSuite) => {
    setSuite((prev) => {
      if (!prev) return prev
      const next = { ...fn(prev), updatedAt: new Date().toISOString() }
      markTabDirty(filePath, true)
      return next
    })
  }

  const save = useCallback(async () => {
    const current = suiteRef.current
    if (!current) return
    setSaving(true)
    try {
      const normalized = {
        ...current,
        items: [...current.items]
          .sort((a, b) => a.order - b.order)
          .map((item, order) => ({ ...item, order })),
        updatedAt: new Date().toISOString(),
      }
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(normalized, null, 2))
      setSuite(normalized)
      markTabDirty(filePath, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [filePath, markTabDirty])

  const addSelectedTestCase = () => {
    if (!selectedPath || !suite) return
    const option = testCases.find((tc) => tc.path === selectedPath)
    if (!option) return
    if (suite.items.some((item) => item.testCasePath === option.path || item.testCaseId === option.id)) return

    mutate((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          testCaseId: option.id,
          testCasePath: option.path,
          enabled: true,
          order: prev.items.length,
        },
      ],
    }))
    setSelectedIdx(suite.items.length)
  }

  const updateItem = (idx: number, patch: Partial<SuiteItem>) => {
    mutate((prev) => ({
      ...prev,
      items: sortedItems.map((item, index) => (index === idx ? { ...item, ...patch } : item)),
    }))
  }

  const removeItem = (idx: number) => {
    mutate((prev) => ({
      ...prev,
      items: sortedItems
        .filter((_, index) => index !== idx)
        .map((item, order) => ({ ...item, order })),
    }))
    setSelectedIdx(null)
  }

  const moveItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction
    if (target < 0 || target >= sortedItems.length) return
    const next = [...sortedItems]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    mutate((prev) => ({
      ...prev,
      items: next.map((item, order) => ({ ...item, order })),
    }))
    setSelectedIdx(target)
  }

  const openTestCase = (item: SuiteItem) => {
    const option = testCases.find((tc) => tc.path === item.testCasePath)
    openTab(item.testCasePath, option?.name ?? basename(item.testCasePath), activeProject?.path ?? '')
  }

  const runSuite = useCallback(async () => {
    if (runStatus === 'running') return
    const current = suiteRef.current
    if (!current) return
    const normalized = {
      ...current,
      items: [...current.items]
        .sort((a, b) => a.order - b.order)
        .map((item, order) => ({ ...item, order })),
      updatedAt: new Date().toISOString(),
    }
    await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(normalized, null, 2))
    setSuite(normalized)
    markTabDirty(filePath, false)

    let profileVariables: Record<string, string> = {}
    if (activeProject) {
      try {
        const profileName = normalized.profile || activeProject.activeProfile
        profileVariables = await readEnv(`${activeProject.path}/profiles/${profileName}.env.json`)
      } catch { /* profile missing - run with empty variables */ }
    }

    setCaseStatuses({})
    setCaseMessages({})
    const result = await invoke<{ runId: string }>(IpcChannels.ENGINE_RUN_SUITE, {
      filePath,
      profileVariables,
    })
    startRun(result.runId, filePath, false)
  }, [activeProject, filePath, markTabDirty, runStatus, startRun])

  const stopSuite = useCallback(async () => {
    if (!runId) return
    await invoke(IpcChannels.ENGINE_STOP, runId)
    stopRun()
  }, [runId, stopRun])

  const renderCaseStatus = (item: SuiteItem) => {
    const status = caseStatuses[item.testCasePath] ?? 'idle'
    if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
    if (status === 'passed') return <CircleCheck className="w-3.5 h-3.5 text-green-500" />
    if (status === 'failed') return <CircleX className="w-3.5 h-3.5 text-red-500" />
    if (status === 'skipped') return <span className="text-muted-foreground/50">-</span>
    return null
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-destructive text-xs">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    )
  }

  if (!suite) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-border bg-panel shrink-0">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <input
          value={suite.name}
          onChange={(e) => mutate((prev) => ({ ...prev, name: e.target.value }))}
          className="h-7 w-56 bg-input text-sm px-2 rounded border border-border focus:border-primary outline-none"
        />
        <input
          value={suite.profile}
          onChange={(e) => mutate((prev) => ({ ...prev, profile: e.target.value }))}
          className="h-7 w-28 bg-input text-xs px-2 rounded border border-border focus:border-primary outline-none"
          title="Profile"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
          <input
            type="checkbox"
            checked={suite.continueOnFailure}
            onChange={(e) => mutate((prev) => ({ ...prev, continueOnFailure: e.target.checked }))}
            className="w-3 h-3 accent-primary"
          />
          Continue on failure
        </label>
        <div className="flex-1" />
        <select
          value={selectedPath}
          onChange={(e) => setSelectedPath(e.target.value)}
          className="h-7 max-w-72 bg-input text-xs px-2 rounded border border-border focus:border-primary outline-none"
        >
          {testCases.length === 0 ? (
            <option value="">No test cases found</option>
          ) : (
            testCases.map((tc) => (
              <option key={tc.path} value={tc.path}>
                {tc.name}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          onClick={addSelectedTestCase}
          disabled={!selectedPath}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-40"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          Add Case
        </button>
        <div className="w-px h-4 bg-border mx-0.5" />
        {runStatus === 'running' ? (
          <button
            type="button"
            onClick={stopSuite}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-red-600 hover:bg-red-500 text-white"
          >
            <Square className="w-3 h-3 fill-white" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={runSuite}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-[hsl(142,72%,29%)] hover:bg-[hsl(142,72%,34%)] text-white"
          >
            <Play className="w-3 h-3 fill-white" />
            Run Suite
          </button>
        )}
        <div className="w-px h-4 bg-border mx-0.5" />
        <button
          type="button"
          onClick={() => selectedIdx !== null && moveItem(selectedIdx, -1)}
          disabled={selectedIdx === null || selectedIdx === 0}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => selectedIdx !== null && moveItem(selectedIdx, 1)}
          disabled={selectedIdx === null || selectedIdx === sortedItems.length - 1}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border bg-muted/10 shrink-0">
        <textarea
          value={suite.description}
          onChange={(e) => mutate((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Suite description"
          className="w-full h-12 resize-none bg-transparent text-xs text-foreground/80 placeholder:text-muted-foreground/50 outline-none"
        />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-muted/30 sticky top-0 z-10">
              <th className="w-12 px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">Run</th>
              <th className="w-10 px-2 py-1.5" />
              <th className="w-14 px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">Order</th>
              <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">Test Case</th>
              <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">Path</th>
              <th className="w-20 px-2" />
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-xs text-muted-foreground/50 py-12">
                  No test cases in this suite yet. Choose a test case and click <strong>Add Case</strong>.
                </td>
              </tr>
            )}
            {sortedItems.map((item, idx) => (
              <tr
                key={`${item.testCasePath}-${idx}`}
                onClick={() => setSelectedIdx(idx)}
                onDoubleClick={() => openTestCase(item)}
                className={cn(
                  'border-b border-border/40 hover:bg-secondary/20 cursor-default',
                  selectedIdx === idx && 'bg-primary/8',
                  !item.enabled && 'opacity-45',
                )}
              >
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => updateItem(idx, { enabled: e.target.checked })}
                    className="w-3 h-3 accent-primary"
                  />
                </td>
                <td className="px-2 py-1.5" title={caseMessages[item.testCasePath]}>
                  {renderCaseStatus(item)}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground font-mono">
                  {idx + 1}
                </td>
                <td className="px-2 py-1.5 text-xs text-foreground">
                  {itemNames.get(item.testCasePath)}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground font-mono truncate max-w-[360px]">
                  {item.testCasePath}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeItem(idx)
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground shrink-0">
        {sortedItems.filter((item) => item.enabled).length} enabled / {sortedItems.length} total
      </div>
    </div>
  )
}
