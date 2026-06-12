import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { AppSettingsSchema } from '@jkauto/core'
import type { AppSettings } from '@jkauto/core'

const SETTINGS_PATH = path.join(app.getPath('userData'), 'app-settings.json')

let cached: AppSettings | null = null

export async function getSettings(): Promise<AppSettings> {
  if (cached) return cached
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf-8')
    cached = AppSettingsSchema.parse(JSON.parse(raw))
  } catch {
    cached = AppSettingsSchema.parse({})
  }
  return cached
}

export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const merged = AppSettingsSchema.parse({ ...current, ...patch })
  cached = merged
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true })
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}
