import { useEffect } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { Project } from '@jkauto/core'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import { useUiDialogsStore } from '@/store/ui-dialogs.store'
import { invoke } from '@/lib/utils'
import { REPORTS_TAB_PATH, KEYWORDS_TAB_PATH } from '@/shared/keymaps'

type DialogKey = 'newProject' | 'settings' | 'projectSettings' | 'envManager'

interface MenuEvent {
  event: string
  detail?: unknown
}

export function useMenuEvents() {
  const addProject = useProjectStore((s) => s.addProject)
  const activeProjectPath = useProjectStore((s) => s.activeProjectPath)
  const openTab = useProjectStore((s) => s.openTab)
  const { open: openDialog } = useUiDialogsStore()
  const { runId, stopRun } = useRunStore()

  useEffect(() => {
    const unsubscribe = window.api.on(IpcChannels.MENU_EVENT, (payload: unknown) => {
      const { event, detail } = payload as MenuEvent

      switch (event) {
        case 'open-dialog':
          openDialog(detail as DialogKey)
          break

        case 'open-project':
          invoke<{ projectPath: string; project: Project } | null>(IpcChannels.PROJECT_OPEN_DIALOG)
            .then((result) => { if (result) addProject(result.projectPath, result.project) })
            .catch(() => {})
          break

        case 'open-folder':
          if (activeProjectPath)
            invoke(IpcChannels.FS_OPEN_CONTAINING_FOLDER, activeProjectPath).catch(() => {})
          break

        case 'refresh-explorer':
          window.dispatchEvent(new CustomEvent('jkauto:refresh-explorer'))
          break

        case 'run':
          window.dispatchEvent(new CustomEvent('jkauto:run', { detail }))
          break

        case 'stop':
          if (runId)
            invoke(IpcChannels.ENGINE_STOP, runId).catch(() => {})
          stopRun()
          break

        case 'run-suite':
          window.dispatchEvent(new CustomEvent('jkauto:run-suite'))
          break

        case 'open-tab':
          if (activeProjectPath) {
            if (detail === 'reports')
              openTab(REPORTS_TAB_PATH, 'Reports', activeProjectPath)
            else if (detail === 'keywords')
              openTab(KEYWORDS_TAB_PATH, 'Keywords', activeProjectPath)
          }
          break

        case 'about':
          window.dispatchEvent(new CustomEvent('jkauto:about'))
          break
      }
    })

    return unsubscribe
  }, [addProject, activeProjectPath, openTab, openDialog, runId, stopRun])
}
