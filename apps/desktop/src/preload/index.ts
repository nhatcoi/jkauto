import { contextBridge, ipcRenderer, shell } from 'electron'
import type { IpcChannel } from '@jkauto/core'

const api = {
  platform: process.platform,
  invoke: (channel: IpcChannel, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: IpcChannel, callback: (...args: unknown[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  off: (channel: IpcChannel, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeAllListeners(channel)
  },
  openExternal: (url: string) => shell.openExternal(url),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api
