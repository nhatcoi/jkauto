import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { TestSuite } from '@jkauto/core'
import { useProjectStore } from '@/store/project.store'
import { useSuite } from './hooks/useSuite'
import { useSuiteRun } from './hooks/useSuiteRun'
import { SuiteToolbar } from './components/SuiteToolbar'
import { SuiteTable } from './components/SuiteTable'
import { SuiteFooter } from './components/SuiteFooter'

export function SuiteEditor({ filePath }: { filePath: string }) {
  const { openTab } = useProjectStore()
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const {
    suite, testCases, sortedItems, itemNames, saving, error,
    suiteRef, activeProject,
    mutate, save, saveSuiteToFile,
    addTestCase, removeItem, updateItem, moveItem,
  } = useSuite(filePath)

  const {
    caseStatuses, caseMessages, runSummary,
    runSuite, runCase, stopSuite, runStatus,
  } = useSuiteRun(filePath, suiteRef, saveSuiteToFile)

  const handleAddCase = (option: Parameters<typeof addTestCase>[0]) => {
    const added = addTestCase(option)
    if (added) setSelectedIdx(sortedItems.length) // new item will be last
  }

  const handleMoveUp = () => {
    if (selectedIdx === null) return
    const moved = moveItem(selectedIdx, -1)
    if (moved) setSelectedIdx(selectedIdx - 1)
  }

  const handleMoveDown = () => {
    if (selectedIdx === null) return
    const moved = moveItem(selectedIdx, 1)
    if (moved) setSelectedIdx(selectedIdx + 1)
  }

  const handleOpenCase = (item: TestSuite['items'][number]) => {
    const option = testCases.find((tc) => tc.path === item.testCasePath)
    openTab(item.testCasePath, option?.name ?? item.testCasePath.split('/').pop() ?? item.testCasePath, activeProject?.path ?? '')
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
      <SuiteToolbar
        suite={suite}
        testCases={testCases}
        saving={saving}
        runStatus={runStatus}
        selectedIdx={selectedIdx}
        totalItems={sortedItems.length}
        projectPath={activeProject?.path}
        onMutate={mutate}
        onAddCase={handleAddCase}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onRunSuite={runSuite}
        onStopSuite={stopSuite}
        onSave={save}
      />

      <div className="px-3 py-2 border-b border-border bg-muted/10 shrink-0">
        <textarea
          value={suite.description}
          onChange={(e) => mutate((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Suite description"
          className="w-full h-12 resize-none bg-transparent text-xs text-foreground/80 placeholder:text-muted-foreground/50 outline-none"
        />
      </div>

      <SuiteTable
        sortedItems={sortedItems}
        itemNames={itemNames}
        caseStatuses={caseStatuses}
        caseMessages={caseMessages}
        selectedIdx={selectedIdx}
        runStatus={runStatus}
        projectRoot={activeProject?.path}
        onSelectIdx={setSelectedIdx}
        onUpdateItem={updateItem}
        onRemoveItem={(idx) => { removeItem(idx); setSelectedIdx(null) }}
        onOpenCase={handleOpenCase}
        onRunCase={runCase}
      />

      <SuiteFooter sortedItems={sortedItems} runSummary={runSummary} />
    </div>
  )
}
