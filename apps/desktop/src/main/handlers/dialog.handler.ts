import { dialog } from 'electron'
import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'

export function registerDialogHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.DIALOG_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths
  })

  ipcMain.handle(IpcChannels.DIALOG_OPEN_FILE, async (_, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
    })
    return result.canceled ? null : result.filePaths
  })

  ipcMain.handle(
    IpcChannels.DIALOG_SAVE_FILE,
    async (_, defaultName?: string, filters?: Electron.FileFilter[]) => {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
      })
      return result.canceled ? null : result.filePath
    },
  )
}
