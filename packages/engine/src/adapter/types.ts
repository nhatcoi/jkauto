import type { Profile, Step, Platform } from '@jkauto/core'

export interface ExecutionHelpers {
  resolveLocator: (ref: string) => Promise<string>
  interpolate: (value: string) => string
}

export interface AdapterStartOptions {
  headless?: boolean
  /** Mobile: Playwright device name, e.g. "iPhone 14", "Pixel 7". Default: "iPhone 14". */
  device?: string
  /** Desktop: path to Electron/native app executable. Falls back to APP_PATH profile variable. */
  appPath?: string
}

// Platform-neutral execution contract. Runner drives the loop; adapter owns
// the platform-specific session (Playwright page, Appium driver, …) and
// dispatches each step to the matching keyword executor.
export interface EngineAdapter<Session = unknown> {
  platform: Platform
  start(profile: Profile, options: AdapterStartOptions): Promise<Session>
  execute(session: Session, step: Step, helpers: ExecutionHelpers): Promise<void>
  stop(session: Session): Promise<void>
}
