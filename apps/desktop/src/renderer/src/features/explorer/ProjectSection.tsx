import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FolderOpenDot,
  Boxes,
  Settings,
  X,
  Copy,
  CheckCheck,
} from 'lucide-react'
import { PROJECT_ICON_OPTIONS } from '@/features/project/NewProjectDialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { IpcChannels } from '@jkauto/core'
import type { WorkspaceProject } from '@/store/project.store'
import { useProjectStore } from '@/store/project.store'
import { invoke } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ExplorerTree } from './ExplorerTree'
import { ProjectSettingsDialog } from '@/features/project/ProjectSettingsDialog'

const ICON_MAP = new Map(PROJECT_ICON_OPTIONS.map(({ name, component }) => [name, component]))

const TYPE_DEFAULT_ICONS: Record<string, string> = {
  web: 'Globe',
  mobile: 'Smartphone',
  desktop: 'Monitor',
  api: 'Zap',
}

interface Props {
  entry: WorkspaceProject
}

export function ProjectSection({ entry }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const removeProject = useProjectStore((s) => s.removeProject)
  const addProject = useProjectStore((s) => s.addProject)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const activeProjectPath = useProjectStore((s) => s.activeProjectPath)
  const isActive = activeProjectPath === entry.path

  const handleOpenFolder = () => {
    invoke(IpcChannels.FS_OPEN_CONTAINING_FOLDER, entry.path)
  }

  const handleDuplicate = async () => {
    if (duplicating) return
    setDuplicating(true)
    try {
      const result = await invoke<{ projectPath: string; project: typeof entry.project }>(
        IpcChannels.PROJECT_DUPLICATE,
        { sourcePath: entry.path },
      )
      addProject(result.projectPath, result.project)
    } finally {
      setDuplicating(false)
    }
  }

  const iconName = entry.project.icon || TYPE_DEFAULT_ICONS[entry.project.type] || ''
  const ProjectIcon = ICON_MAP.get(iconName) ?? Boxes

  return (
    <div className="flex flex-col">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5',
              'hover:bg-secondary/40 transition-colors cursor-pointer select-none',
              'border-b border-border/40',
            )}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <ProjectIcon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="text-[11px] font-semibold text-foreground/80 truncate uppercase tracking-wide flex-1 min-w-0">
              {entry.project.name}
            </span>
            {isActive && (
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400" title="Active project" />
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          {!isActive && (
            <>
              <ContextMenuItem onSelect={() => setActiveProject(entry.path)}>
                <CheckCheck className="w-3.5 h-3.5 mr-2 opacity-70" />
                Set as Active
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          <ContextMenuItem onSelect={handleDuplicate} disabled={duplicating}>
            <Copy className="w-3.5 h-3.5 mr-2 opacity-70" />
            {duplicating ? 'Duplicating…' : 'Duplicate'}
          </ContextMenuItem>

          <ContextMenuItem onSelect={handleOpenFolder}>
            <FolderOpenDot className="w-3.5 h-3.5 mr-2 opacity-70" />
            Open Containing Folder
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem onSelect={() => setShowSettings(true)}>
            <Settings className="w-3.5 h-3.5 mr-2 opacity-70" />
            Project Settings
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setShowRemoveConfirm(true)}
          >
            <X className="w-3.5 h-3.5 mr-2 opacity-70" />
            Remove from Workspace
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && <ExplorerTree projectPath={entry.path} />}

      <ProjectSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        projectPath={entry.path}
      />

      <Dialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove from Workspace</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{entry.project.name}</span> from workspace?
            Project files stay on disk.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowRemoveConfirm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { removeProject(entry.path); setShowRemoveConfirm(false) }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
