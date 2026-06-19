import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { BrowserWindow } from 'electron'
import { IpcChannels } from '@jkauto/core'

export function registerWindowHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('window:minimize', (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
  })

  ipcMain.handle('window:maximize', (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })

  ipcMain.handle('window:close', (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })
}
