import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, CheckCircle, XCircle, FileCode } from 'lucide-react'
import type { GeneratedTest } from '../types'

interface Props {
  tests: GeneratedTest[]
  onDiscard: (id: string) => void
}

const statusIcon = {
  draft: <FileCode className="h-4 w-4 text-blue-500" />,
  saved: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
}

const typeBadge: Record<string, string> = {
  e2e: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  api: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  unit: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  integration: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
}

export function GeneratedTestPreview({ tests, onDiscard }: Props) {
  if (!tests.length) return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-8">
      <FileCode className="h-8 w-8 opacity-30" />
      <p>No tests generated yet</p>
    </div>
  )

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {tests.map((test) => (
          <div key={test.id} className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-muted/30">
              {statusIcon[test.status]}
              <span className="text-sm font-medium flex-1 truncate">
                {test.content
                  ? (test.content as any).name ?? test.name
                  : test.name}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeBadge[test.type] ?? ''}`}>
                {test.type}
              </span>
              {test.status === 'draft' && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onDiscard(test.id)}>
                  Discard
                </Button>
              )}
            </div>

            {/* Streaming buffer */}
            {!!test.streamBuffer && !test.content && (
              <div className="relative">
                <pre className="text-xs bg-background p-3 overflow-auto max-h-48 font-mono opacity-60">
                  {test.streamBuffer}
                </pre>
                <div className="absolute top-2 right-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Final content */}
            {!!test.content && (
              <div>
                {/* Steps preview */}
                {Array.isArray((test.content as any).steps) && (
                  <ul className="divide-y">
                    {((test.content as any).steps as any[]).slice(0, 8).map((step: any, i: number) => (
                      <li key={i} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                        <span className="font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 shrink-0">{step.keyword}</span>
                        {step.objectRef && <span className="text-foreground/70">{step.objectRef}</span>}
                        {step.input && <span className="text-green-600 dark:text-green-400 truncate">{step.input}</span>}
                      </li>
                    ))}
                    {((test.content as any).steps as any[]).length > 8 && (
                      <li className="px-3 py-1.5 text-xs text-muted-foreground">
                        +{((test.content as any).steps as any[]).length - 8} more steps
                      </li>
                    )}
                  </ul>
                )}

                <div className="px-3 py-2 border-t flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    {((test.content as any).steps as any[])?.length ?? 0} steps
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {(test.content as any).runner ?? 'playwright'}
                  </Badge>
                  <span className="flex-1" />
                  {test.status === 'saved' && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Saved to project
                    </span>
                  )}
                </div>
              </div>
            )}

            {test.status === 'failed' && (
              <div className="px-3 py-2 text-xs text-destructive bg-destructive/5">
                {test.errorMessage ?? 'Generation failed'}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
