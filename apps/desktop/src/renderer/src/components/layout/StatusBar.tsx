import { useEffect, useState, useCallback } from 'react'
import { GitBranch, CloudOff, Activity, ChevronDown, PanelLeft, PanelRight, Check, Settings2 } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { useUiDialogsStore } from '@/store/ui-dialogs.store'
import { useLayoutStore } from '@/store/layout.store'
import { useZoom } from '@/hooks/useZoom'
import { listEnvs } from '@/features/env/api'
import type { EnvEntry } from '@jkauto/core'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function StatusBar() {
  const { activeProject, setActiveProfile } = useProjectStore()
  const { open } = useUiDialogsStore()
  const { leftCollapsed, rightCollapsed, toggleLeft, toggleRight } = useLayoutStore()
  const { zoomPercent, zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoom()

  const [envs, setEnvs] = useState<EnvEntry[]>([])
  const envManager = useUiDialogsStore((s) => s.envManager)

  const reloadEnvs = useCallback(() => {
    if (!activeProject) { setEnvs([]); return }
    listEnvs(activeProject.path).then(setEnvs).catch(() => setEnvs([]))
  }, [activeProject?.path])

  useEffect(() => { reloadEnvs() }, [reloadEnvs])

  // reload after env manager dialog closes
  useEffect(() => { if (!envManager) reloadEnvs() }, [envManager])

  return (
    <div className="flex items-center h-6 bg-statusbar px-3 gap-4 text-[11px] text-white/80 shrink-0 select-none">
        <button
          type="button"
          onClick={toggleLeft}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 transition-colors"
          title={leftCollapsed ? 'Show left panel' : 'Hide left panel'}
        >
          <PanelLeft className={`w-3.5 h-3.5 ${leftCollapsed ? 'opacity-40' : ''}`} />
        </button>

        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          <span>Ready</span>
        </div>

        <div className="flex-1" />

        {activeProject && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
                  title="Switch environment"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="uppercase tracking-wide text-[10px] font-medium opacity-80">Env:</span>
                  <span className="font-semibold text-white">{activeProject.activeProfile}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="min-w-[180px]">
                <DropdownMenuLabel>Switch Environment</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {envs.map((env) => {
                  const isActive = env.name === activeProject.activeProfile
                  return (
                    <DropdownMenuItem
                      key={env.path}
                      onClick={() => setActiveProfile(activeProject.path, env.name)}
                      className="flex items-center gap-2"
                    >
                      <Check className={`w-3 h-3 shrink-0 ${isActive ? 'text-green-400' : 'opacity-0'}`} />
                      <span className={isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                        {env.name}
                      </span>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => open('envManager')} className="flex items-center gap-2">
                  <Settings2 className="w-3 h-3 shrink-0" />
                  <span>Manage Environments…</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-3 bg-white/20" />
          </>
        )}

        <div className="flex items-center gap-1.5 opacity-70">
          <GitBranch className="w-3 h-3" />
          <span>main</span>
        </div>

        <div className="flex items-center gap-1.5 opacity-70">
          <CloudOff className="w-3 h-3" />
          <span>Not synced</span>
        </div>

        <div className="w-px h-3 bg-white/20" />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={zoomOut}
            disabled={!canZoomOut}
            title="Zoom out (⌘-)"
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 transition-colors text-[11px] leading-none"
          >
            −
          </button>
          <span className="w-8 text-center tabular-nums">{zoomPercent}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={!canZoomIn}
            title="Zoom in (⌘=)"
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 transition-colors text-[11px] leading-none"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={toggleRight}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 transition-colors"
          title={rightCollapsed ? 'Show right panel' : 'Hide right panel'}
        >
          <PanelRight className={`w-3.5 h-3.5 ${rightCollapsed ? 'opacity-40' : ''}`} />
        </button>
    </div>
  )
}
