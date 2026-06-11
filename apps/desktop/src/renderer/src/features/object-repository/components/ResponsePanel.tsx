import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { HttpResponse } from '../types'

interface Props {
  response: HttpResponse | null
  sendError: string
  sending: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function statusVariant(status: number): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'warning'
  if (status >= 400) return 'destructive'
  return 'secondary'
}

function tryFormatJson(raw: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(raw)
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
  } catch {
    return { formatted: raw, isJson: false }
  }
}

export function ResponsePanel({ response, sendError, sending }: Props) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')

  if (sending) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Sending request…
      </div>
    )
  }

  if (sendError) {
    return (
      <div className="p-4 text-xs text-destructive font-mono">
        <span className="font-semibold">Error: </span>{sendError}
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
        Send a request to see the response
      </div>
    )
  }

  const { formatted, isJson } = tryFormatJson(response.body)

  return (
    <div className="flex flex-col h-full">
      {/* status bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border shrink-0 bg-muted/20">
        <Badge variant={statusVariant(response.status)}>
          {response.status} {response.statusText}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{response.durationMs}ms</span>
        <span className="text-[10px] text-muted-foreground">{formatSize(response.size)}</span>
      </div>

      {/* tab bar */}
      <div className="flex gap-0 border-b border-border shrink-0">
        {(['body', 'headers'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 h-7 text-xs transition-colors capitalize',
              activeTab === tab
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
            {tab === 'headers' && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                ({Object.keys(response.headers).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'body' && (
          <pre className={cn(
            'text-xs leading-5 p-3 whitespace-pre-wrap break-words h-full',
            isJson ? 'text-foreground/90 font-mono' : 'text-foreground/80 font-mono',
          )}>
            {formatted || <span className="text-muted-foreground/50">(empty body)</span>}
          </pre>
        )}

        {activeTab === 'headers' && (
          <div className="p-3 flex flex-col gap-1">
            {Object.entries(response.headers).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[200px_1fr] gap-2 text-xs">
                <span className="text-muted-foreground truncate font-medium">{k}</span>
                <span className="text-foreground/80 font-mono break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
