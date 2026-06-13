import type { TestSuite } from '@jkauto/core'
import type { RunSummary } from '../hooks/useSuiteRun'
import { cn } from '@/lib/utils'

type SuiteItem = TestSuite['items'][number]

interface SuiteFooterProps {
  sortedItems: SuiteItem[]
  runSummary: RunSummary | null
}

export function SuiteFooter({ sortedItems, runSummary }: SuiteFooterProps) {
  const enabledCount = sortedItems.filter((item) => item.enabled).length

  return (
    <div className="px-3 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground shrink-0 flex items-center gap-3">
      <span>
        {enabledCount} enabled / {sortedItems.length} total
      </span>

      {runSummary && (
        <span
          className={cn(
            'flex items-center gap-1.5 font-medium',
            runSummary.status === 'passed' && 'text-green-500',
            runSummary.status === 'failed' && 'text-red-500',
            runSummary.status === 'stopped' && 'text-yellow-500',
          )}
        >
          <span>
            {runSummary.status === 'passed' ? '✓' : runSummary.status === 'stopped' ? '⏹' : '✗'}
          </span>
          <span>
            {runSummary.passedCases}/{runSummary.totalCases} cases passed
            {runSummary.failedCases > 0 && `, ${runSummary.failedCases} failed`}
            {' '}({(runSummary.durationMs / 1000).toFixed(1)}s)
          </span>
        </span>
      )}
    </div>
  )
}
