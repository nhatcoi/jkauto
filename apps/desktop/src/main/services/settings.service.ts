import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { AppSettingsSchema } from '@jkauto/core'
import type { AppSettings } from '@jkauto/core'

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')
const LEGACY_PATH   = path.join(app.getPath('userData'), 'app-settings.json')

let cached: AppSettings | null = null

async function readOrMigrate(): Promise<AppSettings> {
  // Try new path first
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf-8')
    return AppSettingsSchema.parse(JSON.parse(raw))
  } catch { /* fall through */ }

  // Migrate from legacy path
  try {
    const raw = await fs.readFile(LEGACY_PATH, 'utf-8')
    const migrated = AppSettingsSchema.parse(JSON.parse(raw))
    await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true })
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(migrated, null, 2), 'utf-8')
    await fs.rm(LEGACY_PATH, { force: true })
    return migrated
  } catch { /* fall through */ }

  return AppSettingsSchema.parse({})
}

export async function getSettings(): Promise<AppSettings> {
  if (cached) return cached
  cached = await readOrMigrate()
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
