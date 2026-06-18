import { useEffect, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { useAutogenStore } from '../store'
import { autogenApi } from '../api'

export function useTestGeneration(projectPath: string) {
  const {
    repoUrl,
    selectedTargets,
    selectedTypes,
    targets,
    setStatus,
    addGeneratedTest,
    updateGeneratedTest,
    streamChunk,
  } = useAutogenStore()

  useEffect(() => {
    const unsub = autogenApi.onGenerateProgress(({ targetId, status: s, test, chunk }) => {
      if (chunk) {
        streamChunk(targetId, chunk)
        return
      }
      if (s === 'done') {
        updateGeneratedTest(targetId, { status: 'draft', content: test })
      } else if (s === 'failed') {
        updateGeneratedTest(targetId, { status: 'failed' })
      }
    })
    return unsub
  }, [updateGeneratedTest, streamChunk])

  const generate = useCallback(async () => {
    if (!selectedTargets.length) return
    setStatus('generating')

    // Pre-create placeholder entries
    for (const targetId of selectedTargets) {
      const target = targets.find((t) => t.id === targetId)
      addGeneratedTest({
        id: nanoid(),
        name: `Generating: ${target?.label ?? targetId}`,
        type: selectedTypes[0] ?? 'e2e',
        target: target ?? { id: targetId, label: targetId },
        content: null,
        status: 'draft',
        streamBuffer: '',
      })
    }

    try {
      await autogenApi.generateTests({
        projectPath,
        targetIds: selectedTargets,
        testTypes: selectedTypes,
        query: selectedTargets.map((id) => targets.find((t) => t.id === id)?.label ?? id).join(' '),
      })
      setStatus('done')
    } catch (e) {
      setStatus('error', String(e))
    }
  }, [repoUrl, projectPath, selectedTargets, selectedTypes, targets, setStatus, addGeneratedTest])

  return { generate }
}
