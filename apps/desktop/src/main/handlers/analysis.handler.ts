import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type {
  CodeAnalysisReportPayload,
  CodeAnalysisStartPayload,
} from '@jkauto/core'
import {
  getCodeAnalysisReport,
  startCodeAnalysis,
} from '../services/analysis/analysis.service'

export function registerAnalysisHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IpcChannels.CODE_ANALYSIS_START,
    async (event, payload: CodeAnalysisStartPayload) =>
      startCodeAnalysis(payload, (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IpcChannels.CODE_ANALYSIS_PROGRESS, progress)
        }
      }),
  )

  ipcMain.handle(
    IpcChannels.CODE_ANALYSIS_REPORT,
    (_, payload: CodeAnalysisReportPayload) =>
      getCodeAnalysisReport(payload.projectPath, payload.runId),
  )
}
