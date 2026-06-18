import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from './tree-sitter-loader'
import type { TsNode } from './tree-sitter-loader'
import type { ApiEndpoint, CodeSymbol } from '../types'

const SKIP = new Set(['.git', 'vendor', 'testdata'])

const METHOD_MAP: Record<string, ApiEndpoint['method']> = {
  GET: 'GET', POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE',
  Handle: 'GET', HandleFunc: 'GET',
}

// Regex fallback
const HTTP_RE = /\.(GET|POST|PUT|PATCH|DELETE|Handle(?:Func)?)\s*\(\s*["'`]([^"'`]+)["'`]/g
const HANDLE_RE = /HandleFunc\s*\(\s*["'`]([^"'`]+)["'`]/g
const FUNC_RE = /^func\s+(\w+)\s*\(/gm

function goStringText(node: TsNode): string | null {
  // interpreted_string_literal: text includes surrounding quotes
  const t = node.text
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1)
  if (t.startsWith('`') && t.endsWith('`')) return t.slice(1, -1)
  return null
}

function extractEndpointsAST(src: string, filePath: string): ApiEndpoint[] {
  const tree = parseFile('go', src)
  if (!tree) return extractEndpointsRegex(src, filePath)

  const endpoints: ApiEndpoint[] = []

  for (const call of tree.rootNode.descendantsOfType('call_expression')) {
    const fnNode = call.namedChild(0)
    if (fnNode?.type !== 'selector_expression') continue

    const fieldNode = fnNode.childForFieldName('field')
    if (!fieldNode) continue

    const methodName = fieldNode.text
    if (!METHOD_MAP[methodName]) continue

    const argList = call.namedChild(1)
    if (!argList) continue

    const firstArg = argList.namedChild(0)
    if (!firstArg) continue

    let routePath: string | null = null
    if (firstArg.type === 'interpreted_string_literal' || firstArg.type === 'raw_string_literal') {
      routePath = goStringText(firstArg)
    }

    if (routePath) {
      endpoints.push({ method: METHOD_MAP[methodName] ?? 'GET', path: routePath, sourceFile: filePath })
    }
  }

  return endpoints
}

function extractEndpointsRegex(src: string, filePath: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = []
  let m: RegExpExecArray | null

  HTTP_RE.lastIndex = 0
  while ((m = HTTP_RE.exec(src)) !== null) {
    endpoints.push({ method: METHOD_MAP[m[1]] ?? 'GET', path: m[2], sourceFile: filePath })
  }

  HANDLE_RE.lastIndex = 0
  while ((m = HANDLE_RE.exec(src)) !== null) {
    endpoints.push({ method: 'GET', path: m[1], sourceFile: filePath })
  }

  return endpoints
}

function extractSymbolsAST(src: string, filePath: string): CodeSymbol[] {
  const tree = parseFile('go', src)
  const symbols: CodeSymbol[] = []

  if (!tree) {
    let m: RegExpExecArray | null
    FUNC_RE.lastIndex = 0
    while ((m = FUNC_RE.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length
      symbols.push({ kind: 'function', name: m[1], file: filePath, line, exported: /^[A-Z]/.test(m[1]) })
    }
    return symbols
  }

  for (const fn of tree.rootNode.descendantsOfType('function_declaration')) {
    const nameNode = fn.childForFieldName('name')
    if (!nameNode) continue
    symbols.push({
      kind: 'function',
      name: nameNode.text,
      file: filePath,
      line: fn.startPosition.row + 1,
      exported: /^[A-Z]/.test(nameNode.text),
    })
  }

  for (const fn of tree.rootNode.descendantsOfType('method_declaration')) {
    const nameNode = fn.childForFieldName('name')
    if (!nameNode) continue
    symbols.push({
      kind: 'function',
      name: nameNode.text,
      file: filePath,
      line: fn.startPosition.row + 1,
      exported: /^[A-Z]/.test(nameNode.text),
    })
  }

  return symbols
}

export function extractGoEndpoints(filePath: string): ApiEndpoint[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractEndpointsAST(src, filePath)
}

export function extractGoSymbols(filePath: string): CodeSymbol[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractSymbolsAST(src, filePath)
}

export function walkGo(dir: string): { endpoints: ApiEndpoint[]; symbols: CodeSymbol[] } {
  const endpoints: ApiEndpoint[] = []
  const symbols: CodeSymbol[] = []

  function walk(d: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(full)
      } else if (entry.name.endsWith('.go') && !entry.name.endsWith('_test.go')) {
        const src = fs.readFileSync(full, 'utf-8')
        endpoints.push(...extractEndpointsAST(src, full))
        symbols.push(...extractSymbolsAST(src, full))
      }
    }
  }

  walk(dir)
  return { endpoints, symbols }
}
