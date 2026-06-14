import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  FilePlus2,
  Layers,
  Play,
  Save,
  Square,
  Undo2,
  Redo2,
} from 'lucide-react'
import type { TestSuite } from '@jkauto/core'
import type { TestCaseOption } from '../hooks/useSuite'
import { listEnvs } from '@/features/env/api'

interface SuiteToolbarProps {
  suite: TestSuite
  testCases: TestCaseOption[]
  saving: boolean
  runStatus: 'idle' | 'running' | 'passed' | 'failed' | 'stopped'
  selectedIdx: number | null
  totalItems: number
  projectPath: string | undefined
  canUndo: boolean
  canRedo: boolean
  onMutate: (fn: (prev: TestSuite) => TestSuite) => void
  onAddCase: (option: TestCaseOption) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRunSuite: () => void
  onStopSuite: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
}

export function SuiteToolbar({
  suite, testCases, saving, runStatus,
  selectedIdx, totalItems, projectPath,
  canUndo, canRedo,
  onMutate, onAddCase, onMoveUp, onMoveDown,
  onRunSuite, onStopSuite, onSave,
  onUndo, onRedo,
}: SuiteToolbarProps) {
  const [profiles, setProfiles] = useState<string[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!projectPath) return
    listEnvs(projectPath)
      .then((entries) => setProfiles(entries.map((e) => e.name)))
      .catch(() => setProfiles([]))
  }, [projectPath])

  useEffect(() => {
    if (!selectedPath && testCases.length > 0) setSelectedPath(testCases[0].path)
  }, [testCases, selectedPath])

  const filteredCases = filter.trim()
    ? testCases.filter((tc) => tc.name.toLowerCase().includes(filter.toLowerCase()))
    : testCases

  const handleAdd = () => {
    const option = testCases.find((tc) => tc.path === selectedPath)
    if (option) onAddCase(option)
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-border bg-panel shrink-0 flex-wrap">
      <Layers className="w-4 h-4 text-muted-foreground shrink-0" />

      <input
        value={suite.name}
        onChange={(e) => onMutate((prev) => ({ ...prev, name: e.target.value }))}
        className="h-7 w-48 bg-input text-sm px-2 rounded border border-border focus:border-primary outline-none"
      />

      {profiles.length > 0 ? (
        <select
          value={suite.profile}
          onChange={(e) => onMutate((prev) => ({ ...prev, profile: e.target.value }))}
          className="h-7 w-28 bg-input text-xs px-2 rounded border border-border focus:border-primary outline-none"
          title="Profile"
        >
          {profiles.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      ) : (
        <input
          value={suite.profile}
          onChange={(e) => onMutate((prev) => ({ ...prev, profile: e.target.value }))}
          className="h-7 w-28 bg-input text-xs px-2 rounded border border-border focus:border-primary outline-none"
          title="Profile"
          placeholder="default"
        />
      )}

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
        <input
          type="checkbox"
          checked={suite.continueOnFailure}
          onChange={(e) => onMutate((prev) => ({ ...prev, continueOnFailure: e.target.checked }))}
          className="w-3 h-3 accent-primary"
        />
        Continue on failure
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap" title="All cases share one browser session — login state persists between cases">
        <input
          type="checkbox"
          checked={suite.sharedBrowser ?? false}
          onChange={(e) => onMutate((prev) => ({ ...prev, sharedBrowser: e.target.checked }))}
          className="w-3 h-3 accent-primary"
        />
        Shared browser
      </label>

      <button
        type="button"
        disabled={!canUndo}
        onClick={onUndo}
        className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Undo (⌘Z)"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={onRedo}
        className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Redo (⌘⇧Z)"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1" />

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter cases..."
        className="h-7 w-28 bg-input text-xs px-2 rounded border border-border focus:border-primary outline-none"
      />
      <select
        value={selectedPath}
        onChange={(e) => setSelectedPath(e.target.value)}
        className="h-7 max-w-56 bg-input text-xs px-2 rounded border border-border focus:border-primary outline-none"
      >
        {filteredCases.length === 0 ? (
          <option value="">No matches</option>
        ) : (
          filteredCases.map((tc) => (
            <option key={tc.path} value={tc.path}>{tc.name}</option>
          ))
        )}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selectedPath || filteredCases.length === 0}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-40"
      >
        <FilePlus2 className="w-3.5 h-3.5" />
        Add
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {runStatus === 'running' ? (
        <button
          type="button"
          onClick={onStopSuite}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-red-600 hover:bg-red-500 text-white"
        >
          <Square className="w-3 h-3 fill-white" />
          Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={onRunSuite}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-[hsl(142,72%,29%)] hover:bg-[hsl(142,72%,34%)] text-white"
        >
          <Play className="w-3 h-3 fill-white" />
          Run Suite
        </button>
      )}

      <div className="w-px h-4 bg-border mx-0.5" />

      <button
        type="button"
        onClick={onMoveUp}
        disabled={selectedIdx === null || selectedIdx === 0}
        className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={selectedIdx === null || selectedIdx === totalItems - 1}
        className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-50"
      >
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
