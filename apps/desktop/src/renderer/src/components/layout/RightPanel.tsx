import { useState } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { BrainCircuit, ListTodo, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTabDnd, moveItem } from '@/hooks/useTabDnd'
import { AgentPanel } from '@/features/agent/AgentPanel'
import { AppiumPanel } from '@/features/appium/AppiumPanel'

type TabId = 'jobs' | 'agent' | 'appium'

const TAB_META: Record<TabId, { label: string; icon: typeof ListTodo }> = {
  jobs: { label: 'Jobs', icon: ListTodo },
  agent: { label: 'AI Agent', icon: BrainCircuit },
  appium: { label: 'Appium', icon: Smartphone },
}

export function RightPanel() {
  const [order, setOrder] = useState<TabId[]>(['jobs', 'agent', 'appium'])
  const { getTabProps, overIndex } = useTabDnd((from, to) =>
    setOrder((prev) => moveItem(prev, from, to)),
  )

  return (
    <TabsPrimitive.Root defaultValue="agent" className="flex flex-col h-full">
      <TabsPrimitive.List className="flex h-8 border-b border-border bg-panel shrink-0">
        {order.map((id, index) => {
          const { label, icon: Icon } = TAB_META[id]
          return (
            <TabsPrimitive.Trigger
              key={id}
              value={id}
              {...getTabProps(index)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-full text-xs text-muted-foreground',
                'hover:text-foreground transition-colors border-r border-border',
                'data-[state=active]:text-foreground data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:bg-background',
                overIndex === index && 'bg-primary/10',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </TabsPrimitive.Trigger>
          )
        })}
      </TabsPrimitive.List>

      <TabsPrimitive.Content value="jobs" className="flex-1 overflow-auto p-3">
        <div className="text-xs text-muted-foreground text-center mt-8 opacity-50">No jobs running</div>
      </TabsPrimitive.Content>

      <TabsPrimitive.Content
        value="agent"
        className="data-[state=active]:flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <AgentPanel />
      </TabsPrimitive.Content>

      <TabsPrimitive.Content
        value="appium"
        className="data-[state=active]:flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <AppiumPanel />
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  )
}
