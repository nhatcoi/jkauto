import { useEffect } from 'react'
import { useProjectStore } from './store/project.store'
import { useAppSettingsStore } from './store/app-settings.store'
import { useRunStore } from './store/run.store'
import { AppLayout } from './components/layout/AppLayout'
import { WelcomeView } from './features/project/WelcomeView'
import { IpcChannels } from '@jkauto/core'
import type { Project, AppiumLogEvent } from '@jkauto/core'
import { invoke } from './lib/utils'
import { TooltipProvider } from './components/ui/tooltip'

export default function App() {
  const hasProjects = useProjectStore((s) => s.projects.length > 0)
  const addProject = useProjectStore((s) => s.addProject)
  const loadSettings = useAppSettingsStore((s) => s.load)
  const addAppiumLog = useRunStore((s) => s.addAppiumLog)

  useEffect(() => {
    loadSettings().catch(() => {})
  }, [])

  // Forward Appium server logs → Appium log store (separate from test Console)
  useEffect(() => {
    const off = window.api.on(IpcChannels.APPIUM_LOG, (raw) => {
      const evt = raw as AppiumLogEvent
      addAppiumLog(evt.message, evt.level)
    })
    return off
  }, [addAppiumLog])

  // Restore workspace on startup
  useEffect(() => {
    invoke<Array<{ path: string; project: Project; activeProfile: string }>>(
      IpcChannels.WORKSPACE_PROJECTS_GET,
    )
      .then((entries) => {
        for (const e of entries) {
          addProject(e.path, e.project, e.activeProfile)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <TooltipProvider delayDuration={600}>
      {hasProjects ? <AppLayout /> : <WelcomeView />}
    </TooltipProvider>
  )
}
