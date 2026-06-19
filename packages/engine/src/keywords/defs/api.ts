import type { KeywordDef, ApiKeywordExecutor, ApiResponse } from '../types'

async function doFetch(url: string, method: string, headers: Record<string, string>, body?: string): Promise<ApiResponse> {
  const start = Date.now()
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60000) })
  const text = await res.text()
  const resHeaders: Record<string, string> = {}
  res.headers.forEach((v, k) => { resHeaders[k] = v })
  return { status: res.status, statusText: res.statusText, headers: resHeaders, body: text, durationMs: Date.now() - start }
}

const httpRequestFn: ApiKeywordExecutor = async ({ session, objectRef, input, interpolate }) => {
  const method = (objectRef || 'GET').toUpperCase()
  const url = interpolate(input)
  const fullUrl = url.startsWith('http') ? url : `${session.baseUrl}${url}`
  session.lastResponse = await doFetch(fullUrl, method, { ...session.defaultHeaders })
}

const httpRequestWithBodyFn: ApiKeywordExecutor = async ({ session, objectRef, input, expected, interpolate }) => {
  const method = (objectRef || 'POST').toUpperCase()
  const [url, ...bodyParts] = interpolate(input).split('\n')
  const body = bodyParts.join('\n') || interpolate(expected)
  const fullUrl = url.startsWith('http') ? url : `${session.baseUrl}${url}`
  session.lastResponse = await doFetch(fullUrl, method, { 'Content-Type': 'application/json', ...session.defaultHeaders }, body)
}

const setBaseUrlFn: ApiKeywordExecutor = async ({ session, input, interpolate }) => {
  session.baseUrl = interpolate(input)
}

const setHeaderFn: ApiKeywordExecutor = async ({ session, objectRef, input, interpolate }) => {
  session.defaultHeaders[interpolate(objectRef)] = interpolate(input)
}

const assertStatusFn: ApiKeywordExecutor = async ({ session, expected, interpolate }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  const exp = parseInt(interpolate(expected), 10)
  if (session.lastResponse.status !== exp) {
    throw new Error(`Expected status ${exp} but got ${session.lastResponse.status}`)
  }
}

const assertBodyContainsFn: ApiKeywordExecutor = async ({ session, expected, interpolate }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  const exp = interpolate(expected)
  if (!session.lastResponse.body.includes(exp)) {
    throw new Error(`Expected body to contain "${exp}"`)
  }
}

const assertJsonPathFn: ApiKeywordExecutor = async ({ session, objectRef, expected, interpolate }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  let json: unknown
  try { json = JSON.parse(session.lastResponse.body) } catch { throw new Error('Response body is not valid JSON') }
  const val = resolveJsonPath(json, interpolate(objectRef))
  const exp = interpolate(expected)
  if (String(val) !== exp) throw new Error(`Expected "${exp}" at path "${objectRef}" but got "${String(val)}"`)
}

function resolveJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]/).filter(Boolean)
  let val: unknown = obj
  for (const key of parts) {
    if (val == null || typeof val !== 'object') return undefined
    val = (val as Record<string, unknown>)[key]
  }
  return val
}

const extractBodyFn: ApiKeywordExecutor = async ({ session, objectRef, input, interpolate, setVariable }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  let json: unknown
  try { json = JSON.parse(session.lastResponse.body) } catch { throw new Error('Response body is not valid JSON') }
  const jsonPath = interpolate(objectRef) || '$'
  const varName = interpolate(input)
  if (!varName) throw new Error('extract-body: input must be variable name')
  const extracted = resolveJsonPath(json, jsonPath)
  const strVal = extracted == null ? '' : String(extracted)
  session.variables[varName] = strVal
  setVariable?.(varName, strVal)
}

const setAuthBearerFn: ApiKeywordExecutor = async ({ session, input, interpolate }) => {
  session.defaultHeaders['Authorization'] = `Bearer ${interpolate(input)}`
}

const setAuthBasicFn: ApiKeywordExecutor = async ({ session, objectRef, input, interpolate }) => {
  const user = interpolate(objectRef)
  const pass = interpolate(input)
  session.defaultHeaders['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`
}

const assertHeaderFn: ApiKeywordExecutor = async ({ session, objectRef, expected, interpolate }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  const name = interpolate(objectRef).toLowerCase()
  const exp = interpolate(expected)
  const actual = session.lastResponse.headers[name] ?? ''
  if (!actual.includes(exp)) {
    throw new Error(`Expected header "${name}" to contain "${exp}" but got "${actual}"`)
  }
}

const assertStatusRangeFn: ApiKeywordExecutor = async ({ session, input, interpolate }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  const range = interpolate(input)
  const [minStr, maxStr] = range.split('-')
  const min = parseInt(minStr, 10)
  const max = parseInt(maxStr ?? minStr, 10)
  const { status } = session.lastResponse
  if (status < min || status > max) {
    throw new Error(`Expected status in ${min}-${max} but got ${status}`)
  }
}

const assertResponseTimeFn: ApiKeywordExecutor = async ({ session, expected, interpolate }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  const maxMs = parseInt(interpolate(expected), 10)
  const { durationMs } = session.lastResponse
  if (durationMs > maxMs) {
    throw new Error(`Response took ${durationMs}ms — exceeded limit of ${maxMs}ms`)
  }
}

const setVariableFn: ApiKeywordExecutor = async ({ objectRef, input, interpolate, setVariable, session }) => {
  const key = interpolate(objectRef)
  const value = interpolate(input)
  session.variables[key] = value
  setVariable?.(key, value)
}

const logResponseFn: ApiKeywordExecutor = async ({ session }) => {
  if (!session.lastResponse) throw new Error('No response — run http-request first')
  // Logged via step message — just validate response exists
}

const saveToProfileFn: ApiKeywordExecutor = async ({ session, objectRef, input, expected, interpolate, persistVariable, persistApiConfig }) => {
  if (!persistVariable && !persistApiConfig) throw new Error('save-to-profile: no active profile to save to')

  // Batch mode: expected = JSON { type: 'variables'|'api-config', mappings: [{from, to?}][] }
  const trimmed = expected?.trim()
  if (trimmed?.startsWith('{')) {
    try {
      const config = JSON.parse(interpolate(expected)) as {
        type?: string
        mappings?: Array<{ from: string; to?: string }>
      }
      const mappings = config.mappings ?? []
      const isApiConfig = config.type === 'api-config'
      const persist = isApiConfig ? (persistApiConfig ?? persistVariable) : persistVariable
      if (!persist) throw new Error('save-to-profile: no active profile to save to')
      for (const m of mappings) {
        const varName = interpolate(m.from)
        if (!varName) continue
        const profileKey = m.to ? interpolate(m.to) : varName
        const value = session.variables[varName] ?? ''
        await persist(profileKey, value)
        session.variables[profileKey] = value
      }
      return
    } catch (e) {
      if ((e as Error).message.startsWith('save-to-profile:')) throw e
      // fall through to single mode
    }
  }

  // Single mode (backward compat)
  const varName = interpolate(objectRef)
  if (!varName) throw new Error('save-to-profile: objectRef must be the session variable name')
  const profileKey = interpolate(input) || varName
  const value = session.variables[varName]
  if (value === undefined) throw new Error(`save-to-profile: variable "${varName}" not found in session`)
  if (!persistVariable) throw new Error('save-to-profile: no active profile to save to')
  await persistVariable(profileKey, value)
  session.variables[profileKey] = value
}

export const apiKeywords: KeywordDef[] = [
  {
    name: 'http-request',
    label: 'HTTP Request',
    color: 'bg-blue-500',
    description: 'Send HTTP GET/DELETE request. objectRef=method (GET), input=URL',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'HTTP method (GET, DELETE…)', required: false },
      { name: 'input', description: 'URL path or full URL', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'GET',
    inputPlaceholder: '/api/users',
    executors: { api: httpRequestFn },
  },
  {
    name: 'http-request-body',
    label: 'HTTP Request (Body)',
    color: 'bg-blue-600',
    description: 'Send HTTP POST/PUT/PATCH request. objectRef=method, input=URL, expected=JSON body',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'HTTP method (POST, PUT, PATCH)', required: false },
      { name: 'input', description: 'URL path or full URL', required: true },
      { name: 'expected', description: 'Request body (JSON string)', required: false },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: true,
    objectPlaceholder: 'POST',
    inputPlaceholder: '/api/users',
    expectedPlaceholder: '{"name":"Alice"}',
    executors: { api: httpRequestWithBodyFn },
  },
  {
    name: 'set-base-url',
    label: 'Set Base URL',
    color: 'bg-gray-500',
    description: 'Set API base URL for subsequent requests',
    platforms: ['api'],
    params: [{ name: 'input', description: 'Base URL (e.g. https://api.example.com)', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'https://api.example.com',
    executors: { api: setBaseUrlFn },
  },
  {
    name: 'set-request-header',
    label: 'Set Header',
    color: 'bg-gray-600',
    description: 'Add default request header for subsequent requests',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'Header name', required: true },
      { name: 'input', description: 'Header value', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'Authorization',
    inputPlaceholder: 'Bearer {{token}}',
    executors: { api: setHeaderFn },
  },
  {
    name: 'assert-status-code',
    label: 'Assert Status Code',
    color: 'bg-amber-500',
    description: 'Assert last response HTTP status code',
    platforms: ['api'],
    params: [{ name: 'expected', description: 'Expected status code (e.g. 200)', required: true }],
    hasObject: false,
    hasInput: false,
    hasExpected: true,
    expectedPlaceholder: '200',
    executors: { api: assertStatusFn },
  },
  {
    name: 'assert-response-contains',
    label: 'Assert Response Contains',
    color: 'bg-amber-600',
    description: 'Assert last response body contains expected string',
    platforms: ['api'],
    params: [{ name: 'expected', description: 'Expected string in body', required: true }],
    hasObject: false,
    hasInput: false,
    hasExpected: true,
    expectedPlaceholder: 'success',
    executors: { api: assertBodyContainsFn },
  },
  {
    name: 'assert-json-path',
    label: 'Assert JSON Path',
    color: 'bg-amber-700',
    description: 'Assert JSON field value by dot-notation path. objectRef=path, expected=value',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'Dot-notation JSON path (e.g. data.id)', required: true },
      { name: 'expected', description: 'Expected value', required: true },
    ],
    hasObject: true,
    hasInput: false,
    hasExpected: true,
    objectPlaceholder: 'data.id',
    expectedPlaceholder: '42',
    executors: { api: assertJsonPathFn },
  },
  {
    name: 'extract-body',
    label: 'Extract Body',
    color: 'bg-violet-600',
    description: 'Extract JSON value from last response into a variable. objectRef=$.json.path, input=varName',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'JSON path (e.g. $.data.token)', required: true },
      { name: 'input', description: 'Variable name to store value', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: '$.data.token',
    inputPlaceholder: 'accessToken',
    executors: { api: extractBodyFn },
  },
  {
    name: 'set-auth-bearer',
    label: 'Set Auth Bearer',
    color: 'bg-indigo-600',
    description: 'Set Authorization: Bearer header for subsequent requests',
    platforms: ['api'],
    params: [{ name: 'input', description: 'Token value or variable (e.g. {{accessToken}})', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: '{{accessToken}}',
    executors: { api: setAuthBearerFn },
  },
  {
    name: 'set-auth-basic',
    label: 'Set Auth Basic',
    color: 'bg-indigo-700',
    description: 'Set Authorization: Basic header. objectRef=username, input=password',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'Username', required: true },
      { name: 'input', description: 'Password', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'admin',
    inputPlaceholder: 'password',
    executors: { api: setAuthBasicFn },
  },
  {
    name: 'assert-header',
    label: 'Assert Header',
    color: 'bg-amber-600',
    description: 'Assert response header contains expected value. objectRef=headerName, expected=value',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'Header name (case-insensitive)', required: true },
      { name: 'expected', description: 'Expected value (substring match)', required: true },
    ],
    hasObject: true,
    hasInput: false,
    hasExpected: true,
    objectPlaceholder: 'content-type',
    expectedPlaceholder: 'application/json',
    executors: { api: assertHeaderFn },
  },
  {
    name: 'assert-status-range',
    label: 'Assert Status Range',
    color: 'bg-amber-500',
    description: 'Assert response status code is within range. input=min-max (e.g. 200-299)',
    platforms: ['api'],
    params: [{ name: 'input', description: 'Status range e.g. 200-299', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: '200-299',
    executors: { api: assertStatusRangeFn },
  },
  {
    name: 'assert-response-time',
    label: 'Assert Response Time',
    color: 'bg-orange-600',
    description: 'Assert last response completed within time limit. expected=maxMs',
    platforms: ['api'],
    params: [{ name: 'expected', description: 'Max duration in ms', required: true }],
    hasObject: false,
    hasInput: false,
    hasExpected: true,
    expectedPlaceholder: '2000',
    executors: { api: assertResponseTimeFn },
  },
  {
    name: 'set-variable',
    label: 'Set Variable',
    color: 'bg-slate-500',
    description: 'Set a variable for use in later steps. objectRef=name, input=value',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'Variable name', required: true },
      { name: 'input', description: 'Value (supports {{varName}} interpolation)', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'myVar',
    inputPlaceholder: 'value',
    executors: { api: setVariableFn },
  },
  {
    name: 'log-response',
    label: 'Log Response',
    color: 'bg-slate-600',
    description: 'Assert response exists and log details (visible in run history)',
    platforms: ['api'],
    params: [],
    hasObject: false,
    hasInput: false,
    hasExpected: false,
    executors: { api: logResponseFn },
  },
  {
    name: 'save-to-profile',
    label: 'Save to Profile',
    color: 'bg-teal-600',
    description: 'Persist session variables into active profile. Batch mode: expected=JSON {type,mappings}. Single mode: objectRef=sessionVarName, input=profileKey',
    platforms: ['api'],
    params: [
      { name: 'objectRef', description: 'Session variable name (single mode)', required: false },
      { name: 'input', description: 'Profile variable key (single mode, defaults to objectRef)', required: false },
      { name: 'expected', description: 'Batch config JSON: {"type":"variables","mappings":[{"from":"accessToken"}]}', required: false },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: true,
    objectPlaceholder: 'accessToken',
    inputPlaceholder: 'ACCESS_TOKEN',
    executors: { api: saveToProfileFn },
  },
]
