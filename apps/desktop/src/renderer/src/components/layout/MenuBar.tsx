import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import { useUiDialogsStore } from '@/store/ui-dialogs.store'
import { invoke } from '@/lib/utils'
import { IpcChannels } from '@jkauto/core'
import type { RecentProject, Project } from '@jkauto/core'
import { REPORTS_TAB_PATH, KEYWORDS_TAB_PATH, modKey } from '@/shared/keymaps'
import { cn } from '@/lib/utils'

const M = modKey()

function Hint({ children }: { children: string }) {
  return (
    <span className="ml-auto pl-6 text-[10px] text-muted-foreground/55 shrink-0 tabular-nums">
      {children}
    </span>
  )
}

interface TriggerProps {
  label: string
  children: React.ReactNode
}

function Menu({ label, children }: TriggerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          'h-full px-2.5 text-xs text-muted-foreground rounded-sm select-none',
          'hover:text-foreground hover:bg-accent/60 transition-colors',
          'focus:outline-none data-[state=open]:bg-accent/60 data-[state=open]:text-foreground',
        )}>
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={1} className="min-w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MenuBar() {
  const { activeProject, activeProjectPath, projects } = useProjectStore()
  const addProject = useProjectStore((s) => s.addProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const openTab = useProjectStore((s) => s.openTab)
  const { status: runStatus, runId, stopRun } = useRunStore()
  const { open } = useUiDialogsStore()

  const [recents, setRecents] = useState<RecentProject[]>([])

  useEffect(() => {
    invoke<RecentProject[]>(IpcChannels.PROJECT_GET_RECENT)
      .then(setRecents)
      .catch(() => {})
  }, [projects])

  const handleOpenProject = async () => {
    const result = await invoke<{ projectPath: string; project: Project } | null>(
      IpcChannels.PROJECT_OPEN_DIALOG,
    )
    if (result) addProject(result.projectPath, result.project)
  }

  const handleOpenRecent = async (recent: RecentProject) => {
    const result = await invoke<{ projectPath: string; project: Project } | null>(
      IpcChannels.PROJECT_OPEN,
      recent.path,
    )
    if (result) addProject(result.projectPath, result.project)
    else setRecents((prev) => prev.filter((r) => r.path !== recent.path))
  }

  const handleCloseProject = () => {
    if (activeProjectPath) removeProject(activeProjectPath)
  }

  const handleOpenFolder = () => {
    if (activeProjectPath)
      invoke(IpcChannels.FS_OPEN_CONTAINING_FOLDER, activeProjectPath).catch(() => {})
  }

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent('jkauto:refresh-explorer'))
  }

  const handleStop = async () => {
    if (runId) await invoke(IpcChannels.ENGINE_STOP, runId).catch(() => {})
    stopRun()
  }

  const handleRun = (debug = false) => {
    window.dispatchEvent(new CustomEvent('jkauto:run', { detail: { debug } }))
  }

  const hasProject = !!activeProject

  return (
    <div className="flex items-center h-7 bg-titlebar border-b border-border px-2 gap-0.5 shrink-0">
      {/* File */}
      <Menu label="File">
        <DropdownMenuItem onClick={() => open('newProject')}>
          New Project<Hint>{M}+N</Hint>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenProject}>
          Open Project…<Hint>{M}+O</Hint>
        </DropdownMenuItem>

        {recents.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center justify-between">
              <span>Recent Projects</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-56">
              {recents.slice(0, 10).map((r) => (
                <DropdownMenuItem key={r.path} onClick={() => handleOpenRecent(r)} className="flex-col items-start gap-0">
                  <span className="truncate max-w-[220px]">{r.name}</span>
                  <span className="text-[10px] text-muted-foreground/60 truncate max-w-[220px]">{r.path}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCloseProject} disabled={!hasProject}>
          Close Project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => open('settings')}>
          Settings<Hint>{M}+,</Hint>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.close()}>
          Exit
        </DropdownMenuItem>
      </Menu>

      {/* Project */}
      <Menu label="Project">
        <DropdownMenuItem onClick={handleRefresh} disabled={!hasProject}>
          Refresh Explorer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open('projectSettings')} disabled={!hasProject}>
          Project Settings…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleOpenFolder} disabled={!hasProject}>
          Open Folder in Explorer
        </DropdownMenuItem>
      </Menu>

      {/* Run */}
      <Menu label="Run">
        <DropdownMenuItem onClick={() => handleRun(false)} disabled={!hasProject || runStatus === 'running'}>
          Run Test Case<Hint>F5</Hint>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRun(true)} disabled={!hasProject || runStatus === 'running'}>
          Debug Test Case<Hint>F6</Hint>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleStop} disabled={runStatus !== 'running'}>
          Stop<Hint>⇧+F5</Hint>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!hasProject || runStatus === 'running'}
          onClick={() => window.dispatchEvent(new CustomEvent('jkauto:run-suite'))}
        >
          Run Test Suite
        </DropdownMenuItem>
      </Menu>

      {/* Tools */}
      <Menu label="Tools">
        <DropdownMenuItem onClick={() => open('envManager')} disabled={!hasProject}>
          Environment Manager…
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => activeProjectPath && openTab(REPORTS_TAB_PATH, 'Reports', activeProjectPath)}
          disabled={!hasProject}
        >
          Reports
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => activeProjectPath && openTab(KEYWORDS_TAB_PATH, 'Keywords', activeProjectPath)}
          disabled={!hasProject}
        >
          Keyword Manager
        </DropdownMenuItem>
      </Menu>

      {/* Help */}
      <Menu label="Help">
        <DropdownMenuItem
          onClick={() => window.dispatchEvent(new CustomEvent('jkauto:open-docs'))}
        >
          Documentation
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('jkauto:about'))}>
          About JKAuto
        </DropdownMenuItem>
      </Menu>
    </div>
  )
}
