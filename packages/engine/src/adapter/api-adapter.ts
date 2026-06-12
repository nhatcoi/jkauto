import type { Profile, Step } from '@jkauto/core'
import { getKeyword } from '../keywords/registry'
import type { ApiSession } from '../keywords/types'
import type { EngineAdapter, ExecutionHelpers, AdapterStartOptions } from './types'

// HTTP/REST API adapter. No browser — pure Node fetch.
// Session is mutable: api keywords write lastResponse for downstream assertions.
export class ApiAdapter implements EngineAdapter<ApiSession> {
  readonly platform = 'api' as const

  async start(profile: Profile, _options: AdapterStartOptions): Promise<ApiSession> {
    return {
      baseUrl: profile.variables['BASE_URL'] ?? '',
      defaultHeaders: {},
      lastResponse: null,
    }
  }

  async execute(session: ApiSession, step: Step, helpers: ExecutionHelpers): Promise<void> {
    const keyword = getKeyword(step.keyword)
    if (!keyword) throw new Error(`Unknown keyword: ${step.keyword}`)
    const executor = keyword.executors.api
    if (!executor) throw new Error(`Keyword "${step.keyword}" not supported on api`)
    await executor({
      session,
      objectRef: step.objectRef,
      input: step.input,
      expected: step.expected,
      resolveLocator: helpers.resolveLocator,
      interpolate: helpers.interpolate,
    })
  }

  async stop(_session: ApiSession): Promise<void> {
    // no connection to close
  }
}
