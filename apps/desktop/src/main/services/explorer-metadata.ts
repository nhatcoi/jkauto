import fs from 'node:fs/promises'
import path from 'node:path'

export const EXPLORER_META_FILE = '.jkauto.meta.json'

export function toExplorerKey(value: string, fallback = 'item'): string {
  const key = value
    .toLowerCase()
    .replace(/[{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return key || fallback
}

export function keyToDisplayName(key: string): string {
  return key
    .replace(/\.[^.]+$/g, '')
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function writeExplorerMetadata(dirPath: string, name: string): Promise<void> {
  const displayName = name.trim()
  if (!displayName) return

  await fs.writeFile(
    path.join(dirPath, EXPLORER_META_FILE),
    JSON.stringify({ name: displayName }, null, 2),
    'utf-8',
  )
}

export async function readExplorerMetadataName(dirPath: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(dirPath, EXPLORER_META_FILE), 'utf-8')
    const parsed = JSON.parse(raw) as { name?: unknown }
    return typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : undefined
  } catch {
    return undefined
  }
}
