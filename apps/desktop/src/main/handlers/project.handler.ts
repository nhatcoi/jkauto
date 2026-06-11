import { dialog } from 'electron'
import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { CreateProjectPayload, UpdateProjectPayload, RecentProject } from '@jkauto/core'
import { randomUUID } from 'node:crypto'

const RECENT_KEY = 'recent_projects'
let recentProjects: RecentProject[] = []

const PROJECT_STRUCTURE = [
  'profiles',
  'test-cases',
  'object-repository',
  'test-suites',
  'keywords',
  'reports',
  'data-files',
  'checkpoints',
  'plugins',
  '.autotest',
]

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.PROJECT_CREATE, async (_, payload: CreateProjectPayload) => {
    const projectDir = path.join(payload.location, payload.name)
    await fs.mkdir(projectDir, { recursive: true })

    for (const dir of PROJECT_STRUCTURE) {
      await fs.mkdir(path.join(projectDir, dir), { recursive: true })
    }

    const now = new Date().toISOString()
    const project = {
      schemaVersion: 1,
      id: randomUUID(),
      name: payload.name,
      type: payload.type,
      description: payload.description,
      repoUrl: payload.repoUrl,
      format: payload.format,
      createdAt: now,
      updatedAt: now,
    }

    const projectFile = path.join(projectDir, 'project.json')
    await fs.writeFile(projectFile, JSON.stringify(project, null, 2), 'utf-8')

    const defaultProfile = {
      schemaVersion: 1,
      name: 'default',
      variables: { baseUrl: 'http://localhost:3000' },
    }
    await fs.writeFile(
      path.join(projectDir, 'profiles', 'default.env.json'),
      JSON.stringify(defaultProfile, null, 2),
      'utf-8',
    )

    addRecent({ name: payload.name, path: projectDir, type: payload.type, openedAt: now })
    return { success: true, projectPath: projectDir, project }
  })

  ipcMain.handle(IpcChannels.PROJECT_OPEN_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Project File', extensions: ['json'] }],
      title: 'Open Project',
    })
    if (result.canceled || !result.filePaths[0]) return null
    const projectPath = path.dirname(result.filePaths[0])
    const raw = await fs.readFile(result.filePaths[0], 'utf-8')
    const project = JSON.parse(raw)
    const now = new Date().toISOString()
    addRecent({ name: project.name, path: projectPath, type: project.type, openedAt: now })
    return { projectPath, project }
  })

  ipcMain.handle(IpcChannels.PROJECT_OPEN, async (_, projectPath: string) => {
    const projectFile = path.join(projectPath, 'project.json')
    const raw = await fs.readFile(projectFile, 'utf-8')
    const project = JSON.parse(raw)
    const now = new Date().toISOString()
    addRecent({ name: project.name, path: projectPath, type: project.type, openedAt: now })
    return { projectPath, project }
  })

  ipcMain.handle(IpcChannels.PROJECT_GET_RECENT, async () => recentProjects)

  ipcMain.handle(IpcChannels.PROJECT_UPDATE, async (_, payload: UpdateProjectPayload) => {
    const projectFile = path.join(payload.projectPath, 'project.json')
    const raw = await fs.readFile(projectFile, 'utf-8')
    const existing = JSON.parse(raw)
    const updated = {
      ...existing,
      name: payload.name,
      type: payload.type,
      description: payload.description,
      repoUrl: payload.repoUrl,
      updatedAt: new Date().toISOString(),
    }
    await fs.writeFile(projectFile, JSON.stringify(updated, null, 2), 'utf-8')
    // keep recent in sync
    const entry = recentProjects.find((r) => r.path === payload.projectPath)
    if (entry) {
      entry.name = payload.name
      entry.type = payload.type
    }
    return updated
  })

  ipcMain.handle(IpcChannels.PROJECT_DELETE, async (_, projectPath: string) => {
    await fs.rm(projectPath, { recursive: true, force: true })
    recentProjects = recentProjects.filter((r) => r.path !== projectPath)
  })
}

function addRecent(entry: RecentProject): void {
  recentProjects = [
    entry,
    ...recentProjects.filter((r) => r.path !== entry.path),
  ].slice(0, 10)
}
