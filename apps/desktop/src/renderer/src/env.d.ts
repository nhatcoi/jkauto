/// <reference types="vite/client" />

import type { IpcChannel } from '@jkauto/core'

interface ElectronApi {
  platform: string
  invoke: (channel: IpcChannel, ...args: unknown[]) => Promise<unknown>
  on: (channel: IpcChannel, callback: (...args: unknown[]) => void) => () => void
  off: (channel: IpcChannel, callback: (...args: unknown[]) => void) => void
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
