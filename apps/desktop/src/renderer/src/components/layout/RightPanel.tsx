import * as TabsPrimitive from '@radix-ui/react-tabs'
import { BrainCircuit, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RightPanel() {
  return (
    <TabsPrimitive.Root defaultValue="agent" className="flex flex-col h-full">
      <TabsPrimitive.List className="flex h-8 border-b border-border bg-panel shrink-0">
        <TabsPrimitive.Trigger
          value="jobs"
          className={cn(
            'flex items-center gap-1.5 px-3 h-full text-xs text-muted-foreground',
            'hover:text-foreground transition-colors border-r border-border',
            'data-[state=active]:text-foreground data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:bg-background',
          )}
        >
          <ListTodo className="w-3.5 h-3.5" />
          Jobs
        </TabsPrimitive.Trigger>
        <TabsPrimitive.Trigger
          value="agent"
          className={cn(
            'flex items-center gap-1.5 px-3 h-full text-xs text-muted-foreground',
            'hover:text-foreground transition-colors',
            'data-[state=active]:text-foreground data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:bg-background',
          )}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          AI Agent
        </TabsPrimitive.Trigger>
      </TabsPrimitive.List>

      <TabsPrimitive.Content value="jobs" className="flex-1 overflow-auto p-3">
        <div className="text-xs text-muted-foreground text-center mt-8 opacity-50">
          No jobs running
        </div>
      </TabsPrimitive.Content>

      <TabsPrimitive.Content value="agent" className="flex flex-col flex-1 overflow-hidden">
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
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  )
}
