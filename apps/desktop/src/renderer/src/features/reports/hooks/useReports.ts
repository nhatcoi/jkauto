import { useCallback, useEffect, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { RunRecord } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'

export function useReports() {
  const { activeProject } = useProjectStore()
  const [records, setRecords] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!activeProject) { setRecords([]); return }
    setLoading(true)
    try {
      const runs = await invoke<RunRecord[]>(IpcChannels.ENGINE_GET_ALL_RUNS, activeProject.path)
      setRecords(runs ?? [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  useEffect(() => { void load() }, [load])

  return { records, loading, reload: load }
}
