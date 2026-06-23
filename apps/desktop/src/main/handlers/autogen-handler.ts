import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import { getCodeMap } from '../services/autogen/autogen.service'

// Legacy handler — kept for backward compat with old autogen-test UI.
// New test generation flow uses testgen.handler.ts (TESTGEN_GENERATE).
export function registerAutogenHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IpcChannels.AUTOGEN_GET_CODE_MAP,
    (_, { projectPath }: { projectPath: string }) => getCodeMap(projectPath),
  )
}
