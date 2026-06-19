import { IpcChannels } from '@jkauto/core'
import type { EnvEntry, EnvWritePayload, EnvCreatePayload, Profile, ApiProfileConfig } from '@jkauto/core'
import { invoke } from '@/lib/utils'

export const listEnvs = (projectPath: string) =>
  invoke<EnvEntry[]>(IpcChannels.ENV_LIST, projectPath)

export const readEnv = (filePath: string) =>
  invoke<Record<string, string>>(IpcChannels.ENV_READ, filePath)

export const readProfile = (filePath: string) =>
  invoke<Profile>(IpcChannels.ENV_READ_PROFILE, filePath)

export const writeEnv = (filePath: string, variables: Record<string, string>, api?: ApiProfileConfig) =>
  invoke<void>(IpcChannels.ENV_WRITE, { filePath, variables, api } satisfies EnvWritePayload)

export const createEnv = (projectPath: string, name: string) =>
  invoke<EnvEntry>(IpcChannels.ENV_CREATE, { projectPath, name } satisfies EnvCreatePayload)

export const deleteEnv = (filePath: string) =>
  invoke<void>(IpcChannels.ENV_DELETE, filePath)
