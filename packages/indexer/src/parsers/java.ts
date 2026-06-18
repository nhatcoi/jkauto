import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from './tree-sitter-loader'
import type { TsNode } from './tree-sitter-loader'
import type { ApiEndpoint, CodeSymbol } from '../types'

const SKIP = new Set(['.git', 'target', 'build', '.gradle', 'node_modules'])

const MAPPING_METHODS: Record<string, ApiEndpoint['method']> = {
  GetMapping: 'GET', PostMapping: 'POST', PutMapping: 'PUT',
  PatchMapping: 'PATCH', DeleteMapping: 'DELETE',
}

// Regex fallback
const MAPPING_RE = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*\(?(?:value\s*=\s*)?["']([^"']+)["']/g
const CLASS_RE = /(?:public|protected)?\s+class\s+(\w+)/g
const CONTROLLER_MAPPING_RE = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/

function stringFromNode(node: TsNode): string | null {
  // Java string_literal contains string_fragment
  const frag = node.descendantsOfType('string_fragment')[0]
  if (frag) return frag.text
  const t = node.text
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1)
  return null
}

function extractEndpointsAST(src: string, filePath: string): ApiEndpoint[] {
  const tree = parseFile('java', src)
  if (!tree) return extractEndpointsRegex(src, filePath)

  const endpoints: ApiEndpoint[] = []

  // Class-level @RequestMapping base path
  let basePath = ''
  for (const ann of tree.rootNode.descendantsOfType('annotation')) {
    const nameNode = ann.namedChild(0)
    if (nameNode?.text !== 'RequestMapping') continue
    // Check if directly on class (parent is class_declaration or modifiers)
    if (ann.parent?.type !== 'modifiers') continue
    const argList = ann.descendantsOfType('annotation_argument_list')[0]
    if (!argList) continue
    const str = argList.descendantsOfType('string_literal')[0]
    if (str) basePath = stringFromNode(str) ?? ''
  }

  // Method-level mapping annotations
  for (const ann of tree.rootNode.descendantsOfType('annotation')) {
    const nameNode = ann.namedChild(0)
    if (!nameNode) continue
    const annName = nameNode.text
    if (!MAPPING_METHODS[annName] && annName !== 'RequestMapping') continue

    const argList = ann.descendantsOfType('annotation_argument_list')[0]
    if (!argList) continue

    // @GetMapping("/path") — direct string
    const strLit = argList.descendantsOfType('string_literal')[0]
    if (!strLit) continue

    const routePath = stringFromNode(strLit) ?? ''
    const method = MAPPING_METHODS[annName] ?? 'GET'
    endpoints.push({
      method,
      path: (basePath + '/' + routePath).replace(/\/+/g, '/'),
      sourceFile: filePath,
    })
  }

  return endpoints
}

function extractEndpointsRegex(src: string, filePath: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = []
  const baseMatch = CONTROLLER_MAPPING_RE.exec(src)
  const basePath = baseMatch ? baseMatch[1] : ''

  let m: RegExpExecArray | null
  MAPPING_RE.lastIndex = 0
  while ((m = MAPPING_RE.exec(src)) !== null) {
    const annName = m[1]
    const routePath = m[2]
    const method = annName === 'RequestMapping' ? 'GET' : (MAPPING_METHODS[annName] ?? 'GET')
    endpoints.push({ method, path: (basePath + routePath).replace(/\/+/g, '/'), sourceFile: filePath })
  }
  return endpoints
}

function extractSymbolsAST(src: string, filePath: string): CodeSymbol[] {
  const tree = parseFile('java', src)
  const symbols: CodeSymbol[] = []

  if (!tree) {
    // Regex fallback
    let m: RegExpExecArray | null
    CLASS_RE.lastIndex = 0
    while ((m = CLASS_RE.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length
      symbols.push({ kind: 'class', name: m[1], file: filePath, line, exported: true })
    }
    return symbols
  }

  for (const cls of tree.rootNode.descendantsOfType('class_declaration')) {
    const nameNode = cls.childForFieldName('name')
    if (!nameNode) continue
    symbols.push({ kind: 'class', name: nameNode.text, file: filePath, line: cls.startPosition.row + 1, exported: true })
  }

  for (const method of tree.rootNode.descendantsOfType('method_declaration')) {
    const nameNode = method.childForFieldName('name')
    if (!nameNode) continue
    const isPublic = method.descendantsOfType('modifiers')[0]?.text.includes('public')
    if (isPublic) {
      symbols.push({ kind: 'function', name: nameNode.text, file: filePath, line: method.startPosition.row + 1, exported: true })
    }
  }

  return symbols
}

function isControllerFile(src: string): boolean {
  return src.includes('@Controller') || src.includes('@RestController') || src.includes('@RequestMapping')
}

export function extractJavaEndpoints(filePath: string): ApiEndpoint[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractEndpointsAST(src, filePath)
}

export function extractJavaSymbols(filePath: string): CodeSymbol[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  return extractSymbolsAST(src, filePath)
}

export function walkJava(dir: string): { endpoints: ApiEndpoint[]; symbols: CodeSymbol[] } {
  const endpoints: ApiEndpoint[] = []
  const symbols: CodeSymbol[] = []

  function walk(d: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(full)
      } else if (entry.name.endsWith('.java') || entry.name.endsWith('.kt')) {
        const src = fs.readFileSync(full, 'utf-8')
        if (isControllerFile(src)) endpoints.push(...extractEndpointsAST(src, full))
        symbols.push(...extractSymbolsAST(src, full))
      }
    }
  }

  walk(dir)
  return { endpoints, symbols }
}
