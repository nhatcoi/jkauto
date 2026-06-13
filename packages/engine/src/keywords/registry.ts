import type { KeywordMeta } from '@jkauto/core'
import type { KeywordDef } from './types'
import { navigationKeywords } from './defs/navigation'
import { interactionKeywords } from './defs/interaction'
import { assertionKeywords } from './defs/assertions'
import { waitKeywords } from './defs/wait'
import { screenshotKeywords } from './defs/screenshot'
import { mobileKeywords } from './defs/mobile'
import { desktopKeywords } from './defs/desktop'
import { apiKeywords } from './defs/api'
import { callTestCaseKeyword } from './defs/call-test-case'

export type { KeywordDef, KeywordContext, KeywordExecutor, PageKeywordExecutor, ApiKeywordExecutor, ApiSession, ApiKeywordContext } from './types'

const allDefs: KeywordDef[] = [
  ...navigationKeywords,
  ...interactionKeywords,
  ...assertionKeywords,
  ...waitKeywords,
  ...screenshotKeywords,
  ...mobileKeywords,
  ...desktopKeywords,
  ...apiKeywords,
  callTestCaseKeyword,
]

const keywords: Map<string, KeywordDef> = new Map(allDefs.map((d) => [d.name, d]))

export function getKeyword(name: string): KeywordDef | undefined {
  return keywords.get(name)
}

export function getAllKeywords(): KeywordDef[] {
  return Array.from(keywords.values())
}

// Strip executor fns → serializable metadata for IPC / renderer UI.
export function getKeywordMeta(): KeywordMeta[] {
  return getAllKeywords().map(({ executors: _executors, ...meta }) => meta)
}
