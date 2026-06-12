import { useEffect, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { KeywordMeta, Platform } from '@jkauto/core'
import { invoke } from '@/lib/utils'

// Keyword registry is static for the session — fetch once, cache module-wide.
let cache: Promise<KeywordMeta[]> | null = null

function loadKeywords(): Promise<KeywordMeta[]> {
  if (!cache) {
    cache = invoke<KeywordMeta[]>(IpcChannels.ENGINE_GET_KEYWORDS).catch((err) => {
      cache = null // allow retry on next mount
      throw err
    })
  }
  return cache
}

export function useKeywords(platform?: Platform): KeywordMeta[] {
  const [all, setAll] = useState<KeywordMeta[]>([])

  useEffect(() => {
    let active = true
    loadKeywords()
      .then((list) => {
        if (active) setAll(list)
      })
      .catch(() => {
        if (active) setAll([])
      })
    return () => {
      active = false
    }
  }, [])

  if (!platform) return all
  return all.filter((k) => k.platforms.includes(platform))
}
