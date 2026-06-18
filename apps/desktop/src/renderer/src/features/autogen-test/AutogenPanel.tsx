import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RotateCcw, Sparkles, CheckSquare, Square } from 'lucide-react'
import { useAutogenStore } from './store'
import { useRepoIndex } from './hooks/useRepoIndex'
import { useTestGeneration } from './hooks/useTestGeneration'
import { RepoSetupForm } from './components/RepoSetupForm'
import { IndexProgress } from './components/IndexProgress'
import { TargetSelector } from './components/TargetSelector'
import { GeneratedTestPreview } from './components/GeneratedTestPreview'
import type { TestType } from './types'

interface Props {
  projectPath: string
}

const TEST_TYPES: TestType[] = ['e2e', 'api', 'unit', 'integration']

export function AutogenPanel({ projectPath }: Props) {
  const {
    status, progress, targets, selectedTargets, selectedTypes,
    generatedTests, errorMessage, setTestTypes, reset, discardTest, toggleTarget
  } = useAutogenStore()

  const { startIndex, loadExisting } = useRepoIndex(projectPath)
  const { generate } = useTestGeneration(projectPath)
  const [activeTab, setActiveTab] = useState<'targets' | 'results'>('targets')

  // Try load existing index on mount
  useEffect(() => {
    if (status === 'idle') loadExisting()
  }, [])

  // Auto-switch to results tab when generating
  useEffect(() => {
    if (status === 'generating' || status === 'done') setActiveTab('results')
  }, [status])

  const allSelected = targets.length > 0 && selectedTargets.length === targets.length
  const toggleAll = () => {
    const store = useAutogenStore.getState()
    if (allSelected) {
      targets.forEach((t) => { if (selectedTargets.includes(t.id)) store.toggleTarget(t.id) })
    } else {
      targets.forEach((t) => { if (!selectedTargets.includes(t.id)) store.toggleTarget(t.id) })
    }
  }

  const toggleType = (t: TestType) =>
    setTestTypes(
      selectedTypes.includes(t) ? selectedTypes.filter((x) => x !== t) : [...selectedTypes, t]
    )

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
        <span className="font-medium text-xs flex-1">Auto-Generate Tests</span>
        {status !== 'idle' && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={reset} title="Reset">
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Idle: repo form */}
      {status === 'idle' && (
        <RepoSetupForm onStart={startIndex} loading={false} />
      )}

      {/* Indexing progress */}
      {status === 'indexing' && (
        <IndexProgress progress={progress} />
      )}

      {/* Selecting + Generating + Done */}
      {(status === 'selecting' || status === 'generating' || status === 'done') && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Stack badge */}
          {useAutogenStore.getState().stack && (
            <div className="px-3 py-1.5 border-b flex items-center gap-1.5 bg-muted/20">
              <Badge variant="outline" className="text-xs font-mono">
                {useAutogenStore.getState().stack?.framework}
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                {useAutogenStore.getState().stack?.language}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                {targets.length} targets
              </span>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-3 mt-2 h-7 text-xs">
              <TabsTrigger value="targets" className="flex-1 text-xs h-6">
                Targets
                {selectedTargets.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{selectedTargets.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="results" className="flex-1 text-xs h-6">
                Results
                {generatedTests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{generatedTests.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="targets" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
              {/* Select all */}
              <div className="px-3 py-1.5 border-b flex items-center gap-2">
                <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {allSelected
                    ? <CheckSquare className="h-3.5 w-3.5" />
                    : <Square className="h-3.5 w-3.5" />}
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TargetSelector />
              </div>
            </TabsContent>

            <TabsContent value="results" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
              <GeneratedTestPreview
                tests={generatedTests}
                onDiscard={discardTest}
              />
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Footer controls */}
          <div className="p-2 space-y-2">
            {/* Test type toggles */}
            <div className="flex gap-1">
              {TEST_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`flex-1 text-xs py-1 rounded border transition-colors font-medium ${
                    selectedTypes.includes(t)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <Button
              className="w-full h-8 text-xs"
              disabled={!selectedTargets.length || !selectedTypes.length || status === 'generating'}
              onClick={generate}
            >
              {status === 'generating'
                ? <><Sparkles className="h-3.5 w-3.5 mr-1.5 animate-pulse" />Generating...</>
                : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate ({selectedTargets.length} targets)</>}
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
          <p className="text-xs text-destructive text-center">{errorMessage}</p>
          <Button size="sm" variant="outline" onClick={reset}>Try again</Button>
        </div>
      )}
    </div>
  )
}
