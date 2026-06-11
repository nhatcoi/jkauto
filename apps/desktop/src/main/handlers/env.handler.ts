import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { EnvEntry, EnvWritePayload, EnvCreatePayload } from '@jkauto/core'

export function registerEnvHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.ENV_LIST, async (_, projectPath: string): Promise<EnvEntry[]> => {
    const profilesDir = path.join(projectPath, 'profiles')
    try {
      const files = await fs.readdir(profilesDir)
      return files
        .filter((f) => f.endsWith('.env.json'))
        .map((f) => ({ name: f.replace('.env.json', ''), path: path.join(profilesDir, f) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  })

  ipcMain.handle(IpcChannels.ENV_READ, async (_, filePath: string): Promise<Record<string, string>> => {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return (parsed.variables ?? {}) as Record<string, string>
  })

  ipcMain.handle(IpcChannels.ENV_WRITE, async (_, payload: EnvWritePayload): Promise<void> => {
    const { filePath, variables } = payload
    let existing: Record<string, unknown> = {
      schemaVersion: 1,
      name: path.basename(filePath, '.env.json'),
    }
    try {
      existing = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    } catch { /* new file */ }
    await fs.writeFile(filePath, JSON.stringify({ ...existing, variables }, null, 2), 'utf-8')
  })

  ipcMain.handle(IpcChannels.ENV_CREATE, async (_, payload: EnvCreatePayload): Promise<EnvEntry> => {
    const { projectPath, name } = payload
    const profilesDir = path.join(projectPath, 'profiles')
    await fs.mkdir(profilesDir, { recursive: true })
    const filePath = path.join(profilesDir, `${name}.env.json`)
    const profile = { schemaVersion: 1, name, variables: { baseUrl: '' } }
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8')
    return { name, path: filePath }
  })

  ipcMain.handle(IpcChannels.ENV_DELETE, async (_, filePath: string): Promise<void> => {
    await fs.unlink(filePath)
  })
}
