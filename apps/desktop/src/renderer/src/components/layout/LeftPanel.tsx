import { useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { ProjectSection } from '@/features/explorer/ProjectSection'
import { NewProjectDialog } from '@/features/project/NewProjectDialog'
import { IpcChannels } from '@jkauto/core'
import type { Project } from '@jkauto/core'
import { invoke } from '@/lib/utils'

export function LeftPanel() {
  const projects = useProjectStore((s) => s.projects)
  const addProject = useProjectStore((s) => s.addProject)
  const [showNew, setShowNew] = useState(false)

  const handleOpenProject = async () => {
    const result = await invoke<{ projectPath: string; project: Project } | null>(
      IpcChannels.PROJECT_OPEN_DIALOG,
    )
    if (result) addProject(result.projectPath, result.project)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-2 h-8 border-b border-border shrink-0 gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          Workspace
        </span>
        <button
          onClick={handleOpenProject}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          title="Open Project"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowNew(true)}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          title="New Project"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Project sections */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {projects.map((entry) => (
          <ProjectSection key={entry.path} entry={entry} />
        ))}
      </div>

      <NewProjectDialog open={showNew} onOpenChange={setShowNew} />
    </div>
  )
}
