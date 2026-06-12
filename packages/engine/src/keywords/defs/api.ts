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
  const path = interpolate(objectRef).split('.')
  let val: unknown = json
  for (const key of path) {
    if (val == null || typeof val !== 'object') throw new Error(`Path "${objectRef}" not found`)
    val = (val as Record<string, unknown>)[key]
  }
  const exp = interpolate(expected)
  if (String(val) !== exp) throw new Error(`Expected "${exp}" at path "${objectRef}" but got "${String(val)}"`)
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
]
