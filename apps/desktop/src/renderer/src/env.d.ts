/// <reference types="vite/client" />

interface ElectronApi {
  platform: string
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
  off: (channel: string, callback: (...args: unknown[]) => void) => void
  openExternal: (url: string) => Promise<void>
}

interface Window {
  api: ElectronApi
}
