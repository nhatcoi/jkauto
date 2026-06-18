import fs from 'node:fs'
import path from 'node:path'
import type { UIElement } from '../types'

const TESTID_RE = /data-testid=["'`]([^"'`]+)["'`]/g
const INPUT_RE = /<input([^>]+)>/g
const ATTR_RE = (name: string) => new RegExp(name + '=["\'`]([^"\'`]+)["\'`]')

export function extractElements(filePath: string): UIElement[] {
  const src = fs.readFileSync(filePath, 'utf-8')
  const elements: UIElement[] = []
  const lines = src.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // data-testid attributes
    let m: RegExpExecArray | null
    TESTID_RE.lastIndex = 0
    while ((m = TESTID_RE.exec(line)) !== null) {
      elements.push({
        name: m[1],
        tag: 'unknown',
        testId: m[1],
        sourceFile: filePath,
        line: i + 1,
      })
    }

    // <input> fields
    INPUT_RE.lastIndex = 0
    while ((m = INPUT_RE.exec(line)) !== null) {
      const attrs = m[1]
      const nameMatch = ATTR_RE('name').exec(attrs)
      const typeMatch = ATTR_RE('type').exec(attrs)
      const testIdMatch = ATTR_RE('data-testid').exec(attrs)
      const placeholderMatch = ATTR_RE('placeholder').exec(attrs)

      if (nameMatch || testIdMatch) {
        elements.push({
          name: nameMatch?.[1] ?? testIdMatch?.[1] ?? 'input',
          tag: 'input',
          type: typeMatch?.[1],
          testId: testIdMatch?.[1],
          placeholder: placeholderMatch?.[1],
          sourceFile: filePath,
          line: i + 1,
        })
      }
    }
  }

  return elements
}

export function walkAndExtract(dir: string, exts = ['.tsx', '.jsx', '.vue']): UIElement[] {
  const results: UIElement[] = []

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', '.next', 'build'].includes(entry.name)) walk(full)
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        results.push(...extractElements(full))
      }
    }
  }

  walk(dir)
  return results
}
