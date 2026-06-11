import { useCallback, useEffect, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { FsTreeNode } from '@jkauto/core'
import { invoke } from '@/lib/utils'

export function useExplorerTree(projectPath: string) {
  const [tree, setTree] = useState<FsTreeNode[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const nodes = await invoke<FsTreeNode[]>(IpcChannels.FS_TREE, projectPath)
      setTree(nodes)
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    reload()
    invoke(IpcChannels.FS_WATCH_START, projectPath).catch(() => {})

    const cleanup = window.api.on(IpcChannels.FS_WATCH_EVENT, () => {
      reload()
    })

    return () => {
      cleanup()
      invoke(IpcChannels.FS_WATCH_STOP, projectPath).catch(() => {})
    }
  }, [projectPath, reload])

  return { tree, loading, reload }
}
