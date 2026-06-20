import fs from 'node:fs'
import path from 'node:path'
import type { UIElement } from '../types'

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage'])
const ELEMENT_RE = /<(input|button|select|textarea|a|mat-[\w-]+)\b([^>]*)>/gi
const ATTR_RE = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
const INLINE_TEMPLATE_RE = /template\s*:\s*`([\s\S]*?)`/g

function parseTemplate(source: string, filePath: string, lineOffset = 0): UIElement[] {
  const elements: UIElement[] = []
  let match: RegExpExecArray | null
  ELEMENT_RE.lastIndex = 0
  while ((match = ELEMENT_RE.exec(source)) !== null) {
    const attrs: Record<string, string> = {}
    let attr: RegExpExecArray | null
    ATTR_RE.lastIndex = 0
    while ((attr = ATTR_RE.exec(match[2])) !== null) {
      attrs[attr[1]] = attr[2] ?? attr[3] ?? attr[4] ?? 'true'
    }
    const testId = attrs['data-testid'] ?? attrs['data-test-id']
    const name = testId ?? attrs.name ?? attrs.id ?? attrs['aria-label'] ?? attrs.placeholder
    if (!name && match[1].toLowerCase() !== 'button' && match[1].toLowerCase() !== 'a') continue
    elements.push({
      name: name ?? match[1],
      tag: match[1],
      type: attrs.type,
      testId,
      placeholder: attrs.placeholder,
      ariaLabel: attrs['aria-label'],
      label: attrs.title,
      sourceFile: filePath,
      line: lineOffset + source.slice(0, match.index).split('\n').length,
    })
  }
  return elements
}

export function walkAngularElements(root: string): UIElement[] {
  const elements: UIElement[] = []
  function walk(dir: string): void {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(full)
      } else if (entry.name.endsWith('.html')) {
        elements.push(...parseTemplate(fs.readFileSync(full, 'utf-8'), full))
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        const source = fs.readFileSync(full, 'utf-8')
        let match: RegExpExecArray | null
        INLINE_TEMPLATE_RE.lastIndex = 0
        while ((match = INLINE_TEMPLATE_RE.exec(source)) !== null) {
          const offset = source.slice(0, match.index).split('\n').length - 1
          elements.push(...parseTemplate(match[1], full, offset))
        }
      }
    }
  }
  walk(root)
  return elements
}
