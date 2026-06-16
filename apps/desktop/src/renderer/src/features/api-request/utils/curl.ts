import type { ApiRequest, HttpMethod } from '../types'

function tokenize(input: string): string[] {
  const joined = input.replace(/\\\s*\n/g, ' ')
  const tokens: string[] = []
  let i = 0

  while (i < joined.length) {
    while (i < joined.length && /\s/.test(joined[i])) i++
    if (i >= joined.length) break

    if (joined[i] === "'" && joined[i + 1] !== "'") {
      i++
      let s = ''
      while (i < joined.length && joined[i] !== "'") s += joined[i++]
      i++
      tokens.push(s)
    } else if (joined[i] === '$' && joined[i + 1] === "'") {
      i += 2
      let s = ''
      while (i < joined.length && joined[i] !== "'") {
        if (joined[i] === '\\' && i + 1 < joined.length) {
          i++
          switch (joined[i]) {
            case 'n': s += '\n'; break
            case 't': s += '\t'; break
            case 'r': s += '\r'; break
            default: s += joined[i]
          }
          i++
        } else {
          s += joined[i++]
        }
      }
      i++
      tokens.push(s)
    } else if (joined[i] === '"') {
      i++
      let s = ''
      while (i < joined.length && joined[i] !== '"') {
        if (joined[i] === '\\' && i + 1 < joined.length) {
          i++; s += joined[i++]
        } else {
          s += joined[i++]
        }
      }
      i++
      tokens.push(s)
    } else {
      let s = ''
      while (i < joined.length && !/\s/.test(joined[i])) s += joined[i++]
      tokens.push(s)
    }
  }

  return tokens
}

export function parseCurl(raw: string): Partial<ApiRequest> {
  const tokens = tokenize(raw.trim())
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') return {}

  let method: HttpMethod | undefined
  let url: string | undefined
  const headers: ApiRequest['headers'] = []
  let bodyContent: string | undefined
  let basicCreds: { username: string; password: string } | undefined

  let i = 1
  while (i < tokens.length) {
    const tok = tokens[i]

    if (tok === '-X' || tok === '--request') {
      method = tokens[++i] as HttpMethod; i++
    } else if (tok === '-H' || tok === '--header') {
      const hdr = tokens[++i]
      const colon = hdr.indexOf(':')
      if (colon > 0) headers.push({ key: hdr.slice(0, colon).trim(), value: hdr.slice(colon + 1).trim(), enabled: true })
      i++
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      bodyContent = tokens[++i]; i++
    } else if (tok === '-u' || tok === '--user') {
      const creds = tokens[++i]
      const colon = creds.indexOf(':')
      basicCreds = colon >= 0
        ? { username: creds.slice(0, colon), password: creds.slice(colon + 1) }
        : { username: creds, password: '' }
      i++
    } else if (tok === '-A' || tok === '--user-agent') {
      headers.push({ key: 'User-Agent', value: tokens[++i], enabled: true }); i++
    } else if (tok === '--url') {
      url = tokens[++i]; i++
    } else if (!tok.startsWith('-')) {
      url = tok; i++
    } else {
      i++
    }
  }

  if (!url) return {}

  let baseUrl = url
  const params: ApiRequest['params'] = []
  try {
    const u = new URL(url)
    baseUrl = u.origin + u.pathname
    u.searchParams.forEach((v, k) => params.push({ key: k, value: v, enabled: true }))
  } catch { /* keep raw url */ }

  if (!method) method = bodyContent ? 'POST' : 'GET'

  let body: ApiRequest['body'] = { type: 'none' }
  if (bodyContent) {
    const ct = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? ''
    if (ct.includes('application/x-www-form-urlencoded')) {
      const items = bodyContent.split('&').map((pair) => {
        const [k = '', v = ''] = pair.split('=').map((s) => { try { return decodeURIComponent(s) } catch { return s } })
        return { key: k, value: v, enabled: true }
      })
      body = { type: 'form-urlencoded', items }
    } else {
      try {
        JSON.parse(bodyContent)
        body = { type: 'raw-json', content: bodyContent }
      } catch {
        body = { type: 'raw-text', content: bodyContent }
      }
    }
  }

  let auth: ApiRequest['auth'] = { type: 'none' }
  if (basicCreds) {
    auth = { type: 'basic', ...basicCreds }
  } else {
    const authHdr = headers.find((h) => h.key.toLowerCase() === 'authorization')
    if (authHdr) {
      if (authHdr.value.startsWith('Bearer ')) {
        auth = { type: 'bearer', token: authHdr.value.slice(7) }
        headers.splice(headers.indexOf(authHdr), 1)
      } else if (authHdr.value.startsWith('Basic ')) {
        try {
          const decoded = atob(authHdr.value.slice(6))
          const colon = decoded.indexOf(':')
          auth = { type: 'basic', username: decoded.slice(0, colon), password: decoded.slice(colon + 1) }
          headers.splice(headers.indexOf(authHdr), 1)
        } catch { /* keep as header */ }
      }
    }
  }

  return { method, url: baseUrl, params, headers, body, auth }
}

export function toCurl(request: ApiRequest, vars: Record<string, string> = {}): string {
  const rv = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
  const sq = (s: string) => `'${s.replace(/'/g, "'\\''")}'`

  const parts: string[] = ['curl']

  if (request.method !== 'GET') parts.push(`-X ${request.method}`)

  let url = rv(request.url)
  const enabledParams = request.params.filter((p) => p.enabled && p.key)
  if (enabledParams.length > 0) {
    try {
      const u = new URL(url)
      enabledParams.forEach((p) => u.searchParams.set(rv(p.key), rv(p.value)))
      url = u.toString()
    } catch {
      const qs = enabledParams.map((p) => `${encodeURIComponent(rv(p.key))}=${encodeURIComponent(rv(p.value))}`).join('&')
      url = `${url}${url.includes('?') ? '&' : '?'}${qs}`
    }
  }
  parts.push(sq(url))

  request.headers.filter((h) => h.enabled && h.key).forEach((h) => {
    parts.push(`-H ${sq(`${rv(h.key)}: ${rv(h.value)}`)}`)
  })

  if (request.auth.type === 'bearer') {
    parts.push(`-H ${sq(`Authorization: Bearer ${rv(request.auth.token)}`)}`)
  } else if (request.auth.type === 'basic') {
    parts.push(`-u ${sq(`${rv(request.auth.username)}:${rv(request.auth.password)}`)}`)
  } else if (request.auth.type === 'api-key' && request.auth.in === 'header') {
    parts.push(`-H ${sq(`${rv(request.auth.key)}: ${rv(request.auth.value)}`)}`)
  }

  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  if (hasBody) {
    if (request.body.type === 'raw-json') {
      if (!request.headers.some((h) => h.enabled && h.key.toLowerCase() === 'content-type')) {
        parts.push(`-H 'Content-Type: application/json'`)
      }
      parts.push(`--data-raw ${sq(request.body.content)}`)
    } else if (request.body.type === 'raw-text') {
      parts.push(`--data-raw ${sq(request.body.content)}`)
    } else if (request.body.type === 'form-urlencoded') {
      if (!request.headers.some((h) => h.enabled && h.key.toLowerCase() === 'content-type')) {
        parts.push(`-H 'Content-Type: application/x-www-form-urlencoded'`)
      }
      const form = request.body.items
        .filter((it) => it.enabled && it.key)
        .map((it) => `${encodeURIComponent(rv(it.key))}=${encodeURIComponent(rv(it.value))}`)
        .join('&')
      parts.push(`--data-raw ${sq(form)}`)
    }
  }

  return parts.join(' \\\n  ')
}
