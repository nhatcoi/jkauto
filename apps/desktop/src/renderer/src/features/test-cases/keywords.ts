import type { KeywordMeta } from '@jkauto/core'

// Renderer no longer hardcodes keyword metadata — it comes from the engine
// registry over IPC (see hooks/useKeywords). This module only provides a
// safe fallback for keywords missing from the fetched list.

export type { KeywordMeta }

export function fallbackKeyword(name: string): KeywordMeta {
  return {
    name,
    label: name,
    color: 'bg-muted',
    description: '',
    platforms: ['web'],
    params: [],
    hasObject: true,
    hasInput: true,
    hasExpected: true,
  }
}

export function getKeyword(list: KeywordMeta[], name: string): KeywordMeta {
  return list.find((k) => k.name === name) ?? fallbackKeyword(name)
}
