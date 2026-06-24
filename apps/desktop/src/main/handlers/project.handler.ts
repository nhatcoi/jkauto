import { dialog } from 'electron'
import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { CreateProjectPayload, UpdateProjectPayload, DuplicateProjectPayload, RecentProject, SyncProjectPayload, SyncProjectResult } from '@jkauto/core'
import { randomUUID } from 'node:crypto'
import { writeExplorerMetadata } from '../services/explorer-metadata'
import { PROJECT_STRUCTURE } from '../services/project-features'
import { getAnalysisRun } from '../services/autogen/autogen-db'
import { startCodeAnalysis } from '../services/analysis/analysis.service'

const SYNC_IGNORE = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage', '.next', '__pycache__',
  '.venv', 'venv', 'target', 'out', '.cache', '.turbo', '.parcel-cache',
  '.gradle', 'vendor', 'Pods', 'DerivedData', '.DS_Store',
])

async function syncLocalDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    if (SYNC_IGNORE.has(entry.name)) continue
    const srcEntry = path.join(src, entry.name)
    const destEntry = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await syncLocalDir(srcEntry, destEntry)
    } else {
      await fs.copyFile(srcEntry, destEntry)
    }
  }
}

const RECENT_KEY = 'recent_projects'
let recentProjects: RecentProject[] = []

function triggerSilentAnalysis(projectPath: string): void {
  const existing = getAnalysisRun(projectPath)
  if (existing && (existing as any).status === 'completed') return
  setImmediate(async () => {
    try {
      await startCodeAnalysis({ projectPath }, () => {})
    } catch {
      // silent — no repoUrl configured or network error
    }
  })
}

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.PROJECT_CREATE, async (_, payload: CreateProjectPayload) => {
    const projectDir = path.join(payload.location, payload.name)
    await fs.mkdir(projectDir, { recursive: true })

    for (const dir of PROJECT_STRUCTURE) {
      const dirPath = path.join(projectDir, dir.key)
      await fs.mkdir(dirPath, { recursive: true })
      if (dir.name) await writeExplorerMetadata(dirPath, dir.name)
    }

    const now = new Date().toISOString()
    const project = {
      schemaVersion: 1,
      id: randomUUID(),
      name: payload.name,
      type: payload.type,
      icon: payload.icon ?? '',
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
      properties: ['openDirectory'],
      title: 'Open Project',
    })
    if (result.canceled || !result.filePaths[0]) return null
    const projectPath = result.filePaths[0]
    const projectFile = path.join(projectPath, 'project.json')
    try {
      const raw = await fs.readFile(projectFile, 'utf-8')
      const project = JSON.parse(raw)
      const now = new Date().toISOString()
      addRecent({ name: project.name, path: projectPath, type: project.type, openedAt: now })
      triggerSilentAnalysis(projectPath)
      return { projectPath, project }
    } catch (err) {
      throw new Error(
        'Invalid project directory. Please select a directory containing a valid project.json file.'
      )
    }
  })

  ipcMain.handle(IpcChannels.PROJECT_OPEN, async (_, projectPath: string) => {
    const projectFile = path.join(projectPath, 'project.json')
    const raw = await fs.readFile(projectFile, 'utf-8')
    const project = JSON.parse(raw)
    const now = new Date().toISOString()
    addRecent({ name: project.name, path: projectPath, type: project.type, openedAt: now })
    triggerSilentAnalysis(projectPath)
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
      icon: payload.icon ?? existing.icon ?? '',
      description: payload.description,
      repoUrl: payload.repoUrl,
      sourceType: payload.sourceType,
      sourcePath: payload.sourcePath,
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

  ipcMain.handle(IpcChannels.PROJECT_SYNC, async (_, payload: SyncProjectPayload): Promise<SyncProjectResult> => {
    const projectFile = path.join(payload.projectPath, 'project.json')
    const raw = await fs.readFile(projectFile, 'utf-8')
    const project = JSON.parse(raw) as {
      repoUrl?: string
      sourceType?: 'git' | 'local'
      sourcePath?: string
    }

    const sourceType = project.sourceType ?? 'git'

    if (sourceType === 'local') {
      const srcPath = project.sourcePath?.trim()
      if (!srcPath) throw new Error('No local source path configured. Set it in Project Settings.')
      const destPath = path.join(payload.projectPath, '.autotest', 'source')
      await syncLocalDir(srcPath, destPath)
      return { sourceRef: destPath }
    }

    const ref = project.repoUrl?.trim()
    if (!ref) throw new Error('No git repository URL configured. Set it in Project Settings.')
    return { sourceRef: ref }
  })

  ipcMain.handle(IpcChannels.PROJECT_DELETE, async (_, projectPath: string) => {
    await fs.rm(projectPath, { recursive: true, force: true })
    recentProjects = recentProjects.filter((r) => r.path !== projectPath)
  })

  ipcMain.handle(IpcChannels.PROJECT_DUPLICATE, async (_, payload: DuplicateProjectPayload) => {
    const srcPath = payload.sourcePath
    const parentDir = path.dirname(srcPath)
    const srcName = path.basename(srcPath)

    let destName = `${srcName}-copy`
    let destPath = path.join(parentDir, destName)
    let counter = 2
    while (true) {
      try {
        await fs.access(destPath)
        destName = `${srcName}-copy-${counter++}`
        destPath = path.join(parentDir, destName)
      } catch {
        break
      }
    }

    await fs.cp(srcPath, destPath, { recursive: true })

    const projectFile = path.join(destPath, 'project.json')
    const raw = await fs.readFile(projectFile, 'utf-8')
    const existing = JSON.parse(raw)
    const now = new Date().toISOString()
    const duplicated = {
      ...existing,
      id: randomUUID(),
      name: `${existing.name} Copy`,
      updatedAt: now,
      createdAt: now,
    }
    await fs.writeFile(projectFile, JSON.stringify(duplicated, null, 2), 'utf-8')

    addRecent({ name: duplicated.name, path: destPath, type: duplicated.type, openedAt: now })
    return { projectPath: destPath, project: duplicated }
  })
}

function addRecent(entry: RecentProject): void {
  recentProjects = [
    entry,
    ...recentProjects.filter((r) => r.path !== entry.path),
  ].slice(0, 10)
}
