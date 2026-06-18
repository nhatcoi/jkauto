import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import type { IndexProgress, DetectedStack, CodeMap } from './types'


export const autogenApi = {
  startIndex: (params: { repoUrl: string; projectPath: string; branch?: string }) =>
    invoke<{ ok: boolean; indexId: string; stack: DetectedStack; map: CodeMap }>(
      IpcChannels.AUTOGEN_START_INDEX,
      params
    ),

  onProgress: (cb: (p: IndexProgress) => void) =>
    window.api.on(IpcChannels.AUTOGEN_INDEX_PROGRESS, cb as (...args: unknown[]) => void),

  getCodeMap: (projectPath: string) =>
    invoke<{ indexId: string; repoUrl: string; framework: string; language: string; indexedAt: string; pages: unknown[]; elements: unknown[]; endpoints: unknown[] } | null>(
      IpcChannels.AUTOGEN_GET_CODE_MAP,
      { projectPath }
    ),

  generateTests: (params: {
    projectPath: string
    targetIds: string[]
    testTypes: string[]
    query?: string
  }) => invoke<{ ok: boolean }>(IpcChannels.AUTOGEN_GENERATE, params),

  onGenerateProgress: (cb: (data: { targetId: string; status: string; test?: unknown; chunk?: string }) => void) =>
    window.api.on(IpcChannels.AUTOGEN_GENERATE_PROGRESS, cb as (...args: unknown[]) => void),

  cancel: () => invoke<{ ok: boolean }>(IpcChannels.AUTOGEN_CANCEL),
}
