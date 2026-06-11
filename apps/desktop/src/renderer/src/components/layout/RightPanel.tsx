import { useState } from 'react'
import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { BrainCircuit, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTabDnd, moveItem } from '@/hooks/useTabDnd'

type TabId = 'jobs' | 'agent'

const TAB_META: Record<TabId, { label: string; icon: typeof ListTodo }> = {
  jobs: { label: 'Jobs', icon: ListTodo },
  agent: { label: 'AI Agent', icon: BrainCircuit },
}

const TAB_CONTENT: Record<TabId, ReactNode> = {
  jobs: (
    <div className="text-xs text-muted-foreground text-center mt-8 opacity-50">No jobs running</div>
  ),
  agent: (
    <>
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="bg-secondary/40 rounded-lg p-3 text-xs text-foreground/80">
          <span className="font-semibold text-primary block mb-1">JKAuto AI</span>
          Hello! I can help you generate test cases, write keywords, and automate repetitive tasks.
          Tell me what you'd like to test.
        </div>
      </div>
      {/* Input */}
      <div className="border-t border-border p-2 shrink-0">
        <div className="flex items-center gap-2 bg-input rounded-md border border-border px-3 py-2">
          <input
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder="Ask AI to generate tests..."
          />
        </div>
      </div>
    </>
  ),
}

export function RightPanel() {
  const [order, setOrder] = useState<TabId[]>(['jobs', 'agent'])
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
        {TAB_CONTENT.jobs}
      </TabsPrimitive.Content>

      <TabsPrimitive.Content value="agent" className="flex flex-col flex-1 overflow-hidden">
        {TAB_CONTENT.agent}
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  )
}
