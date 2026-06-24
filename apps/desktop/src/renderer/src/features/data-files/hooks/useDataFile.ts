import { useState, useEffect, useCallback } from 'react'
import { readDataFile, writeDataFile } from '../api'
import type { DataFile } from '../types'

export function useDataFile(filePath: string) {
  const [data, setData] = useState<DataFile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setData(null)
    setError(null)
    setDirty(false)
    readDataFile(filePath)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to read data file'))
  }, [filePath])

  const mutate = useCallback((fn: (prev: DataFile) => DataFile) => {
    setData((prev) => {
      if (!prev) return prev
      setDirty(true)
      return fn(prev)
    })
  }, [])

  const save = useCallback(async () => {
    if (!data) return
    setSaving(true)
    try {
      await writeDataFile(filePath, data)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [filePath, data])

  return { data, saving, error, dirty, mutate, save }
}
