import { useEffect } from 'react'
import { Save, AlertCircle, Braces } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useKeywordFile } from './hooks/useKeywordFile'
import { ParamsEditor } from './components/ParamsEditor'
import { KeywordStepTable } from './components/KeywordStepTable'
import type { KeywordParam } from './types'

export function KeywordEditor({ filePath }: { filePath: string }) {
  const { kw, error, saving, mutate, save, updateStep, addStep, deleteStep, moveStep } =
    useKeywordFile(filePath)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-destructive text-xs">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    )
  }

  if (!kw) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 bg-panel">
        <Braces className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-xs font-semibold text-foreground/80 flex-1 truncate">
          Custom Keyword
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs gap-1.5"
          onClick={() => void save()}
          disabled={saving}
        >
          <Save className="w-3 h-3" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-5">
        {/* Identity */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              className="h-8 text-sm"
              value={kw.name}
              onChange={(e) => mutate((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="keyword-name (kebab-case recommended)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              className="text-xs resize-none"
              rows={2}
              value={kw.description}
              onChange={(e) => mutate((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="What does this keyword do?"
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Parameters */}
        <ParamsEditor
          params={kw.params}
          onChange={(params: KeywordParam[]) => mutate((prev) => ({ ...prev, params }))}
        />

        <div className="border-t border-border" />

        {/* Steps */}
        <KeywordStepTable
          steps={kw.steps}
          onUpdate={updateStep}
          onAdd={addStep}
          onDelete={deleteStep}
          onMove={moveStep}
        />
      </div>
    </div>
  )
}
