import { useCallback, useEffect, useRef, useState } from 'react'
import { IpcChannels, CustomKeywordSchema } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import type { CustomKeyword, CustomKeywordStep } from '../types'

function normalize(raw: unknown): CustomKeyword {
  const result = CustomKeywordSchema.safeParse(raw)
  if (result.success) return result.data
  const fallback = raw as Partial<CustomKeyword>
  return {
    schemaVersion: 1,
    id: fallback.id ?? crypto.randomUUID(),
    name: fallback.name ?? 'Unnamed',
    description: fallback.description ?? '',
    params: fallback.params ?? [],
    steps: fallback.steps ?? [],
  }
}

export function useKeywordFile(filePath: string) {
  const { markTabDirty } = useProjectStore()
  const [kw, setKw] = useState<CustomKeyword | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const kwRef = useRef(kw)
  kwRef.current = kw

  useEffect(() => {
    setKw(null)
    setError(null)
    invoke<string>(IpcChannels.FS_READ_FILE, filePath)
      .then((raw) => setKw(normalize(JSON.parse(raw))))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to read file'))
  }, [filePath])

  const mutate = useCallback(
    (updater: (prev: CustomKeyword) => CustomKeyword) => {
      setKw((prev) => {
        if (!prev) return prev
        const next = updater(prev)
        kwRef.current = next
        markTabDirty(filePath, true)
        return next
      })
    },
    [filePath, markTabDirty],
  )

  const save = useCallback(async () => {
    const current = kwRef.current
    if (!current) return
    setSaving(true)
    try {
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(current, null, 2))
      markTabDirty(filePath, false)
    } finally {
      setSaving(false)
    }
  }, [filePath, markTabDirty])

  const updateStep = useCallback(
    (idx: number, patch: Partial<CustomKeywordStep>) => {
      mutate((prev) => {
        const steps = prev.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s))
        return { ...prev, steps }
      })
    },
    [mutate],
  )

  const addStep = useCallback(() => {
    mutate((prev) => ({
      ...prev,
      steps: [...prev.steps, { keyword: 'navigate-to', objectRef: '', input: '', expected: '' }],
    }))
  }, [mutate])

  const deleteStep = useCallback(
    (idx: number) => {
      mutate((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) }))
    },
    [mutate],
  )

  const moveStep = useCallback(
    (idx: number, dir: -1 | 1) => {
      mutate((prev) => {
        const steps = [...prev.steps]
        const target = idx + dir
        if (target < 0 || target >= steps.length) return prev
        ;[steps[idx], steps[target]] = [steps[target], steps[idx]]
        return { ...prev, steps }
      })
    },
    [mutate],
  )

  return { kw, error, saving, mutate, save, updateStep, addStep, deleteStep, moveStep }
}
