import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type {
  CodeAnalysisArtifactUpdatePayload,
  CodeAnalysisReportPayload,
  CodeAnalysisStartPayload,
} from '@jkauto/core'
import {
  getCodeAnalysisReport,
  startCodeAnalysis,
} from '../services/analysis/analysis.service'
import { updateAnalysisArtifactContent } from '../services/autogen/autogen-db'

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

  ipcMain.handle(
    IpcChannels.CODE_ANALYSIS_ARTIFACT_UPDATE,
    (_, payload: CodeAnalysisArtifactUpdatePayload) => {
      updateAnalysisArtifactContent(
        payload.projectPath,
        payload.artifactId,
        payload.contentJson,
        payload.itemCount,
        payload.summary,
      )
    },
  )
}
