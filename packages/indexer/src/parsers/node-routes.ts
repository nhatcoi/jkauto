import fs from 'node:fs'
import path from 'node:path'
import type { ApiEndpoint, Framework } from '../types'

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '__tests__', 'test', 'tests', '.autotest',
])
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

// app.get('/x', ...) | router.post(`/y`, ...) | fastify.delete("/z", ...)
const ROUTE_CALL_RE =
  /\b(?:app|router|fastify|server|api|route[r]?)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi

// fastify.route({ method: 'GET', url: '/x' }) — method + url in any order
const FASTIFY_ROUTE_OBJ_RE =
  /\.route\s*\(\s*\{([\s\S]*?)\}\s*\)/gi

// NestJS: @Controller('base') ... @Get('sub')
const NEST_CONTROLLER_RE = /@Controller\s*\(\s*[`'"]([^`'"]*)[`'"]?\s*\)/
const NEST_METHOD_RE =
  /@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:[`'"]([^`'"]*)[`'"])?\s*\)/gi

function isBackendNode(framework?: Framework): boolean {
  return framework === 'express' || framework === 'fastify'
    || framework === 'koa' || framework === 'nestjs'
}

function joinPath(...parts: string[]): string {
  const joined = parts
    .map((p) => p.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return `/${joined}`
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function extractFromFile(file: string, framework: Framework): ApiEndpoint[] {
  let source: string
  try { source = fs.readFileSync(file, 'utf-8') } catch { return [] }
  const endpoints: ApiEndpoint[] = []
  const seen = new Set<string>()

  const push = (method: string, routePath: string, index: number) => {
    const m = method.toUpperCase() as ApiEndpoint['method']
    const key = `${m} ${routePath}`
    if (seen.has(key)) return
    seen.add(key)
    endpoints.push({ method: m, path: routePath, sourceFile: file, summary: undefined })
    void index
  }

  if (framework === 'nestjs') {
    const base = NEST_CONTROLLER_RE.exec(source)?.[1] ?? ''
    let m: RegExpExecArray | null
    NEST_METHOD_RE.lastIndex = 0
    while ((m = NEST_METHOD_RE.exec(source)) !== null) {
      push(m[1], joinPath(base, m[2] ?? ''), m.index)
    }
    return endpoints
  }

  // express / fastify / koa style verb calls
  let call: RegExpExecArray | null
  ROUTE_CALL_RE.lastIndex = 0
  while ((call = ROUTE_CALL_RE.exec(source)) !== null) {
    push(call[1], joinPath(call[2]), call.index)
  }

  // fastify.route({ method, url })
  let obj: RegExpExecArray | null
  FASTIFY_ROUTE_OBJ_RE.lastIndex = 0
  while ((obj = FASTIFY_ROUTE_OBJ_RE.exec(source)) !== null) {
    const body = obj[1]
    const url = /url\s*:\s*[`'"]([^`'"]+)[`'"]/i.exec(body)?.[1]
    if (!url) continue
    const methodMatch = /method\s*:\s*[`'"]([^`'"]+)[`'"]/i.exec(body)?.[1]
    const methods = methodMatch
      ? [methodMatch]
      : [...body.matchAll(/[`'"](GET|POST|PUT|PATCH|DELETE)[`'"]/gi)].map((x) => x[1])
    for (const method of methods) {
      if (HTTP_METHODS.includes(method.toLowerCase() as HttpMethod)) {
        push(method, joinPath(url), obj.index)
      }
    }
  }

  return endpoints
}

// Walk a module root and extract HTTP endpoints from Node backend source.
// Pure static fallback used when no OpenAPI spec is available.
export function walkNodeRoutes(repoPath: string, framework: Framework): ApiEndpoint[] {
  if (!isBackendNode(framework)) return []
  const endpoints: ApiEndpoint[] = []
  const seen = new Set<string>()

  const walk = (dir: string): void => {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full)
        continue
      }
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue
      if (/\.(test|spec|d)\.[tj]sx?$/.test(entry.name)) continue
      for (const ep of extractFromFile(full, framework)) {
        const key = `${ep.method} ${ep.path}`
        if (seen.has(key)) continue
        seen.add(key)
        endpoints.push(ep)
      }
    }
  }

  walk(repoPath)
  return endpoints
}
