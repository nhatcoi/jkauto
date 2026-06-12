import { useEffect, useState } from 'react'
import { Play, Square, FolderOpen, Settings, Layers, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { useProjectStore } from '@/store/project.store'
import { ProjectSettingsDialog } from '@/features/project/ProjectSettingsDialog'
import { NewProjectDialog } from '@/features/project/NewProjectDialog'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { IpcChannels } from '@jkauto/core'
import type { Project } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function TitleBar() {
  const { activeProject, activeProjectPath, projects } = useProjectStore()
  const addProject = useProjectStore((s) => s.addProject)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [showAppSettings, setShowAppSettings] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const handleOpenProject = async () => {
    const result = await invoke<{ projectPath: string; project: Project } | null>(
      IpcChannels.PROJECT_OPEN_DIALOG,
    )
    if (result) addProject(result.projectPath, result.project)
  }

  // Ctrl+, opens app settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setShowAppSettings((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex items-center h-9 bg-titlebar border-b border-border px-3 gap-3 shrink-0 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary-foreground">JK</span>
        </div>
        <span className="text-xs font-semibold text-foreground/70 hidden sm:block">JKAuto</span>

        {activeProject && (
          <>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
              {activeProject.project.name}
            </span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border shrink-0',
                'border-border text-muted-foreground bg-muted/30',
              )}
            >
              {activeProject.project.type}
            </span>
          </>
        )}

        {projects.length > 1 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary/80 border border-primary/20 shrink-0 flex items-center gap-1">
            <Layers className="w-2.5 h-2.5" />
            {projects.length}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Run controls */}
      {activeProject && (
        <>
          <div className="flex items-center gap-1">
            <Button
              variant="default"
              size="sm"
              className="h-6 px-2.5 text-xs gap-1 bg-[hsl(var(--run-success))] hover:bg-[hsl(142,72%,36%)] text-white"
            >
              <Play className="w-3 h-3 fill-white" />
              Run
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="w-px h-4 bg-border" />
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleOpenProject}
            >
              <FolderOpen className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Project</TooltipContent>
        </Tooltip>

        {activeProject && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setShowProjectSettings(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Project Settings</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowAppSettings(true)}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>App Settings<Kbd>Ctrl+,</Kbd></TooltipContent>
        </Tooltip>
      </div>

      <ProjectSettingsDialog
        open={showProjectSettings}
        onOpenChange={setShowProjectSettings}
        projectPath={activeProjectPath ?? undefined}
      />
      <SettingsDialog open={showAppSettings} onOpenChange={setShowAppSettings} />
      <NewProjectDialog open={showNew} onOpenChange={setShowNew} />
    </div>
  )
}
