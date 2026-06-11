import type { IpcMain } from 'electron'
import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { WorkspaceState, WorkspaceProjectEntry } from '@jkauto/core'

const DEFAULT_STATE: WorkspaceState = {
  openTabs: [],
  activeTabPath: null,
  layout: {},
  selectedFile: null,
  activeProfile: 'default',
}

function globalWorkspacePath(): string {
  return path.join(app.getPath('userData'), 'workspace-projects.json')
}

export function registerWorkspaceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.WORKSPACE_PROJECTS_GET, async () => {
    try {
      const raw = await fs.readFile(globalWorkspacePath(), 'utf-8')
      const entries: WorkspaceProjectEntry[] = JSON.parse(raw)
      const results: Array<{ path: string; project: unknown; activeProfile: string }> = []
      for (const entry of entries) {
        try {
          const projectFile = path.join(entry.path, 'project.json')
          const proj = JSON.parse(await fs.readFile(projectFile, 'utf-8'))
          results.push({ path: entry.path, project: proj, activeProfile: entry.activeProfile })
        } catch {
          // project folder missing — skip, auto-heals
        }
      }
      return results
    } catch {
      return []
    }
  })

  ipcMain.handle(
    IpcChannels.WORKSPACE_PROJECTS_SET,
    async (_, entries: WorkspaceProjectEntry[]) => {
      await fs.mkdir(path.dirname(globalWorkspacePath()), { recursive: true })
      await fs.writeFile(globalWorkspacePath(), JSON.stringify(entries, null, 2), 'utf-8')
    },
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_GET,
    async (_, projectPath: string): Promise<WorkspaceState> => {
      const statePath = path.join(projectPath, '.autotest', 'workspace.json')
      try {
        const raw = await fs.readFile(statePath, 'utf-8')
        return { ...DEFAULT_STATE, ...JSON.parse(raw) }
      } catch {
        return DEFAULT_STATE
      }
    },
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_SET,
    async (_, projectPath: string, state: Partial<WorkspaceState>) => {
      const autotestDir = path.join(projectPath, '.autotest')
      await fs.mkdir(autotestDir, { recursive: true })
      const statePath = path.join(autotestDir, 'workspace.json')
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')
    },
  )
}
