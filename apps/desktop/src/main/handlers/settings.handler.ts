import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type { AppSettings } from '@jkauto/core'
import { getSettings, setSettings } from '../services/settings.service'

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.APP_SETTINGS_GET, () => getSettings())

  ipcMain.handle(IpcChannels.APP_SETTINGS_SET, (_, patch: Partial<AppSettings>) =>
    setSettings(patch),
  )

  ipcMain.handle(IpcChannels.APP_ZOOM_GET, (event: IpcMainInvokeEvent) =>
    event.sender.getZoomFactor(),
  )

  ipcMain.handle(IpcChannels.APP_ZOOM_SET, (event: IpcMainInvokeEvent, factor: number) => {
    event.sender.setZoomFactor(factor)
  })
}
