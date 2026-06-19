import type { Page } from '@playwright/test'
import type { KeywordMeta } from '@jkauto/core'

// Minimal Appium/WebDriverIO driver contract — avoids importing webdriverio in every keyword file.
export interface AppiumElement {
  click(): Promise<void>
  setValue(value: string | number | string[]): Promise<void>
  clearValue(): Promise<void>
  getText(): Promise<string>
  isDisplayed(): Promise<boolean>
  waitForDisplayed(opts?: { timeout?: number }): Promise<boolean>
}
export interface AppiumDriver {
  $(selector: string): AppiumElement
  pause(ms: number): Promise<unknown>
  url(address: string): Promise<unknown>
  getWindowSize(): Promise<{ width: number; height: number }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  touchAction(actions: any[]): Promise<unknown>
  deleteSession(): Promise<void>
  back(): Promise<void>
  pressKeyCode(keycode: number): Promise<void>
  activateApp(appId: string): Promise<void>
  terminateApp(appId: string): Promise<void>
  saveScreenshot(filepath: string): Promise<unknown>
}

// Mutable API test session — api keywords read/write this across steps.
export interface ApiSession {
  baseUrl: string
  defaultHeaders: Record<string, string>
  lastResponse: ApiResponse | null
  variables: Record<string, string>
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
  setVariable?: (key: string, value: string) => void
  persistVariable?: (profileKey: string, value: string) => Promise<void>
  persistApiConfig?: (profileKey: string, value: string) => Promise<void>
}

// Context for appium platform (native iOS/Android via WebDriverIO).
export interface AppiumKeywordContext {
  driver: AppiumDriver
  objectRef: string
  input: string
  expected: string
  resolveLocator: (ref: string) => Promise<string>
  interpolate: (value: string) => string
}

export type PageKeywordExecutor = (ctx: KeywordContext) => Promise<void>
export type ApiKeywordExecutor = (ctx: ApiKeywordContext) => Promise<void>
export type AppiumKeywordExecutor = (ctx: AppiumKeywordContext) => Promise<void>

// Backwards-compat alias.
export type KeywordExecutor = PageKeywordExecutor

export interface KeywordDef extends KeywordMeta {
  executors: {
    web?: PageKeywordExecutor
    mobile?: PageKeywordExecutor
    desktop?: PageKeywordExecutor
    api?: ApiKeywordExecutor
    appium?: AppiumKeywordExecutor
  }
}
