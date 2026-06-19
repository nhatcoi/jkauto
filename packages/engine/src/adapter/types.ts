import type { Profile, Step } from '@jkauto/core'

export interface ExecutionHelpers {
  resolveLocator: (ref: string) => Promise<string>
  interpolate: (value: string) => string
  setVariable?: (key: string, value: string) => void
  persistVariable?: (profileKey: string, value: string) => Promise<void>
  persistApiConfig?: (profileKey: string, value: string) => Promise<void>
}

export interface AdapterStartOptions {
  headless?: boolean
  /** Desktop/Appium: path to app executable. Falls back to APP_PATH profile variable. */
  appPath?: string
}

// Platform-neutral execution contract. Runner drives the loop; adapter owns
// the platform-specific session (Playwright page, Appium driver, …) and
// dispatches each step to the matching keyword executor.
// platform is a string to support internal adapter keys (e.g. 'maestro') beyond Platform enum.
export interface EngineAdapter<Session = unknown> {
  platform: string
  start(profile: Profile, options: AdapterStartOptions): Promise<Session>
  execute(session: Session, step: Step, helpers: ExecutionHelpers): Promise<void>
  stop(session: Session): Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  screenshot?: (session: any, options: { path: string }) => Promise<void>
}
