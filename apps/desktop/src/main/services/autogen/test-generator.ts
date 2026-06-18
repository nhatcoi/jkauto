import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { randomUUID } from 'node:crypto'
import { parse as yamlParse } from 'yaml'
import { TestCaseSchema } from '@jkauto/core'
import { getConfig } from '../agent/llm-client'
import type { ContextBundle } from '@jkauto/indexer'

const KEYWORDS = [
  'navigate-to(url)',
  'click(objectRef)',
  'type-text(objectRef, text)',
  'clear-text(objectRef)',
  'assert-text(objectRef, expected)',
  'assert-visible(objectRef)',
  'assert-not-visible(objectRef)',
  'assert-value(objectRef, expected)',
  'wait-for(objectRef)',
  'wait-for-url(url)',
  'select-option(objectRef, value)',
  'hover(objectRef)',
  'scroll-to(objectRef)',
  'press-key(key)',
  'upload-file(objectRef, filePath)',
  'screenshot(name)',
  'wait(ms)',
  'assert-element-count(objectRef, count)',
  'api-request(method, url, body)',
  'assert-response-status(status)',
  'assert-response-body(jsonPath, expected)',
]

function buildSystemPrompt(context: ContextBundle, testTypes: string[]): string {
  const pageList = context.pages.map((p) => `- ${p.route} (${p.componentName})`).join('\n')
  const elementList = context.elements
    .slice(0, 40)
    .map((e) => `- ${e.name}: tag=${e.tag}${e.testId ? ` testId="${e.testId}"` : ''}${e.type ? ` type=${e.type}` : ''}${e.placeholder ? ` placeholder="${e.placeholder}"` : ''}`)
    .join('\n')
  const endpointList = context.endpoints
    .slice(0, 30)
    .map((e) => `- ${e.method} ${e.path}${e.summary ? `: ${e.summary}` : ''}`)
    .join('\n')

  return `You are a test case generator for jkauto — a Katalon-style test automation IDE.

## Output Format
Return ONLY a YAML array of test case objects. No markdown fences, no explanation. Pure YAML starting with "- ".

Each test case MUST match this exact schema:
- schemaVersion: 1
  id: <uuid>
  name: <descriptive test name>
  description: <what this test verifies>
  tags:
    - <tag>
  runner: playwright
  steps:
    - id: <uuid>
      keyword: <keyword>
      description: <what this step does>
      objectRef: <element name or empty string>
      input: <value, url, or empty string>
      expected: <expected result or empty string>
      enabled: true
      continueOnFailure: false
      timeout: null
  createdAt: <ISO datetime>
  updatedAt: <ISO datetime>

## Available Keywords
${KEYWORDS.map((k) => `- ${k}`).join('\n')}

## Test Types to Generate
${testTypes.join(', ')}

## Application Pages
${pageList || 'No pages detected'}

## UI Elements
${elementList || 'No elements detected'}

## API Endpoints
${endpointList || 'No endpoints detected'}

## Rules
- objectRef: use the element name exactly as listed above
- input: use \${baseUrl} for base URL references
- For API tests: use api-request keyword, then assert-response-status, assert-response-body
- For E2E: navigate-to first, then interact with elements
- Generate realistic, complete test flows — not just single-step tests
- Cover happy path + at least one error/edge case per target
- Tags: use target name, test type (e2e/api/smoke/regression)
`
}

export interface GenerateTestsParams {
  context: ContextBundle
  targetIds: string[]
  testTypes: string[]
  configOverride?: { baseUrl?: string; apiKey?: string; model?: string }
  onChunk?: (targetId: string, chunk: string) => void
}

export interface GeneratedTestResult {
  targetId: string
  tests: unknown[]
  raw: string
  error?: string
}

export async function generateTestsForTargets(params: GenerateTestsParams): Promise<GeneratedTestResult[]> {
  const { context, targetIds, testTypes, configOverride, onChunk } = params
  const config = getConfig(configOverride)
  const provider = createOpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey })

  const results: GeneratedTestResult[] = []

  for (const targetId of targetIds) {
    const targetContext = buildTargetContext(context, targetId)
    const now = new Date().toISOString()

    const userPrompt = `Generate test cases for: ${targetId}

Focus context:
${JSON.stringify(targetContext, null, 2)}

Generate ${testTypes.length > 1 ? testTypes.join(' and ') : testTypes[0]} test case(s).
Output JSON array only.`

    let raw = ''
    try {
      const result = streamText({
        model: provider(config.model),
        system: buildSystemPrompt(context, testTypes),
        messages: [{ role: 'user', content: userPrompt }],
        maxOutputTokens: 4096,
      })

      for await (const chunk of result.textStream) {
        raw += chunk
        onChunk?.(targetId, chunk)
      }

      const tests = parseTestCasesFromRaw(raw, now)
      results.push({ targetId, tests, raw })
    } catch (e) {
      results.push({ targetId, tests: [], raw, error: String(e) })
    }
  }

  return results
}

function buildTargetContext(context: ContextBundle, targetId: string) {
  if (targetId.startsWith('page:')) {
    const route = targetId.slice(5)
    const page = context.pages.find((p) => p.route === route)
    const elements = context.elements.filter((e) =>
      e.sourceFile.includes(page?.componentName?.toLowerCase() ?? '') ||
      e.sourceFile.includes(route.replace(/\//g, '').toLowerCase())
    )
    return { page, elements: elements.slice(0, 20) }
  }

  if (targetId.startsWith('api:')) {
    const parts = targetId.split(':')
    const method = parts[1]
    const path = parts.slice(2).join(':')
    const endpoint = context.endpoints.find((e) => e.method === method && e.path === path)
    return { endpoint }
  }

  return { targetId }
}

function parseTestCasesFromRaw(raw: string, now: string): unknown[] {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:yaml)?\n?/gm, '').replace(/```$/gm, '').trim()

  let parsed: unknown[]
  try {
    const result = yamlParse(cleaned)
    if (Array.isArray(result)) {
      parsed = result
    } else if (result && typeof result === 'object') {
      parsed = [result]
    } else {
      return []
    }
  } catch {
    return []
  }

  // Validate + fix each test case
  return parsed
    .map((tc: any) => {
      if (!tc || typeof tc !== 'object') return null

      // Ensure required fields
      const fixed = {
        schemaVersion: 1,
        id: tc.id ?? randomUUID(),
        name: tc.name ?? 'Generated Test',
        description: tc.description ?? '',
        owner: '',
        tags: Array.isArray(tc.tags) ? tc.tags : [],
        runner: tc.runner ?? 'playwright',
        app: tc.app ?? { id: '', env: '', path: '' },
        config: tc.config ?? { timeoutMs: null, retry: 0, stepDelayMs: null },
        variables: tc.variables ?? {},
        stepDelayMs: null,
        steps: Array.isArray(tc.steps)
          ? tc.steps.map((s: any) => ({
              id: s.id ?? randomUUID(),
              name: s.name ?? '',
              keyword: s.keyword ?? '',
              description: s.description ?? '',
              objectRef: s.objectRef ?? '',
              input: s.input ?? '',
              expected: s.expected ?? '',
              enabled: s.enabled !== false,
              continueOnFailure: s.continueOnFailure ?? false,
              timeout: s.timeout ?? null,
            }))
          : [],
        createdAt: tc.createdAt ?? now,
        updatedAt: now,
      }

      const result = TestCaseSchema.safeParse(fixed)
      return result.success ? result.data : fixed
    })
    .filter(Boolean)
}
