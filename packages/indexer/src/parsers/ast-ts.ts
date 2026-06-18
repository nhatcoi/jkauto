import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from './tree-sitter-loader'
import type { TsNode } from './tree-sitter-loader'
import type { UIElement, CodeSymbol } from '../types'

type LangKey = 'tsx' | 'typescript' | 'javascript'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'out', 'coverage', '__tests__', 'test', 'tests'])
const LAYOUT_TAGS = new Set(['div', 'span', 'p', 'section', 'main', 'nav', 'header', 'footer', 'ul', 'li', 'table', 'tr', 'td', 'th'])

function langKey(ext: string): LangKey {
  if (ext === '.tsx' || ext === '.jsx') return 'tsx'
  return 'typescript'
}

function stringText(node: TsNode): string | null {
  // string node: contains string_fragment children
  const frag = node.descendantsOfType('string_fragment')[0]
  if (frag) return frag.text
  // fallback: strip surrounding quotes
  const t = node.text
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return null
}

function attrValue(valueNode: TsNode): string | null {
  if (!valueNode) return null

  if (valueNode.type === 'string') return stringText(valueNode)

  if (valueNode.type === 'jsx_expression') {
    const inner = valueNode.namedChild(0)
    if (!inner) return null
    if (inner.type === 'string') return stringText(inner)
    if (inner.type === 'template_string') {
      const parts: string[] = []
      for (const child of inner.children) {
        if (child.type === 'string_fragment') parts.push(child.text)
        else if (child.type === 'template_substitution') parts.push('*')
      }
      return parts.join('') || '[dynamic]'
    }
    return '[dynamic]'
  }

  return null
}

function extractAttrs(el: TsNode): Record<string, string | null> {
  const attrs: Record<string, string | null> = {}
  for (const attr of el.descendantsOfType('jsx_attribute')) {
    // Only direct children attributes (not nested JSX)
    if (attr.parent?.parent !== el && attr.parent?.parent?.parent !== el) continue
    const nameNode = attr.namedChild(0)
    if (!nameNode) continue
    const val = attr.namedChild(1)
    attrs[nameNode.text] = val ? attrValue(val) : 'true'
  }
  return attrs
}

function jsxTagName(el: TsNode): string {
  const nameNode = el.namedChild(0)
  return nameNode?.text ?? 'unknown'
}

export function extractElementsAST(filePath: string): UIElement[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  const ext = path.extname(filePath)
  const tree = parseFile(langKey(ext), src)
  if (!tree) return []

  const elements: UIElement[] = []
  const elNodes = [
    ...tree.rootNode.descendantsOfType('jsx_opening_element'),
    ...tree.rootNode.descendantsOfType('jsx_self_closing_element'),
  ]

  for (const el of elNodes) {
    const tag = jsxTagName(el)
    const attrs = extractAttrs(el)

    const testId = attrs['data-testid'] ?? attrs['data-test-id'] ?? undefined
    const ariaLabel = attrs['aria-label'] ?? undefined
    const nameAttr = attrs['name'] ?? undefined
    const idAttr = attrs['id'] ?? undefined

    if (!testId && !nameAttr && !idAttr && !ariaLabel) continue
    if (LAYOUT_TAGS.has(tag) && !testId) continue

    elements.push({
      name: String(testId ?? nameAttr ?? idAttr ?? ariaLabel ?? tag),
      tag,
      type: tag === 'input' ? (attrs['type'] ?? undefined) : undefined,
      testId: testId ?? undefined,
      label: undefined,
      placeholder: attrs['placeholder'] ?? undefined,
      ariaLabel: ariaLabel ?? undefined,
      sourceFile: filePath,
      line: el.startPosition.row + 1,
    })
  }

  return elements
}

export function extractSymbolsAST(filePath: string): CodeSymbol[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  const ext = path.extname(filePath)
  const tree = parseFile(langKey(ext), src)
  if (!tree) return []

  const symbols: CodeSymbol[] = []

  for (const fn of tree.rootNode.descendantsOfType('function_declaration')) {
    const nameNode = fn.childForFieldName('name')
    if (!nameNode) continue
    const name = nameNode.text
    const exported = fn.parent?.type === 'export_statement'
    const kind = /^[A-Z]/.test(name) ? 'component' : 'function'
    symbols.push({ kind, name, file: filePath, line: fn.startPosition.row + 1, exported })
  }

  for (const cls of tree.rootNode.descendantsOfType('class_declaration')) {
    const nameNode = cls.childForFieldName('name')
    if (!nameNode) continue
    const exported = cls.parent?.type === 'export_statement'
    symbols.push({ kind: 'class', name: nameNode.text, file: filePath, line: cls.startPosition.row + 1, exported })
  }

  return symbols
}

export function walkAndExtractAST(dir: string, exts = ['.tsx', '.jsx', '.ts', '.js']): { elements: UIElement[]; symbols: CodeSymbol[] } {
  const elements: UIElement[] = []
  const symbols: CodeSymbol[] = []

  function walk(d: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full)
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        if (/\.(spec|test)\.(tsx?|jsx?)$/.test(entry.name)) continue
        elements.push(...extractElementsAST(full))
        symbols.push(...extractSymbolsAST(full))
      }
    }
  }

  walk(dir)
  return { elements, symbols }
}
