import { useEffect, useCallback } from 'react'
import { useAutogenStore } from '../store'
import { autogenApi } from '../api'

export function useRepoIndex(projectPath: string) {
  const { repoUrl, status, progress, stack, codeMap, setStatus, setProgress, setIndexResult } =
    useAutogenStore()

  useEffect(() => {
    const unsub = autogenApi.onProgress((p) => {
      setProgress(p)
      if (p.phase === 'error') setStatus('error', p.message)
    })
    return unsub
  }, [setProgress, setStatus])

  const startIndex = useCallback(async () => {
    if (!repoUrl) return
    setStatus('indexing')
    try {
      const result = await autogenApi.startIndex({ repoUrl, projectPath })
      setIndexResult(result.stack, result.map)
    } catch (e) {
      setStatus('error', String(e))
    }
  }, [repoUrl, projectPath, setStatus, setIndexResult])

  const loadExisting = useCallback(async () => {
    const existing = await autogenApi.getCodeMap(projectPath)
    if (existing) {
      setIndexResult(
        { framework: existing.framework as any, language: existing.language as any, hasOpenApi: false, hasReadme: false },
        { pages: existing.pages as any, elements: existing.elements as any, endpoints: existing.endpoints as any, symbols: [], flows: [] }
      )
    }
  }, [projectPath, setIndexResult])

  return { status, progress, stack, codeMap, startIndex, loadExisting }
}
