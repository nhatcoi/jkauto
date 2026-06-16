import { useCallback, useEffect, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'

export interface CustomKeywordEntry {
  name: string
  path: string
}

export function useCustomKeywords(projectPath: string | undefined) {
  const [entries, setEntries] = useState<CustomKeywordEntry[]>([])

  const load = useCallback(async () => {
    if (!projectPath) { setEntries([]); return }
    try {
      const files = await invoke<{ name: string; path: string; type: string }[]>(
        IpcChannels.FS_LIST_DIR,
        `${projectPath}/keywords`,
      )
      setEntries(
        files
          .filter((f) => f.type === 'file' && (f.name.endsWith('.keywords.json') || f.name.endsWith('.keywords.yaml')))
          .map((f) => ({ name: f.name.replace(/\.keywords\.(json|yaml)$/, ''), path: f.path }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch {
      setEntries([])
    }
  }, [projectPath])

  useEffect(() => { void load() }, [load])

  return { entries, reload: load }
}
