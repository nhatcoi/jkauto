import { useEffect, useState } from 'react'
import { parse as yamlParse } from 'yaml'
import { AlertCircle } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import { useSettingsKeymap } from '@/hooks/useSettingsKeymap'
import { TEST_CASE_KEYMAPS, KEYMAP_SCOPES } from '@/shared/keymaps'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useKeywords } from '../hooks/useKeywords'
import { useTestCaseFile, normalizeTestCase } from '../hooks/useTestCaseFile'
import { useTestCaseRun } from '../hooks/useTestCaseRun'
import { useStepEditor, makeStep } from '../hooks/useStepEditor'
import { useStepDragDrop } from '../hooks/useStepDragDrop'
import { useStepContextMenu } from '../hooks/useStepContextMenu'
import { TestCaseToolbar, type TestCaseViewMode } from './TestCaseToolbar'
import { YamlTestcaseEditor } from './YamlTestcaseEditor'
import { StepContextMenu } from './StepContextMenu'
import { CallTestCaseDialog } from './CallTestCaseDialog'
import { ApiStepList } from './ApiStepList'
import { ApiStepDetail } from './ApiStepDetail'
import { ApiUrlConfigDialog } from '@/features/env/ApiUrlConfigDialog'
import type { TestCase } from '../types'

export function ApiTestEditor({ filePath }: { filePath: string }) {
  const { markTabDirty } = useProjectStore()
  const [viewMode, setViewMode] = useState<TestCaseViewMode>('table')
  const [yamlDraft, setYamlDraft] = useState('')
  const [yamlError, setYamlError] = useState('')
  const [showApiConfig, setShowApiConfig] = useState(false)

  const { tc, tcRef, tcHistory, error, saving, mutate, save, saveRaw, serialize } = useTestCaseFile(filePath)
  const keywords = useKeywords('api')

  const {
    runStatus, stepStatuses, stepMessages, isDebugMode, isDebugPaused,
    handleRun, handleStop, handleDebugNext,
  } = useTestCaseRun({ filePath, tcRef, serialize })

  const stepMeta = useRunStore((s) => s.stepMeta)

  const {
    selectedIdx, setSelectedIdx, clipboard,
    showCallDialog, setShowCallDialog,
    updateStep, deleteStep, moveStep, duplicateStep,
    insertStepBefore, insertStepAfter,
    copyStep, cutStep, pasteStepBefore, pasteStepAfter,
    toggleFailureHandling, openCallDialog, handleCallTestCaseSelect,
  } = useStepEditor({ tc, mutate })

  const dragDrop = useStepDragDrop({ mutate, setSelectedIdx })
  const { contextMenu, handleContextMenu, closeContextMenu } = useStepContextMenu(setSelectedIdx)

  useEffect(() => {
    setSelectedIdx(null)
    setViewMode('table')
    setYamlError('')
  }, [filePath, setSelectedIdx])

  useEffect(() => {
    if (tc && viewMode === 'table') setYamlDraft(serialize(tc))
  }, [tc, serialize, viewMode])

  const addApiStep = () => {
    mutate((prev) => ({ ...prev, steps: [...prev.steps, makeStep('http-request')] }))
    setSelectedIdx(tc?.steps.length ?? 0)
  }

  const handleViewModeChange = (mode: TestCaseViewMode) => {
    if (mode === 'yaml' && tc) { setYamlDraft(serialize(tc)); setYamlError('') }
    setViewMode(mode)
  }

  const handleYamlChange = (value: string) => {
    setYamlDraft(value)
    try {
      const parsed = normalizeTestCase(yamlParse(value) as Partial<TestCase>)
      setYamlError('')
      mutate(() => parsed)
    } catch (e) {
      setYamlError(e instanceof Error ? e.message : 'Invalid YAML')
      markTabDirty(filePath, true)
    }
  }

  const handleSave = () => {
    if (viewMode === 'yaml') { if (!yamlError) void saveRaw(yamlDraft); return }
    void save()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inEditable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      if (inEditable) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); tcHistory.undo(); markTabDirty(filePath, true)
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); tcHistory.redo(); markTabDirty(filePath, true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tcHistory.undo, tcHistory.redo, filePath, markTabDirty])

  const km = useSettingsKeymap(TEST_CASE_KEYMAPS, KEYMAP_SCOPES.TEST_CASE, {
    save: handleSave,
    addStep: addApiStep,
    deleteStep: () => { if (selectedIdx !== null) deleteStep(selectedIdx) },
    moveUp: () => { if (selectedIdx !== null) moveStep(selectedIdx, -1) },
    moveDown: () => { if (selectedIdx !== null) moveStep(selectedIdx, 1) },
    duplicateStep: () => { if (selectedIdx !== null) duplicateStep(selectedIdx) },
    run: () => { if (runStatus !== 'running') handleRun(false) },
    debug: () => { if (runStatus !== 'running') handleRun(true) },
    stop: () => { if (runStatus === 'running') handleStop() },
    toggleHistory: () => {},
  })

  const handleOpenCallDialog = (idx: number) => { closeContextMenu(); openCallDialog(idx) }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-destructive text-xs">
        <AlertCircle className="w-4 h-4" />{error}
      </div>
    )
  }
  if (!tc) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Loading…</div>
  }

  const selectedStep = selectedIdx !== null ? tc.steps[selectedIdx] ?? null : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TestCaseToolbar
        tc={tc}
        platform="api"
        canUndo={tcHistory.canUndo}
        canRedo={tcHistory.canRedo}
        onUndo={() => { tcHistory.undo(); markTabDirty(filePath, true) }}
        onRedo={() => { tcHistory.redo(); markTabDirty(filePath, true) }}
        selectedIdx={selectedIdx}
        stepsLength={tc.steps.length}
        onAddStep={addApiStep}
        onShowImport={() => {}}
        onMoveStep={moveStep}
        onMutate={mutate}
        runStatus={runStatus}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isDebugMode={isDebugMode}
        isDebugPaused={isDebugPaused}
        onRun={() => handleRun(false)}
        onDebug={() => handleRun(true)}
        onStop={handleStop}
        onDebugNext={handleDebugNext}
        onSave={handleSave}
        saving={saving}
        saveHint={km.save.hint}
        onOpenApiConfig={() => setShowApiConfig(true)}
      />

      {viewMode === 'yaml' ? (
        <>
          {yamlError && (
            <div className="px-3 py-1 text-[11px] font-mono text-destructive border-b border-border/40 shrink-0">
              {yamlError}
            </div>
          )}
          <YamlTestcaseEditor
            value={yamlDraft}
            onChange={handleYamlChange}
            keywords={keywords}
            objectItems={[]}
          />
        </>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={36} minSize={22}>
            <ApiStepList
              steps={tc.steps}
              keywords={keywords}
              selectedIdx={selectedIdx}
              stepStatuses={stepStatuses}
              onSelect={setSelectedIdx}
              onDelete={deleteStep}
              onAddStep={addApiStep}
              onContextMenu={(e, i) => handleContextMenu(e, i)}
              onDragStart={dragDrop.handleDragStart}
              onDragOver={dragDrop.handleDragOver}
              onDrop={dragDrop.handleDrop}
              onDragEnd={dragDrop.handleDragEnd}
              dragOverIdx={dragDrop.dragOverIdx}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={64} minSize={40}>
            {selectedStep && selectedIdx !== null ? (
              <ApiStepDetail
                step={selectedStep}
                stepIndex={selectedIdx}
                keywords={keywords}
                stepMessage={stepMessages[selectedIdx]}
                stepMeta={stepMeta[selectedIdx]}
                onChange={(patch) => updateStep(selectedIdx, patch)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
                <p className="text-sm">Select a step to edit</p>
                <p className="text-xs">or add a new step from the left panel</p>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {contextMenu?.visible && (
        <StepContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipboard={clipboard}
          stepIdx={contextMenu.stepIdx}
          onInsertBefore={insertStepBefore}
          onInsertAfter={insertStepAfter}
          onCallTestCase={handleOpenCallDialog}
          onCopy={copyStep}
          onCut={cutStep}
          onPasteBefore={pasteStepBefore}
          onPasteAfter={pasteStepAfter}
          onToggleFailure={toggleFailureHandling}
          onDelete={deleteStep}
        />
      )}

      <CallTestCaseDialog
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        onSelect={handleCallTestCaseSelect}
      />

      <ApiUrlConfigDialog
        open={showApiConfig}
        onClose={() => setShowApiConfig(false)}
      />
    </div>
  )
}
