import * as TabsPrimitive from '@radix-ui/react-tabs'
import { AlertCircle, Terminal, Activity, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRunStore } from '@/store/run.store'
import { useEffect, useRef } from 'react'

export function BottomPanel() {
  const { logs, events, clearLogs } = useRunStore()
  const consoleEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const errors = logs.filter((l) => l.level === 'error')

  return (
    <TabsPrimitive.Root defaultValue="console" className="flex flex-col h-full bg-panel text-foreground">
      <TabsPrimitive.List className="flex h-8 border-b border-border shrink-0 items-center justify-between px-2 bg-muted/20">
        <div className="flex h-full items-center">
          {[
            { value: 'problems', label: 'Problems', icon: AlertCircle, count: errors.length },
            { value: 'console', label: 'Console', icon: Terminal },
            { value: 'eventlog', label: 'Event Log', icon: Activity },
          ].map(({ value, label, icon: Icon, count }) => (
            <TabsPrimitive.Trigger
              key={value}
              value={value}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 text-xs text-muted-foreground relative',
                'hover:text-foreground transition-colors border-r border-border',
                'data-[state=active]:text-foreground data-[state=active]:bg-background/40 data-[state=active]:border-b-2 data-[state=active]:border-b-primary',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {count !== undefined && count > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold">
                  {count}
                </span>
              )}
            </TabsPrimitive.Trigger>
          ))}
        </div>

        {/* Action button */}
        {(logs.length > 0 || events.length > 0) && (
          <button
            onClick={clearLogs}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary/40 transition-colors"
            title="Clear all logs"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </TabsPrimitive.List>

      {/* Problems Panel */}
      <TabsPrimitive.Content value="problems" className="flex-1 overflow-auto p-3">
        {errors.length === 0 ? (
          <div className="text-xs text-muted-foreground/50 italic text-center py-6">No problems detected</div>
        ) : (
          <div className="flex flex-col gap-2">
            {errors.map((err) => (
              <div key={err.id} className="flex items-start gap-2.5 text-xs text-red-400 bg-red-500/5 p-2 rounded border border-red-500/10">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-mono">
                  <span className="text-muted-foreground select-none">[{err.time}]</span>{' '}
                  {err.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsPrimitive.Content>

      {/* Console Panel */}
      <TabsPrimitive.Content
        value="console"
        className="flex-1 overflow-auto p-3 font-mono text-xs flex flex-col bg-background/20"
      >
        {logs.length === 0 ? (
          <div className="text-xs text-muted-foreground/50 italic text-center py-6">Console output will appear here</div>
        ) : (
          <div className="flex flex-col gap-1 select-text">
            {logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'whitespace-pre-wrap leading-relaxed',
                  log.level === 'success' && 'text-green-400',
                  log.level === 'error' && 'text-red-400 font-medium',
                  log.level === 'warn' && 'text-yellow-400',
                  log.level === 'info' && 'text-foreground/80',
                )}
              >
                <span className="text-muted-foreground/60 select-none mr-2">[{log.time}]</span>
                {log.message}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        )}
      </TabsPrimitive.Content>

      {/* Event Log Panel */}
      <TabsPrimitive.Content value="eventlog" className="flex-1 overflow-auto p-3">
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground/50 italic text-center py-6">Events will appear here</div>
        ) : (
          <div className="flex flex-col gap-1.5 font-mono text-xs">
            {events.map((evt) => (
              <div key={evt.id} className="flex gap-2 text-muted-foreground/80 border-b border-border/20 pb-1">
                <span className="text-primary/70 shrink-0 select-none">[{evt.time}]</span>
                <span className="select-text">{evt.message}</span>
              </div>
            ))}
          </div>
        )}
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  )
}
