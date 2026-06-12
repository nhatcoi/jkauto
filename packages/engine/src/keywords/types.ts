import type { Page } from '@playwright/test'
import type { KeywordMeta } from '@jkauto/core'

// Mutable API test session — api keywords read/write this across steps.
export interface ApiSession {
  baseUrl: string
  defaultHeaders: Record<string, string>
  lastResponse: ApiResponse | null
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
}

// Context for page-based platforms: web, mobile, desktop (all use Playwright Page).
export interface KeywordContext {
  page: Page
  objectRef: string
  input: string
  expected: string
  resolveLocator: (ref: string) => Promise<string>
  interpolate: (value: string) => string
}

// Context for api platform.
export interface ApiKeywordContext {
  session: ApiSession
  objectRef: string
  input: string
  expected: string
  resolveLocator: (ref: string) => Promise<string>
  interpolate: (value: string) => string
}

export type PageKeywordExecutor = (ctx: KeywordContext) => Promise<void>
export type ApiKeywordExecutor = (ctx: ApiKeywordContext) => Promise<void>

// Backwards-compat alias.
export type KeywordExecutor = PageKeywordExecutor

export interface KeywordDef extends KeywordMeta {
  executors: {
    web?: PageKeywordExecutor
    mobile?: PageKeywordExecutor
    desktop?: PageKeywordExecutor
    api?: ApiKeywordExecutor
  }
}
