import { CircleCheck, CircleX, Loader2, Play, Trash2 } from 'lucide-react'
import type { TestSuite } from '@jkauto/core'
import type { CaseStatus } from '../hooks/useSuiteRun'
import { cn } from '@/lib/utils'

type SuiteItem = TestSuite['items'][number]

interface SuiteTableProps {
  sortedItems: SuiteItem[]
  itemNames: Map<string, string>
  caseStatuses: Record<string, CaseStatus>
  caseMessages: Record<string, string>
  selectedIdx: number | null
  runStatus: 'idle' | 'running' | 'passed' | 'failed' | 'stopped'
  projectRoot: string | undefined
  onSelectIdx: (idx: number) => void
  onUpdateItem: (idx: number, patch: Partial<SuiteItem>) => void
  onRemoveItem: (idx: number) => void
  onOpenCase: (item: SuiteItem) => void
  onRunCase: (testCasePath: string) => void
}

function relativePath(absPath: string, projectRoot: string | undefined) {
  if (projectRoot && absPath.startsWith(projectRoot + '/')) return absPath.slice(projectRoot.length + 1)
  return absPath
}

function CaseStatusIcon({ status }: { status: CaseStatus }) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
  if (status === 'passed') return <CircleCheck className="w-3.5 h-3.5 text-green-500" />
  if (status === 'failed') return <CircleX className="w-3.5 h-3.5 text-red-500" />
  if (status === 'skipped') return <span className="text-muted-foreground/50 text-xs">—</span>
  return null
}

export function SuiteTable({
  sortedItems, itemNames, caseStatuses, caseMessages,
  selectedIdx, runStatus, projectRoot,
  onSelectIdx, onUpdateItem, onRemoveItem, onOpenCase, onRunCase,
}: SuiteTableProps) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse min-w-[680px]">
        <thead>
          <tr className="border-b border-border bg-muted/30 sticky top-0 z-10">
            <th className="w-10 px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">Run</th>
            <th className="w-8 px-2 py-1.5" />
            <th className="w-12 px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">#</th>
            <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">Test Case</th>
            <th className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground text-left">Path</th>
            <th className="w-16 px-2" />
          </tr>
        </thead>
        <tbody>
          {sortedItems.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-xs text-muted-foreground/50 py-12">
                No test cases in this suite yet. Choose a test case and click <strong>Add</strong>.
              </td>
            </tr>
          )}
          {sortedItems.map((item, idx) => {
            const status = caseStatuses[item.testCasePath] ?? 'idle'
            return (
              <tr
                key={`${item.testCasePath}-${idx}`}
                onClick={() => onSelectIdx(idx)}
                onDoubleClick={() => onOpenCase(item)}
                className={cn(
                  'border-b border-border/40 hover:bg-secondary/20 cursor-default group',
                  selectedIdx === idx && 'bg-primary/8',
                  !item.enabled && 'opacity-45',
                )}
              >
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => onUpdateItem(idx, { enabled: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3 h-3 accent-primary"
                  />
                </td>
                <td className="px-2 py-1.5" title={caseMessages[item.testCasePath]}>
                  <CaseStatusIcon status={status} />
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground font-mono">
                  {idx + 1}
                </td>
                <td className="px-2 py-1.5 text-xs text-foreground">
                  {itemNames.get(item.testCasePath)}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground font-mono truncate max-w-[300px]" title={item.testCasePath}>
                  {relativePath(item.testCasePath, projectRoot)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      title="Run this case"
                      disabled={runStatus === 'running'}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRunCase(item.testCasePath)
                      }}
                      className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-green-500 hover:bg-green-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveItem(idx)
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
