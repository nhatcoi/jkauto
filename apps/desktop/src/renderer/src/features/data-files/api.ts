import { IpcChannels } from '@jkauto/core'
import type { DataFileAiGenerateResult } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import type { DataFile } from './types'

export async function listDataFiles(projectPath: string) {
  return invoke<Array<{ name: string; path: string }>>(IpcChannels.DATA_FILE_LIST, { projectPath })
}

export async function readDataFile(filePath: string): Promise<DataFile> {
  return invoke<DataFile>(IpcChannels.DATA_FILE_READ, { filePath })
}

export async function writeDataFile(filePath: string, data: DataFile): Promise<void> {
  return invoke<void>(IpcChannels.DATA_FILE_WRITE, { filePath, data })
}

export async function createDataFile(projectPath: string, name: string): Promise<string> {
  return invoke<string>(IpcChannels.DATA_FILE_CREATE, { projectPath, name })
}

export async function aiGenerateDataFiles(
  projectPath: string,
  prompt?: string,
): Promise<DataFileAiGenerateResult> {
  return invoke<DataFileAiGenerateResult>(IpcChannels.DATA_FILE_AI_GENERATE, { projectPath, prompt })
}
