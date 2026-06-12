import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV3 } from 'openapi-types'
import { IpcChannels } from '@jkauto/core'
import type { ApiRequest, HttpSendRequestPayload, HttpImportOpenApiPayload, AuthConfig } from '@jkauto/core'
import { getSettings } from '../services/settings.service'
import { toExplorerKey, writeExplorerMetadata } from '../services/explorer-metadata'

function resolveVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

function getDefaultForType(type?: string): unknown {
  switch (type) {
    case 'string': return ''
    case 'number':
    case 'integer': return 0
    case 'boolean': return false
    case 'array': return []
    case 'object': return {}
    default: return null
  }
}

function extractBodyExample(schema: OpenAPIV3.SchemaObject): unknown {
  if (schema.example !== undefined) return schema.example
  if (schema.type === 'object' && schema.properties) {
    const obj: Record<string, unknown> = {}
    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as OpenAPIV3.SchemaObject
      obj[key] = p.example ?? p.default ?? getDefaultForType(p.type)
    }
    return obj
  }
  return undefined
}

function detectAuth(spec: OpenAPIV3.Document, op: OpenAPIV3.OperationObject): AuthConfig {
  const security = op.security ?? spec.security ?? []
  if (security.length === 0) return { type: 'none' }

  const schemes = (spec.components?.securitySchemes ?? {}) as Record<string, OpenAPIV3.SecuritySchemeObject>
  const firstKey = Object.keys(security[0])[0]
  if (!firstKey) return { type: 'none' }

  const scheme = schemes[firstKey]
  if (!scheme) return { type: 'none' }

  if (scheme.type === 'http' && scheme.scheme === 'bearer') return { type: 'bearer', token: '' }
  if (scheme.type === 'http' && scheme.scheme === 'basic') return { type: 'basic', username: '', password: '' }
  if (scheme.type === 'apiKey') {
    return { type: 'api-key', key: scheme.name ?? '', value: '', in: scheme.in === 'query' ? 'query' : 'header' }
  }
  return { type: 'none' }
}

function getOperationName(
  op: OpenAPIV3.OperationObject,
  method: string,
  apiPath: string,
  nameSource: NonNullable<HttpImportOpenApiPayload['nameSource']>,
): string {
  const methodPath = `${method.toUpperCase()} ${apiPath}`
  if (nameSource === 'operationId') return op.operationId ?? op.summary ?? methodPath
  if (nameSource === 'methodPath') return methodPath
  return op.summary ?? op.operationId ?? methodPath
}

export function registerHttpHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.HTTP_SEND_REQUEST, async (_, payload: HttpSendRequestPayload) => {
    const { request, profileVariables = {} } = payload
    const rv = (s: string) => resolveVars(s, profileVariables)

    let url = rv(request.url)
    const enabledParams = request.params.filter((p) => p.enabled && p.key)
    if (enabledParams.length > 0) {
      try {
        const urlObj = new URL(url)
        enabledParams.forEach((p) => urlObj.searchParams.set(rv(p.key), rv(p.value)))
        url = urlObj.toString()
      } catch {
        const qs = enabledParams.map((p) => `${encodeURIComponent(rv(p.key))}=${encodeURIComponent(rv(p.value))}`).join('&')
        url = `${url}${url.includes('?') ? '&' : '?'}${qs}`
      }
    }

    if (request.auth.type === 'api-key' && request.auth.in === 'query') {
      const sep = url.includes('?') ? '&' : '?'
      url = `${url}${sep}${encodeURIComponent(rv(request.auth.key))}=${encodeURIComponent(rv(request.auth.value))}`
    }

    const headers: Record<string, string> = {}
    request.headers.filter((h) => h.enabled && h.key).forEach((h) => { headers[rv(h.key)] = rv(h.value) })

    if (request.auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${rv(request.auth.token)}`
    } else if (request.auth.type === 'basic') {
      const creds = Buffer.from(`${rv(request.auth.username)}:${rv(request.auth.password)}`).toString('base64')
      headers['Authorization'] = `Basic ${creds}`
    } else if (request.auth.type === 'api-key' && request.auth.in === 'header') {
      headers[rv(request.auth.key)] = rv(request.auth.value)
    }

    let bodyInit: string | URLSearchParams | undefined
    if (request.body.type === 'raw-json') {
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
      bodyInit = rv(request.body.content)
    } else if (request.body.type === 'raw-text') {
      bodyInit = rv(request.body.content)
    } else if (request.body.type === 'form-urlencoded') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      const params = new URLSearchParams()
      request.body.items.filter((i) => i.enabled && i.key).forEach((i) => params.set(rv(i.key), rv(i.value)))
      bodyInit = params
    }

    const hasBody = !['GET', 'HEAD'].includes(request.method)
    const start = Date.now()

    let resp: Response
    try {
      resp = await fetch(url, { method: request.method, headers, body: hasBody ? bodyInit : undefined })
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err))
    }

    const durationMs = Date.now() - start
    const body = await resp.text()
    const respHeaders: Record<string, string> = {}
    resp.headers.forEach((v, k) => { respHeaders[k] = v })

    return { status: resp.status, statusText: resp.statusText, headers: respHeaders, body, durationMs, size: Buffer.byteLength(body, 'utf-8') }
  })

  ipcMain.handle(IpcChannels.HTTP_IMPORT_OPENAPI, async (_, payload: HttpImportOpenApiPayload) => {
    const { source, targetDir } = payload
    const settings = await getSettings()
    const nameSource = payload.nameSource ?? settings.explorer.openApiImportNameSource

    // For URLs, fetch manually and rewrite absolute self-refs (e.g. NestJS Swagger)
    // so SwaggerParser can resolve "$ref": "http://host/path#/..." as "#/..."
    let specInput: string | object = source
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const res = await fetch(source)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const text = await res.text()
      const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const normalized = text
        .replace(new RegExp(`"${escaped}#`, 'g'), '"#')
        .replace(new RegExp(`"${escaped}"`, 'g'), '"#"')
      specInput = JSON.parse(normalized)
    }

    const api = await SwaggerParser.dereference(specInput as Parameters<typeof SwaggerParser.dereference>[0]) as OpenAPIV3.Document

    const rawBaseUrl = api.servers?.[0]?.url
    const baseUrl = rawBaseUrl && rawBaseUrl !== '/' ? rawBaseUrl : '{{baseUrl}}'

    // Wrap in a key-named collection folder, keeping the readable title as metadata.
    const rawTitle = (api.info?.title ?? '').trim() || 'New API Tests'
    const collectionKey = toExplorerKey(rawTitle, 'api')
    let collectionDir = path.join(targetDir, collectionKey)
    let suffix = 2
    while (true) {
      try {
        await fs.access(collectionDir)
        collectionDir = path.join(targetDir, `${collectionKey}-${suffix}`)
        suffix++
      } catch {
        break
      }
    }
    await fs.mkdir(collectionDir, { recursive: true })
    await writeExplorerMetadata(collectionDir, rawTitle)

    const created: string[] = []

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

    for (const [apiPath, pathItem] of Object.entries(api.paths ?? {})) {
      const pi = pathItem as OpenAPIV3.PathItemObject

      for (const method of methods) {
        const op = pi[method] as OpenAPIV3.OperationObject | undefined
        if (!op) continue

        // Tag → subfolder inside collection
        const tag = op.tags?.[0] ?? 'default'
        const tagDir = path.join(collectionDir, toExplorerKey(tag, 'default'))
        await fs.mkdir(tagDir, { recursive: true })
        await writeExplorerMetadata(tagDir, tag)

        const name = getOperationName(op, method, apiPath, nameSource)
        const filePath = path.join(tagDir, `${method}-${toExplorerKey(apiPath, 'request')}.request.json`)

        // Merge path-level + operation-level parameters
        const allParams = [
          ...((pi.parameters ?? []) as OpenAPIV3.ParameterObject[]),
          ...((op.parameters ?? []) as OpenAPIV3.ParameterObject[]),
        ]

        const queryParams = allParams
          .filter((p) => p.in === 'query')
          .map((p) => {
            const schema = p.schema as OpenAPIV3.SchemaObject | undefined
            return { key: p.name, value: String(schema?.example ?? schema?.default ?? ''), enabled: !!p.required }
          })

        const headerParams = allParams
          .filter((p) => p.in === 'header')
          .map((p) => ({ key: p.name, value: '', enabled: false }))

        const pathParams = allParams.filter((p) => p.in === 'path')

        // Body
        let body: ApiRequest['body'] = { type: 'none' }
        const reqBody = op.requestBody as OpenAPIV3.RequestBodyObject | undefined
        if (reqBody?.content) {
          const jsonMedia = reqBody.content['application/json'] as OpenAPIV3.MediaTypeObject | undefined
          const formMedia = reqBody.content['application/x-www-form-urlencoded'] as OpenAPIV3.MediaTypeObject | undefined

          if (jsonMedia) {
            const schema = jsonMedia.schema as OpenAPIV3.SchemaObject | undefined
            const example = jsonMedia.example ?? (schema ? extractBodyExample(schema) : undefined)
            body = { type: 'raw-json', content: example !== undefined ? JSON.stringify(example, null, 2) : '' }
          } else if (formMedia) {
            const schema = formMedia.schema as OpenAPIV3.SchemaObject | undefined
            const items = schema?.properties
              ? Object.keys(schema.properties).map((key) => ({ key, value: '', enabled: true }))
              : []
            body = { type: 'form-urlencoded', items }
          }
        }

        const pathParamNote = pathParams.length > 0
          ? ` [Path params: ${pathParams.map((p) => `{${p.name}}`).join(', ')}]`
          : ''

        const request: ApiRequest = {
          schemaVersion: 1,
          id: randomUUID(),
          name,
          description: (op.description ?? '') + pathParamNote,
          method: method.toUpperCase() as ApiRequest['method'],
          url: `${baseUrl}${apiPath}`,
          params: queryParams,
          headers: headerParams,
          auth: detectAuth(api, op),
          body,
          assertions: [{ id: randomUUID(), target: 'status', op: 'eq', expected: '200' }],
        }

        await fs.writeFile(filePath, JSON.stringify(request, null, 2), 'utf-8')
        created.push(filePath)
      }
    }

    return { created }
  })
}
