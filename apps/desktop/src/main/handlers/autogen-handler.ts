import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import { startIndex, getCodeMap, generateAndSaveTests } from '../services/autogen/autogen.service'
import { getSettings } from '../services/settings.service'

export function registerAutogenHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IpcChannels.AUTOGEN_START_INDEX,
    async (event, params: { repoUrl: string; projectPath: string; branch?: string }) => {
      const onProgress = (p: object) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IpcChannels.AUTOGEN_INDEX_PROGRESS, p)
        }
      }

      try {
        const result = await startIndex(params, onProgress)
        return { ok: true, indexId: result.indexId, stack: result.stack, map: result.map }
      } catch (e) {
        onProgress({ phase: 'error', message: String(e), percent: 0 })
        throw e
      }
    }
  )

  ipcMain.handle(
    IpcChannels.AUTOGEN_GET_CODE_MAP,
    (_, { projectPath }: { projectPath: string }) => {
      return getCodeMap(projectPath)
    }
  )

  ipcMain.handle(
    IpcChannels.AUTOGEN_GENERATE,
    async (
      event,
      params: {
        projectPath: string
        targetIds: string[]
        testTypes: string[]
        query?: string
      }
    ) => {
      const settings = await getSettings()
      const configOverride = settings.agent
        ? { baseUrl: settings.agent.baseUrl, apiKey: settings.agent.apiKey, model: settings.agent.model }
        : undefined

      const onProgress = (data: object) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IpcChannels.AUTOGEN_GENERATE_PROGRESS, data)
        }
      }

      await generateAndSaveTests({ ...params, configOverride }, onProgress)
      return { ok: true }
    }
  )

  ipcMain.handle(IpcChannels.AUTOGEN_CANCEL, () => {
    // TODO: AbortController for in-flight operations
    return { ok: true }
  })
}
