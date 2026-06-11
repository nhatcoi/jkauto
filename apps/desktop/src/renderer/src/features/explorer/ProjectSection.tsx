import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FolderOpenDot,
  Settings,
  X,
  Globe,
  Smartphone,
  Monitor,
  Zap,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IpcChannels } from '@jkauto/core'
import type { WorkspaceProject } from '@/store/project.store'
import { useProjectStore } from '@/store/project.store'
import { invoke } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ExplorerTree } from './ExplorerTree'
import { ProjectSettingsDialog } from '@/features/project/ProjectSettingsDialog'

const TYPE_ICON: Record<string, React.ElementType> = {
  web: Globe,
  mobile: Smartphone,
  desktop: Monitor,
  api: Zap,
}

interface Props {
  entry: WorkspaceProject
}

export function ProjectSection({ entry }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const removeProject = useProjectStore((s) => s.removeProject)

  const Icon = TYPE_ICON[entry.project.type] ?? Globe

  const handleOpenFolder = () => {
    invoke(IpcChannels.FS_OPEN_CONTAINING_FOLDER, entry.path)
  }

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 group',
          'hover:bg-secondary/40 transition-colors cursor-pointer',
          'border-b border-border/40',
        )}
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 flex-1 min-w-0 outline-none"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <Icon className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          <span className="text-[11px] font-semibold text-foreground/80 truncate uppercase tracking-wide">
            {entry.project.name}
          </span>
        </button>

        {/* Project menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-secondary outline-none">
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setShowSettings(true)}>
              <Settings className="w-3.5 h-3.5 mr-2 opacity-70" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleOpenFolder}>
              <FolderOpenDot className="w-3.5 h-3.5 mr-2 opacity-70" />
              Open in File Manager
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => removeProject(entry.path)}>
              <X className="w-3.5 h-3.5 mr-2 opacity-70" />
              Remove from Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tree */}
      {expanded && (
        <ExplorerTree projectPath={entry.path} />
      )}

      <ProjectSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        projectPath={entry.path}
      />
    </div>
  )
}
