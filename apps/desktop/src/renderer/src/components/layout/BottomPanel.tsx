import * as TabsPrimitive from '@radix-ui/react-tabs'
import { AlertCircle, Terminal, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomPanel() {
  return (
    <TabsPrimitive.Root defaultValue="console" className="flex flex-col h-full bg-panel">
      <TabsPrimitive.List className="flex h-7 border-b border-border shrink-0">
        {[
          { value: 'problems', label: 'Problems', icon: AlertCircle },
          { value: 'console', label: 'Console', icon: Terminal },
          { value: 'eventlog', label: 'Event Log', icon: Activity },
        ].map(({ value, label, icon: Icon }) => (
          <TabsPrimitive.Trigger
            key={value}
            value={value}
            className={cn(
              'flex items-center gap-1.5 px-3 h-full text-xs text-muted-foreground',
              'hover:text-foreground transition-colors border-r border-border',
              'data-[state=active]:text-foreground data-[state=active]:bg-background/40',
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <TabsPrimitive.Content value="problems" className="flex-1 overflow-auto p-2">
        <div className="text-xs text-muted-foreground/50 italic">No problems detected</div>
      </TabsPrimitive.Content>

      <TabsPrimitive.Content
        value="console"
        className="flex-1 overflow-auto p-2 font-mono"
      >
        <div className="text-xs text-muted-foreground/50 italic">Console output will appear here</div>
      </TabsPrimitive.Content>

      <TabsPrimitive.Content value="eventlog" className="flex-1 overflow-auto p-2">
        <div className="text-xs text-muted-foreground/50 italic">Events will appear here</div>
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  )
}
