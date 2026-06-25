import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { EnvEntry, EnvWritePayload, EnvCreatePayload, EnvRenamePayload, EnvDuplicatePayload, Profile } from '@jkauto/core'

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

  ipcMain.handle(IpcChannels.ENV_READ_PROFILE, async (_, filePath: string): Promise<Profile> => {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      schemaVersion: parsed.schemaVersion ?? 1,
      name: parsed.name ?? path.basename(filePath, '.env.json'),
      description: parsed.description,
      variables: parsed.variables ?? {},
      secrets: parsed.secrets ?? [],
      api: parsed.api,
    } as Profile
  })

  ipcMain.handle(IpcChannels.ENV_WRITE, async (_, payload: EnvWritePayload): Promise<void> => {
    const { filePath, variables, secrets, api } = payload
    let existing: Record<string, unknown> = {
      schemaVersion: 1,
      name: path.basename(filePath, '.env.json'),
    }
    try {
      existing = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    } catch { /* new file */ }
    const updated = { ...existing, variables }
    if (secrets !== undefined) {
      if (secrets.length === 0) {
        delete (updated as Record<string, unknown>).secrets
      } else {
        (updated as Record<string, unknown>).secrets = secrets
      }
    }
    if (api !== undefined) {
      if (api.baseUrl === '' && Object.keys(api.defaultHeaders).length === 0 && api.auth.type === 'none') {
        delete (updated as Record<string, unknown>).api
      } else {
        (updated as Record<string, unknown>).api = api
      }
    }
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')
  })

  ipcMain.handle(IpcChannels.ENV_CREATE, async (_, payload: EnvCreatePayload): Promise<EnvEntry> => {
    const { projectPath, name } = payload
    const profilesDir = path.join(projectPath, 'profiles')
    await fs.mkdir(profilesDir, { recursive: true })
    const filePath = path.join(profilesDir, `${name}.env.json`)
    const profile = { schemaVersion: 1, name, variables: {} }
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8')
    return { name, path: filePath }
  })

  ipcMain.handle(IpcChannels.ENV_DELETE, async (_, filePath: string): Promise<void> => {
    await fs.unlink(filePath)
  })

  ipcMain.handle(IpcChannels.ENV_RENAME, async (_, payload: EnvRenamePayload): Promise<EnvEntry> => {
    const { filePath, newName } = payload
    const dir = path.dirname(filePath)
    const newFilePath = path.join(dir, `${newName}.env.json`)
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    parsed.name = newName
    await fs.writeFile(newFilePath, JSON.stringify(parsed, null, 2), 'utf-8')
    await fs.unlink(filePath)
    return { name: newName, path: newFilePath }
  })

  ipcMain.handle(IpcChannels.ENV_DUPLICATE, async (_, payload: EnvDuplicatePayload): Promise<EnvEntry> => {
    const { filePath, newName } = payload
    const dir = path.dirname(filePath)
    const newFilePath = path.join(dir, `${newName}.env.json`)
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    parsed.name = newName
    await fs.writeFile(newFilePath, JSON.stringify(parsed, null, 2), 'utf-8')
    return { name: newName, path: newFilePath }
  })
}
