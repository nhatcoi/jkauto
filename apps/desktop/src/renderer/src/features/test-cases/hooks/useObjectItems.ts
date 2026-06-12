import { useEffect, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { ObjectRepository } from '@jkauto/core'
import { invoke } from '@/lib/utils'

export interface ObjectEntry {
  name: string
  repoName: string
  /** Full qualified key: repoName.objectName */
  key: string
}

async function loadObjectEntries(projectPath: string): Promise<ObjectEntry[]> {
  let entries: ObjectEntry[] = []
  try {
    const items = await invoke<Array<{ name: string; type: string }>>(
      IpcChannels.FS_LIST_DIR,
      `${projectPath}/object-repository`,
    )
    for (const item of items ?? []) {
      if (!item.name.endsWith('.objects.json')) continue
      try {
        const raw = await invoke<string>(
          IpcChannels.FS_READ_FILE,
          `${projectPath}/object-repository/${item.name}`,
        )
        const repo = JSON.parse(raw) as ObjectRepository
        for (const obj of repo.objects ?? []) {
          entries.push({ name: obj.name, repoName: repo.name, key: `${repo.name}.${obj.name}` })
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* object-repository dir missing */ }
  return entries
}

// Module-level cache keyed by projectPath.
const cache = new Map<string, Promise<ObjectEntry[]>>()

export function useObjectItems(projectPath?: string): ObjectEntry[] {
  const [items, setItems] = useState<ObjectEntry[]>([])

  useEffect(() => {
    if (!projectPath) return
    let active = true
    let promise = cache.get(projectPath)
    if (!promise) {
      promise = loadObjectEntries(projectPath)
      cache.set(projectPath, promise)
    }
    promise
      .then((list) => { if (active) setItems(list) })
      .catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [projectPath])

  return items
}
