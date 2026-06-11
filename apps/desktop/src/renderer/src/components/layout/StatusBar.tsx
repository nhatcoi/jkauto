import { GitBranch, CloudOff, Activity } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'

export function StatusBar() {
  const { activeProject } = useProjectStore()

  return (
    <div className="flex items-center h-6 bg-statusbar px-3 gap-4 text-[11px] text-white/80 shrink-0 select-none">
      <div className="flex items-center gap-1.5">
        <Activity className="w-3 h-3" />
        <span>Ready</span>
      </div>

      <div className="flex-1" />

      {activeProject && (
        <>
          <div className="flex items-center gap-1.5 opacity-80">
            <span className="uppercase tracking-wide text-[10px] font-medium">Profile:</span>
            <span className="font-semibold text-white">{activeProject.activeProfile}</span>
          </div>
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
    </div>
  )
}
