import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type { FileHistoryRestorePayload } from '@jkauto/core'
import { listHistory, restoreVersion } from '../services/file-history'

export function registerFileHistoryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.FILE_HISTORY_LIST, async (_, filePath: string) => {
    return listHistory(filePath)
  })

  ipcMain.handle(
    IpcChannels.FILE_HISTORY_RESTORE,
    async (_, payload: FileHistoryRestorePayload) => {
      await restoreVersion(payload.filePath, payload.backupPath)
    },
  )
}
