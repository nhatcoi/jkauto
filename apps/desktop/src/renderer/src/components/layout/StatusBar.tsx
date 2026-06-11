import { useState } from 'react'
import { GitBranch, CloudOff, Activity, ChevronDown } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { EnvManagerDialog } from '@/features/env/EnvManagerDialog'

export function StatusBar() {
  const { activeProject } = useProjectStore()
  const [envOpen, setEnvOpen] = useState(false)

  return (
    <>
      <div className="flex items-center h-6 bg-statusbar px-3 gap-4 text-[11px] text-white/80 shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          <span>Ready</span>
        </div>

        <div className="flex-1" />

        {activeProject && (
          <>
            <button
              type="button"
              onClick={() => setEnvOpen(true)}
              className="flex items-center gap-1 hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
              title="Manage environments"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              <span className="uppercase tracking-wide text-[10px] font-medium opacity-80">Env:</span>
              <span className="font-semibold text-white">{activeProject.activeProfile}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
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

      <EnvManagerDialog open={envOpen} onClose={() => setEnvOpen(false)} />
    </>
  )
}
