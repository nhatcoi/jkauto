import type { Profile, Step } from '@jkauto/core'
import { getKeyword } from '../keywords/registry'
import type { ApiSession } from '../keywords/types'
import type { EngineAdapter, ExecutionHelpers, AdapterStartOptions } from './types'

// HTTP/REST API adapter. No browser — pure Node fetch.
// Session is mutable: api keywords write lastResponse for downstream assertions.
export class ApiAdapter implements EngineAdapter<ApiSession> {
  readonly platform = 'api' as const

  async start(profile: Profile, _options: AdapterStartOptions): Promise<ApiSession> {
    const vars = { ...profile.variables }
    const iv = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)

    const apiCfg = profile.api
    const baseUrl = iv(apiCfg?.baseUrl || '')
    const defaultHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(apiCfg?.defaultHeaders ?? {})) {
      defaultHeaders[k] = iv(v)
    }

    if (apiCfg?.auth) {
      const auth = apiCfg.auth
      if (auth.type === 'bearer' && auth.token) {
        defaultHeaders['Authorization'] = `Bearer ${iv(auth.token)}`
      } else if (auth.type === 'basic' && auth.username) {
        const b64 = Buffer.from(`${iv(auth.username)}:${iv(auth.password)}`).toString('base64')
        defaultHeaders['Authorization'] = `Basic ${b64}`
      } else if (auth.type === 'api-key' && auth.key && auth.value && auth.in === 'header') {
        defaultHeaders[iv(auth.key)] = iv(auth.value)
      }
    }

    return { baseUrl, defaultHeaders, lastResponse: null, variables: vars }
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
      setVariable: helpers.setVariable,
      persistVariable: helpers.persistVariable,
      persistApiConfig: helpers.persistApiConfig,
    })
  }

  async stop(_session: ApiSession): Promise<void> {
    // no connection to close
  }
}
