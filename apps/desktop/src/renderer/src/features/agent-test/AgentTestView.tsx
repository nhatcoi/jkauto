import { Bot } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentSetupTab } from './AgentSetupTab'
import { TestRunnerTab } from './TestRunnerTab'

export function AgentTestView() {
  const { activeProject } = useProjectStore()

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Open a project to use Agent Test.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel/70 px-4">
        <Bot className="h-4 w-4 text-primary" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">Agent Test</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {activeProject.project.name} / {activeProject.activeProfile}
          </div>
        </div>
      </div>

      <Tabs defaultValue="runner" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full rounded-none border-b border-border bg-panel/50 h-9 shrink-0 justify-start px-2 gap-0">
          <TabsTrigger value="runner" className="text-xs h-7 px-3">
            Test Runner
          </TabsTrigger>
          <TabsTrigger value="setup" className="text-xs h-7 px-3">
            Agent Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runner" className="flex-1 min-h-0 overflow-hidden m-0">
          <TestRunnerTab />
        </TabsContent>

        <TabsContent value="setup" className="flex-1 min-h-0 overflow-hidden m-0">
          <AgentSetupTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
