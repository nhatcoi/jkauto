import { useState } from 'react'
import { FolderOpen, Settings, Layers, SlidersHorizontal, FolderPlus } from 'lucide-react'
import logoUrl from '@/assets/logo.png'
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
import { useGlobalKeymap } from '@/hooks/useGlobalKeymap'
import { APP_KEYMAPS, modKey } from '@/shared/keymaps'

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

  useGlobalKeymap(APP_KEYMAPS, {
    newProject:   () => setShowNew(true),
    openProject:  () => handleOpenProject(),
    openSettings: () => setShowAppSettings((v) => !v),
  })

  const M = modKey()

  return (
    <div className="flex items-center h-9 bg-titlebar border-b border-border px-3 gap-3 shrink-0 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-0">
        <img src={logoUrl} className="w-5 h-5 shrink-0 object-contain" alt="JKAuto" />
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

{/* Actions */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew(true)}
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Project<Kbd>{M}+N</Kbd></TooltipContent>
        </Tooltip>

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
          <TooltipContent>Open Project<Kbd>{M}+O</Kbd></TooltipContent>
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
          <TooltipContent>App Settings<Kbd>{M}+,</Kbd></TooltipContent>
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
