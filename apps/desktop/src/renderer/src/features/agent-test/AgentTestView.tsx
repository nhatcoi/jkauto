import { Bot } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'

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

      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Agent Test UI removed. Ready to rebuild.
      </div>
    </div>
  )
}
