import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from './tree-sitter-loader'
import type { TsNode } from './tree-sitter-loader'
import type { ApiEndpoint, CodeSymbol } from '../types'

const SKIP = new Set(['.git', 'target', 'node_modules'])

const METHOD_MAP: Record<string, ApiEndpoint['method']> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', route: 'GET',
}

// Regex fallback
const ACTIX_RE = /#\[(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']\s*\)\]/g
const AXUM_RE = /\.route\s*\(\s*["']([^"']+)["']\s*,\s*(get|post|put|patch|delete)/g
const ROCKET_RE = /#\[(get|post|put|patch|delete)\s*=\s*["']([^"']+)["']\]/g
const FN_RE = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[(<]/gm
const STRUCT_RE = /^(?:pub\s+)?struct\s+(\w+)/gm

function rustStringText(node: TsNode): string | null {
  // string_literal in Rust includes surrounding double quotes
  const t = node.text
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1)
  return t || null
}

function extractEndpointsAST(src: string, filePath: string): ApiEndpoint[] {
  const tree = parseFile('rust', src)
  if (!tree) return extractEndpointsRegex(src, filePath)

  const endpoints: ApiEndpoint[] = []

  for (const attrItem of tree.rootNode.descendantsOfType('attribute_item')) {
    const attr = attrItem.namedChild(0)
    if (!attr) continue

    const nameNode = attr.namedChild(0)
    const methodName = nameNode?.text ?? ''
    if (!METHOD_MAP[methodName]) continue

    // Actix / Rocket: #[get("/path")] or #[get = "/path"]
    const tokenTree = attr.descendantsOfType('token_tree')[0]
    if (tokenTree) {
      const strLit = tokenTree.descendantsOfType('string_literal')[0]
      if (strLit) {
        endpoints.push({ method: METHOD_MAP[methodName], path: rustStringText(strLit) ?? '', sourceFile: filePath })
        continue
      }
    }

    // Rocket attribute syntax: #[get = "/path"]
    const strLitDirect = attr.descendantsOfType('string_literal')[0]
    if (strLitDirect) {
      endpoints.push({ method: METHOD_MAP[methodName], path: rustStringText(strLitDirect) ?? '', sourceFile: filePath })
    }
  }

  // Axum .route("/path", get(handler))
  for (const call of tree.rootNode.descendantsOfType('call_expression')) {
    const fnNode = call.namedChild(0)
    // Method call: expr.route(...)
    if (fnNode?.type !== 'field_expression') continue
    const fieldNode = fnNode.childForFieldName('field')
    if (fieldNode?.text !== 'route') continue

    const args = call.namedChild(1)
    if (!args) continue

    const firstArg = args.namedChild(0)
    if (firstArg?.type !== 'string_literal') continue

    const routePath = rustStringText(firstArg)
    if (!routePath) continue

    // Second arg: get(handler) → method name
    const secondArg = args.namedChild(1)
    if (!secondArg) continue

    const methodCall = secondArg.namedChild(0)
    const httpMethod = methodCall?.type === 'identifier' ? methodCall.text : null
    if (httpMethod && METHOD_MAP[httpMethod]) {
      endpoints.push({ method: METHOD_MAP[httpMethod], path: routePath, sourceFile: filePath })
    }
  }

  return endpoints
}

function extractEndpointsRegex(src: string, filePath: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = []
  let m: RegExpExecArray | null

  ACTIX_RE.lastIndex = 0
  while ((m = ACTIX_RE.exec(src)) !== null) {
    endpoints.push({ method: METHOD_MAP[m[1]] ?? 'GET', path: m[2], sourceFile: filePath })
  }

  AXUM_RE.lastIndex = 0
  while ((m = AXUM_RE.exec(src)) !== null) {
    endpoints.push({ method: METHOD_MAP[m[2]] ?? 'GET', path: m[1], sourceFile: filePath })
  }

  ROCKET_RE.lastIndex = 0
  while ((m = ROCKET_RE.exec(src)) !== null) {
    endpoints.push({ method: METHOD_MAP[m[1]] ?? 'GET', path: m[2], sourceFile: filePath })
  }

  return endpoints
}

function extractSymbolsAST(src: string, filePath: string): CodeSymbol[] {
  const tree = parseFile('rust', src)
  const symbols: CodeSymbol[] = []

  if (!tree) {
    let m: RegExpExecArray | null
    FN_RE.lastIndex = 0
    while ((m = FN_RE.exec(src)) !== null) {
      symbols.push({ kind: 'function', name: m[1], file: filePath, line: src.slice(0, m.index).split('\n').length, exported: src.slice(m.index).startsWith('pub') })
    }
    STRUCT_RE.lastIndex = 0
    while ((m = STRUCT_RE.exec(src)) !== null) {
      symbols.push({ kind: 'class', name: m[1], file: filePath, line: src.slice(0, m.index).split('\n').length, exported: src.slice(m.index).startsWith('pub') })
    }
    return symbols
  }

  for (const fn of tree.rootNode.descendantsOfType('function_item')) {
    const nameNode = fn.childForFieldName('name')
    if (!nameNode) continue
    const vis = fn.childForFieldName('visibility_modifier')
    symbols.push({ kind: 'function', name: nameNode.text, file: filePath, line: fn.startPosition.row + 1, exported: !!vis })
  }

  for (const s of tree.rootNode.descendantsOfType('struct_item')) {
    const nameNode = s.childForFieldName('name')
    if (!nameNode) continue
    const vis = s.childForFieldName('visibility_modifier')
    symbols.push({ kind: 'class', name: nameNode.text, file: filePath, line: s.startPosition.row + 1, exported: !!vis })
  }

  return symbols
}

export function extractRustEndpoints(filePath: string): ApiEndpoint[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractEndpointsAST(src, filePath)
}

export function extractRustSymbols(filePath: string): CodeSymbol[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractSymbolsAST(src, filePath)
}

export function walkRust(dir: string): { endpoints: ApiEndpoint[]; symbols: CodeSymbol[] } {
  const endpoints: ApiEndpoint[] = []
  const symbols: CodeSymbol[] = []

  function walk(d: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(full)
      } else if (entry.name.endsWith('.rs') && !entry.name.endsWith('_test.rs')) {
        const src = fs.readFileSync(full, 'utf-8')
        endpoints.push(...extractEndpointsAST(src, full))
        symbols.push(...extractSymbolsAST(src, full))
      }
    }
  }

  walk(dir)
  return { endpoints, symbols }
}
