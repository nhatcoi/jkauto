import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeywordBadge } from '@/features/test-cases/components/StepRow'
import { ObjectRefInput } from '@/features/test-cases/components/StepRow'
import { useKeywords } from '@/features/test-cases/hooks/useKeywords'
import { useObjectItems } from '@/features/test-cases/hooks/useObjectItems'
import { useProjectStore } from '@/store/project.store'
import type { CustomKeywordStep } from '../types'

interface Props {
  steps: CustomKeywordStep[]
  onUpdate: (idx: number, patch: Partial<CustomKeywordStep>) => void
  onAdd: () => void
  onDelete: (idx: number) => void
  onMove: (idx: number, dir: -1 | 1) => void
}

export function KeywordStepTable({ steps, onUpdate, onAdd, onDelete, onMove }: Props) {
  const { activeProject } = useProjectStore()
  const keywords = useKeywords()
  const objectItems = useObjectItems(activeProject?.path)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Steps</span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={onAdd}>
          <Plus className="w-3 h-3" /> Add Step
        </Button>
      </div>

      {steps.length === 0 && (
        <div className="text-xs text-muted-foreground/60 py-6 text-center border border-dashed border-border rounded">
          No steps yet — add steps to compose this keyword
        </div>
      )}

      {steps.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full border-collapse min-w-[600px] text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-8 px-1 py-1.5" />
                <th className="w-36 text-left px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Keyword</th>
                <th className="w-36 text-left px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Object</th>
                <th className="text-left px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Input</th>
                <th className="text-left px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Expected</th>
                <th className="w-16 px-1" />
              </tr>
            </thead>
            <tbody>
              {steps.map((step, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/20 group">
                  <td className="px-1 text-center text-muted-foreground/40 text-[10px] select-none">{idx + 1}</td>
                  <td className="px-2 py-1">
                    <KeywordBadge
                      keyword={step.keyword}
                      onChange={(name) => onUpdate(idx, { keyword: name })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <ObjectRefInput
                      value={step.objectRef}
                      objectItems={objectItems}
                      onChange={(v) => onUpdate(idx, { objectRef: v })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      className="h-6 text-xs border-transparent bg-transparent hover:border-border focus:border-primary focus:bg-background"
                      value={step.input}
                      onChange={(e) => onUpdate(idx, { input: e.target.value })}
                      placeholder="input…"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      className="h-6 text-xs border-transparent bg-transparent hover:border-border focus:border-primary focus:bg-background"
                      value={step.expected}
                      onChange={(e) => onUpdate(idx, { expected: e.target.value })}
                      placeholder="expected…"
                    />
                  </td>
                  <td className="px-1">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => onMove(idx, -1)}
                        disabled={idx === 0}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => onMove(idx, 1)}
                        disabled={idx === steps.length - 1}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 hover:text-destructive"
                        onClick={() => onDelete(idx)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
