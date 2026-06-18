import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from './tree-sitter-loader'
import type { TsNode } from './tree-sitter-loader'
import type { ApiEndpoint, CodeSymbol } from '../types'

const SKIP = new Set(['.git', '__pycache__', '.venv', 'venv', 'env', 'node_modules', 'migrations'])

const METHOD_MAP: Record<string, ApiEndpoint['method']> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE',
}

// Regex fallback
const FLASK_RE = /@(?:app|bp|blueprint|router)\.route\s*\(\s*["']([^"']+)["'](?:[^)]*methods\s*=\s*\[([^\]]+)\])?/g
const FASTAPI_RE = /@(?:app|router|api)\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g
const DJANGO_RE = /path\s*\(\s*["']([^"']+)["']/g
const DEF_RE = /^(?:async\s+)?def\s+(\w+)\s*\(/gm
const CLASS_RE_FALLBACK = /^class\s+(\w+)\s*[:(]/gm

function pyStringText(node: TsNode): string | null {
  // Python string node: may have string_content, string_start, string_end children
  const content = node.descendantsOfType('string_content')[0]
  if (content) return content.text
  // Strip quotes from raw text
  const t = node.text
  const stripped = t.replace(/^[frb]*["']{1,3}/, '').replace(/["']{1,3}$/, '')
  return stripped || null
}

function extractEndpointsAST(src: string, filePath: string): ApiEndpoint[] {
  const tree = parseFile('python', src)
  if (!tree) return extractEndpointsRegex(src, filePath)

  const endpoints: ApiEndpoint[] = []

  for (const dec of tree.rootNode.descendantsOfType('decorator')) {
    // decorator contains either an identifier or a call expression
    const call = dec.descendantsOfType('call')[0]
    if (!call) continue

    const fnNode = call.namedChild(0)
    if (!fnNode) continue

    // attr access: app.route, router.get, etc.
    let attrName = ''
    if (fnNode.type === 'attribute') {
      const attrIdent = fnNode.childForFieldName('attribute')
      attrName = attrIdent?.text ?? ''
    } else if (fnNode.type === 'identifier') {
      attrName = fnNode.text
    }

    if (!attrName) continue

    const argList = call.childForFieldName('arguments')
    if (!argList) continue

    const firstArg = argList.namedChild(0)
    if (!firstArg) continue

    const routePath = firstArg.type === 'string' ? (pyStringText(firstArg) ?? '') : ''
    if (!routePath) continue

    if (attrName === 'route') {
      // Flask: parse methods= keyword argument
      const methods = parseFlaskMethods(argList)
      for (const method of methods) {
        endpoints.push({ method, path: routePath, sourceFile: filePath })
      }
    } else if (METHOD_MAP[attrName]) {
      endpoints.push({ method: METHOD_MAP[attrName], path: routePath, sourceFile: filePath })
    } else if (attrName === 'api_view') {
      endpoints.push({ method: 'GET', path: routePath, sourceFile: filePath })
    }
  }

  // Django path() — appears as regular call, not decorator
  for (const call of tree.rootNode.descendantsOfType('call')) {
    const fnNode = call.namedChild(0)
    if (fnNode?.type !== 'identifier' || (fnNode.text !== 'path' && fnNode.text !== 're_path')) continue

    const argList = call.childForFieldName('arguments')
    if (!argList) continue

    const firstArg = argList.namedChild(0)
    if (!firstArg || firstArg.type !== 'string') continue

    const routePath = pyStringText(firstArg)
    if (routePath) {
      endpoints.push({ method: 'GET', path: '/' + routePath.replace(/<[^>]+>/g, ':param'), sourceFile: filePath })
    }
  }

  return endpoints
}

function parseFlaskMethods(argList: TsNode): ApiEndpoint['method'][] {
  // Find methods=[...] keyword argument
  for (const kw of argList.descendantsOfType('keyword_argument')) {
    const key = kw.namedChild(0)
    if (key?.text !== 'methods') continue
    const val = kw.namedChild(1)
    if (!val) continue
    const methods: ApiEndpoint['method'][] = []
    for (const str of val.descendantsOfType('string')) {
      const t = (pyStringText(str) ?? '').toUpperCase()
      const m = METHOD_MAP[t.toLowerCase()]
      if (m) methods.push(m)
    }
    return methods.length ? methods : ['GET']
  }
  return ['GET']
}

function extractEndpointsRegex(src: string, filePath: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = []
  let m: RegExpExecArray | null

  FLASK_RE.lastIndex = 0
  while ((m = FLASK_RE.exec(src)) !== null) {
    const methods = m[2]
      ? [...m[2].matchAll(/["'](\w+)["']/g)].map((x) => (METHOD_MAP[x[1].toLowerCase()] ?? null)).filter(Boolean) as ApiEndpoint['method'][]
      : ['GET' as ApiEndpoint['method']]
    for (const method of methods) endpoints.push({ method, path: m[1], sourceFile: filePath })
  }

  FASTAPI_RE.lastIndex = 0
  while ((m = FASTAPI_RE.exec(src)) !== null) {
    endpoints.push({ method: METHOD_MAP[m[1]] ?? 'GET', path: m[2], sourceFile: filePath })
  }

  DJANGO_RE.lastIndex = 0
  while ((m = DJANGO_RE.exec(src)) !== null) {
    endpoints.push({ method: 'GET', path: '/' + m[1].replace(/<[^>]+>/g, ':param'), sourceFile: filePath })
  }

  return endpoints
}

function extractSymbolsAST(src: string, filePath: string): CodeSymbol[] {
  const tree = parseFile('python', src)
  const symbols: CodeSymbol[] = []

  if (!tree) {
    let m: RegExpExecArray | null
    DEF_RE.lastIndex = 0
    while ((m = DEF_RE.exec(src)) !== null) {
      symbols.push({ kind: 'function', name: m[1], file: filePath, line: src.slice(0, m.index).split('\n').length, exported: !m[1].startsWith('_') })
    }
    CLASS_RE_FALLBACK.lastIndex = 0
    while ((m = CLASS_RE_FALLBACK.exec(src)) !== null) {
      symbols.push({ kind: 'class', name: m[1], file: filePath, line: src.slice(0, m.index).split('\n').length, exported: !m[1].startsWith('_') })
    }
    return symbols
  }

  for (const fn of tree.rootNode.descendantsOfType('function_definition')) {
    const nameNode = fn.childForFieldName('name')
    if (!nameNode) continue
    symbols.push({ kind: 'function', name: nameNode.text, file: filePath, line: fn.startPosition.row + 1, exported: !nameNode.text.startsWith('_') })
  }

  for (const cls of tree.rootNode.descendantsOfType('class_definition')) {
    const nameNode = cls.childForFieldName('name')
    if (!nameNode) continue
    symbols.push({ kind: 'class', name: nameNode.text, file: filePath, line: cls.startPosition.row + 1, exported: !nameNode.text.startsWith('_') })
  }

  return symbols
}

export function extractPythonEndpoints(filePath: string): ApiEndpoint[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractEndpointsAST(src, filePath)
}

export function extractPythonSymbols(filePath: string): CodeSymbol[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractSymbolsAST(src, filePath)
}

export function walkPython(dir: string): { endpoints: ApiEndpoint[]; symbols: CodeSymbol[] } {
  const endpoints: ApiEndpoint[] = []
  const symbols: CodeSymbol[] = []

  function walk(d: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(full)
      } else if (entry.name.endsWith('.py') && !entry.name.startsWith('test_')) {
        const src = fs.readFileSync(full, 'utf-8')
        endpoints.push(...extractEndpointsAST(src, full))
        symbols.push(...extractSymbolsAST(src, full))
      }
    }
  }

  walk(dir)
  return { endpoints, symbols }
}
