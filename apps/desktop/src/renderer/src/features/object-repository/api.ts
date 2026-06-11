import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import type { ApiRequest, HttpResponse, HttpImportOpenApiResult } from '@jkauto/core'

export async function sendRequest(
  request: ApiRequest,
  profileVariables: Record<string, string> = {},
): Promise<HttpResponse> {
  return invoke<HttpResponse>(IpcChannels.HTTP_SEND_REQUEST, { request, profileVariables })
}

export async function importOpenApi(
  source: string,
  targetDir: string,
): Promise<HttpImportOpenApiResult> {
  return invoke<HttpImportOpenApiResult>(IpcChannels.HTTP_IMPORT_OPENAPI, { source, targetDir })
}

export async function loadRequest(filePath: string): Promise<ApiRequest> {
  const raw = await invoke<string>(IpcChannels.FS_READ_FILE, filePath)
  return JSON.parse(raw) as ApiRequest
}

export async function saveRequest(filePath: string, request: ApiRequest): Promise<void> {
  await invoke(IpcChannels.FS_WRITE_FILE, filePath, JSON.stringify(request, null, 2))
}
