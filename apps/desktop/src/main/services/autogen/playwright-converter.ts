import { randomUUID } from 'node:crypto'

interface JKAutoStep {
  id: string
  keyword: string
  description: string
  objectRef: string
  input: string
  expected: string
  enabled: boolean
  continueOnFailure: boolean
  timeout: null
}

interface JKAutoTestCase {
  schemaVersion: 1
  id: string
  name: string
  description: string
  platform: 'web' | 'api'
  tags: string[]
  runner: 'playwright' | 'api'
  steps: JKAutoStep[]
  createdAt: string
  updatedAt: string
}

type PatternDef = {
  re: RegExp
  keyword: string
  build: (m: RegExpMatchArray) => Partial<JKAutoStep>
}

// Keyword names match engine registry exactly (packages/engine/src/keywords/defs/)
const PATTERNS: PatternDef[] = [
  // Navigation
  { re: /await page\.goto\(['"`](.+?)['"`]\)/, keyword: 'navigate-to', build: (m) => ({ input: m[1], objectRef: '' }) },
  // Click
  { re: /await page\.locator\(['"`](.+?)['"`]\)\.click\(\)/, keyword: 'click', build: (m) => ({ objectRef: m[1], input: '' }) },
  { re: /await page\.click\(['"`](.+?)['"`]\)/, keyword: 'click', build: (m) => ({ objectRef: m[1], input: '' }) },
  // Fill / type
  { re: /await page\.locator\(['"`](.+?)['"`]\)\.fill\(['"`](.+?)['"`]\)/, keyword: 'type-text', build: (m) => ({ objectRef: m[1], input: m[2] }) },
  { re: /await page\.fill\(['"`](.+?)['"`],\s*['"`](.+?)['"`]\)/, keyword: 'type-text', build: (m) => ({ objectRef: m[1], input: m[2] }) },
  { re: /await page\.type\(['"`](.+?)['"`],\s*['"`](.+?)['"`]\)/, keyword: 'type-text', build: (m) => ({ objectRef: m[1], input: m[2] }) },
  // Clear
  { re: /await page\.locator\(['"`](.+?)['"`]\)\.clear\(\)/, keyword: 'clear-text', build: (m) => ({ objectRef: m[1], input: '' }) },
  // Wait
  { re: /await page\.waitForSelector\(['"`](.+?)['"`]\)/, keyword: 'wait-for-element', build: (m) => ({ objectRef: m[1], input: '' }) },
  { re: /await page\.waitForURL\(['"`](.+?)['"`]\)/, keyword: 'assert-url', build: (m) => ({ expected: m[1], objectRef: '' }) },
  { re: /await page\.waitForTimeout\((\d+)\)/, keyword: 'wait', build: (m) => ({ input: m[1], objectRef: '' }) },
  // Interaction
  { re: /await page\.selectOption\(['"`](.+?)['"`],\s*['"`](.+?)['"`]\)/, keyword: 'select-option', build: (m) => ({ objectRef: m[1], input: m[2] }) },
  { re: /await page\.hover\(['"`](.+?)['"`]\)/, keyword: 'hover', build: (m) => ({ objectRef: m[1], input: '' }) },
  // Assertions — web
  { re: /await expect\(page\.locator\(['"`](.+?)['"`]\)\)\.toBeVisible\(\)/, keyword: 'assert-visible', build: (m) => ({ objectRef: m[1] }) },
  { re: /await expect\(page\.locator\(['"`](.+?)['"`]\)\)\.toBeHidden\(\)/, keyword: 'assert-hidden', build: (m) => ({ objectRef: m[1] }) },
  { re: /await expect\(page\.locator\(['"`](.+?)['"`]\)\)\.toHaveText\(['"`](.+?)['"`]\)/, keyword: 'assert-text', build: (m) => ({ objectRef: m[1], expected: m[2] }) },
  { re: /await expect\(page\.locator\(['"`](.+?)['"`]\)\)\.toContainText\(['"`](.+?)['"`]\)/, keyword: 'assert-text', build: (m) => ({ objectRef: m[1], expected: m[2] }) },
  { re: /await expect\(page\.locator\(['"`](.+?)['"`]\)\)\.toHaveValue\(['"`](.+?)['"`]\)/, keyword: 'assert-element-value', build: (m) => ({ objectRef: m[1], expected: m[2] }) },
  { re: /await expect\(page\)\.toHaveURL\(['"`](.+?)['"`]\)/, keyword: 'assert-url', build: (m) => ({ expected: m[1], objectRef: '' }) },
  { re: /await expect\(page\)\.toHaveURL\(expect\.stringContaining\(['"`](.+?)['"`]\)\)/, keyword: 'assert-url-contains', build: (m) => ({ expected: m[1], objectRef: '' }) },
  // API — http-request: objectRef=METHOD, input=URL, expected=body(optional)
  { re: /await (response\s*=\s*)?request\.(get|post|put|patch|delete)\(['"`](.+?)['"`]/, keyword: 'http-request', build: (m) => ({ objectRef: m[2].toUpperCase(), input: m[3] }) },
  // API — assertions
  { re: /await expect\(response\)\.toBeOK\(\)/, keyword: 'assert-status-code', build: () => ({ expected: '200', objectRef: '' }) },
  { re: /expect\(response\.status\(\)\)\.toBe\((\d+)\)/, keyword: 'assert-status-code', build: (m) => ({ expected: m[1], objectRef: '' }) },
  { re: /expect\(response\.status\(\)\)\.toEqual\((\d+)\)/, keyword: 'assert-status-code', build: (m) => ({ expected: m[1], objectRef: '' }) },
  { re: /await expect\(response\)\.toHaveStatus\((\d+)\)/, keyword: 'assert-status-code', build: (m) => ({ expected: m[1], objectRef: '' }) },
]

function humanDesc(keyword: string, objectRef: string, input: string, expected: string): string {
  switch (keyword) {
    case 'http-request': return `Send ${objectRef || 'GET'} ${input}`
    case 'assert-status-code': return `Response status = ${expected}`
    case 'assert-response-contains': return `Response body contains "${expected}"`
    case 'assert-json-path': return `${objectRef} = "${expected}"`
    case 'navigate-to': return `Navigate to ${input}`
    case 'click': return `Click "${objectRef}"`
    case 'type-text': return `Type "${input}" into "${objectRef}"`
    case 'clear-text': return `Clear "${objectRef}"`
    case 'hover': return `Hover "${objectRef}"`
    case 'select-option': return `Select "${input}" from "${objectRef}"`
    case 'press-key': return `Press key "${input}"`
    case 'scroll-to': return `Scroll to "${objectRef}"`
    case 'assert-visible': return `Assert "${objectRef}" is visible`
    case 'assert-hidden': return `Assert "${objectRef}" is hidden`
    case 'assert-text': return `Assert "${objectRef}" text = "${expected}"`
    case 'assert-element-value': return `Assert "${objectRef}" value = "${expected}"`
    case 'assert-url': return `Assert URL = "${expected}"`
    case 'assert-url-contains': return `Assert URL contains "${expected}"`
    case 'wait-for-element': return `Wait for element "${objectRef}"`
    case 'wait-for-visible': return `Wait for "${objectRef}" visible`
    case 'wait': return `Wait ${input}ms`
    case 'screenshot': return 'Take screenshot'
    default: return keyword
  }
}

function lineToStep(line: string, precedingComment?: string): JKAutoStep | null {
  const trimmed = line.trim()
  if (!trimmed.includes('await') && !trimmed.includes('expect(response.status')) return null

  for (const { re, keyword, build } of PATTERNS) {
    const m = trimmed.match(re)
    if (m) {
      const partial = build(m)
      const objectRef = partial.objectRef ?? ''
      const input = partial.input ?? ''
      const expected = partial.expected ?? ''
      // Prefer AI-generated comment; fall back to mechanical description
      const description = precedingComment || humanDesc(keyword, objectRef, input, expected)
      return {
        id: randomUUID(),
        keyword,
        description,
        objectRef,
        input,
        expected,
        enabled: true,
        continueOnFailure: false,
        timeout: null,
      }
    }
  }
  return null
}

function extractComment(line: string): string | undefined {
  const m = line.trim().match(/^\/\/\s*(.+)$/)
  return m ? m[1].trim() : undefined
}

function extractTestBlocks(code: string): Array<{ name: string; body: string }> {
  const blocks: Array<{ name: string; body: string }> = []
  // Match: test('name', async ({...}) => {body})
  // Use a simple brace-counting approach for nested braces
  const testStartRe = /test\(['"`](.*?)['"`],\s*async\s*\(\{[^}]*\}\)\s*=>\s*\{/g
  let m: RegExpExecArray | null

  while ((m = testStartRe.exec(code)) !== null) {
    const name = m[1]
    const bodyStart = m.index + m[0].length
    let depth = 1
    let pos = bodyStart
    while (pos < code.length && depth > 0) {
      if (code[pos] === '{') depth++
      else if (code[pos] === '}') depth--
      pos++
    }
    const body = code.slice(bodyStart, pos - 1)
    blocks.push({ name, body })
  }
  return blocks
}

export function playwrightToJKAuto(
  code: string,
  tags: string[] = [],
  platform: 'web' | 'api' = 'web',
): JKAutoTestCase[] {
  const now = new Date().toISOString()
  const runner = platform === 'api' ? 'api' : 'playwright'

  // Strip markdown fences
  const cleaned = code.replace(/^```(?:typescript|ts|javascript|js)?\n?/gm, '').replace(/```\s*$/gm, '').trim()

  const blocks = extractTestBlocks(cleaned)
  const results: JKAutoTestCase[] = []

  for (const { name, body } of blocks) {
    const steps: JKAutoStep[] = []
    let lastComment: string | undefined
    for (const line of body.split('\n')) {
      const comment = extractComment(line)
      if (comment) { lastComment = comment; continue }
      const step = lineToStep(line, lastComment)
      if (step) { steps.push(step); lastComment = undefined }
      else if (line.trim()) lastComment = undefined  // non-comment, non-step line resets
    }
    if (steps.length === 0) continue

    results.push({
      schemaVersion: 1,
      id: randomUUID(),
      name,
      description: `Generated: ${name}`,
      platform,
      tags,
      runner,
      steps,
      createdAt: now,
      updatedAt: now,
    })
  }

  // Fallback: treat entire code as one test if no test() blocks found
  if (results.length === 0) {
    const steps: JKAutoStep[] = []
    let lastComment: string | undefined
    for (const line of cleaned.split('\n')) {
      const comment = extractComment(line)
      if (comment) { lastComment = comment; continue }
      const step = lineToStep(line, lastComment)
      if (step) { steps.push(step); lastComment = undefined }
    }
    if (steps.length > 0) {
      results.push({
        schemaVersion: 1,
        id: randomUUID(),
        name: tags[0] ? `${tags[0]} test` : 'Generated Test',
        description: 'Auto-generated',
        platform,
        tags,
        runner,
        steps,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  return results
}
