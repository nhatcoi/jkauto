import { useUiDialogsStore } from '@/store/ui-dialogs.store'
import { useProjectStore } from '@/store/project.store'
import { NewProjectDialog } from '@/features/project/NewProjectDialog'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { ProjectSettingsDialog } from '@/features/project/ProjectSettingsDialog'
import { EnvManagerDialog } from '@/features/env/EnvManagerDialog'

export function AppDialogs() {
  const { newProject, settings, projectSettings, envManager, close } = useUiDialogsStore()
  const activeProjectPath = useProjectStore((s) => s.activeProjectPath)

  return (
    <>
      <NewProjectDialog open={newProject} onOpenChange={(o) => !o && close('newProject')} />
      <SettingsDialog open={settings} onOpenChange={(o) => !o && close('settings')} />
      {activeProjectPath && (
        <ProjectSettingsDialog
          open={projectSettings}
          onOpenChange={(o) => !o && close('projectSettings')}
          projectPath={activeProjectPath}
        />
      )}
      <EnvManagerDialog open={envManager} onClose={() => close('envManager')} />
    </>
  )
}
