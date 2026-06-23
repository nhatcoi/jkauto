import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import fs from 'node:fs/promises'
import path from 'node:path'
import { stringify as yamlStringify } from 'yaml'
import { getConfig } from '../agent/llm-client'
import { playwrightToJKAuto } from './playwright-converter'
import type { CodeAnalysisArtifact, TestgenGroup, TestgenProgress, TestgenSavedResult } from '@jkauto/core'

// ---------------------------------------------------------------------------
// Project profile vars
// ---------------------------------------------------------------------------

interface ProjectVars {
  baseUrl: string
  [key: string]: string
}

export async function readProjectVars(projectPath: string): Promise<ProjectVars> {
  const defaults: ProjectVars = { baseUrl: 'http://localhost:3000' }
  try {
    const raw = await fs.readFile(
      path.join(projectPath, 'profiles', 'default.env.json'),
      'utf-8',
    )
    const profile = JSON.parse(raw) as { variables?: Record<string, string> }
    return { ...defaults, ...(profile.variables ?? {}) }
  } catch {
    return defaults
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert test engineer specializing in API and E2E testing.
Generate Playwright TypeScript tests — ONLY test() blocks, NO import statements.
Each test must be complete and standalone.

CRITICAL: Before EVERY await statement, write a single-line comment describing what that step does in plain English.
The comment becomes the step description in the test runner UI.

### API tests example
test('Register with valid data returns 201 and user object', async ({ request }) => {
  // Send POST request to register a new user with valid credentials
  const response = await request.post('http://localhost:3000/auth/register', {
    data: { username: 'alice', email: 'alice@example.com', password: 'Password123' }
  })
  // Assert registration was successful
  await expect(response).toBeOK()
})

test('Register with missing email returns 422', async ({ request }) => {
  // Send POST request without email field
  const response = await request.post('http://localhost:3000/auth/register', {
    data: { username: 'alice', password: 'Password123' }
  })
  // Assert validation error response
  expect(response.status()).toBe(422)
})

### Web/UI tests example
test('Login page shows error for wrong password', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:3000/login')
  // Enter email address
  await page.fill('#email', 'user@example.com')
  // Enter incorrect password
  await page.fill('#password', 'wrongpass')
  // Click the submit button
  await page.click('button[type=submit]')
  // Assert error message is visible
  await expect(page.locator('.error-message')).toBeVisible()
})

Rules:
- Use baseUrl from the project config in each prompt (NOT localhost:3000 unless that is the baseUrl)
- Use authToken in Authorization header for authenticated endpoints when provided
- Use realistic values from seed/sample data
- Cover happy path + at least one error case per group
- POST/PUT/PATCH must include JSON data payload
- Test name should clearly describe scenario and expected result`

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

type EndpointItem = { method: string; path: string; summary?: string }

function buildApiContext(vars: ProjectVars): string {
  const lines = [`baseUrl: ${vars.baseUrl}`]
  if (vars.authToken) lines.push(`authToken: ${vars.authToken}  ← use in Authorization: Bearer <token>`)
  for (const [k, v] of Object.entries(vars)) {
    if (k !== 'baseUrl' && k !== 'authToken') lines.push(`${k}: ${v}`)
  }
  return lines.join('\n')
}

function buildAuthNote(vars: ProjectVars): string {
  if (!vars.authToken) return ''
  return `\n- Add header: { headers: { Authorization: 'Bearer ${vars.authToken}' } } for authenticated endpoints`
}

function endpointGroupPrompt(items: EndpointItem[], seeds: unknown[], vars: ProjectVars): string {
  const list = items.map((e) => `  ${e.method} ${e.path}${e.summary ? ` — ${e.summary}` : ''}`).join('\n')
  const seedInfo = seeds.length > 0
    ? `\nSeed / sample data (use as realistic test values):\n${JSON.stringify(seeds.slice(0, 5), null, 2)}`
    : ''
  return `Generate Playwright API tests for these endpoints:
${list}

Project config:
${buildApiContext(vars)}
${seedInfo}

Requirements:
- One test() per scenario (happy path + error case per endpoint)
- Use request fixture: test('...', async ({ request }) => {...})
- Full URL = baseUrl + path (e.g. "${vars.baseUrl}/users")
- POST/PUT/PATCH: include { data: {...} } with realistic payload from seed data
- Error cases: 401 Unauthorized or 422 Unprocessable Entity${buildAuthNote(vars)}
- Write a comment before EVERY await line describing what that step does`
}

function entityGroupPrompt(entityName: string, seeds: unknown[], vars: ProjectVars): string {
  const seedInfo = seeds.length > 0
    ? `\nSample data (use for realistic CRUD payloads):\n${JSON.stringify(seeds.slice(0, 3), null, 2)}`
    : ''
  return `Generate Playwright API tests for CRUD operations on "${entityName}".

Project config:
${buildApiContext(vars)}
${seedInfo}

Requirements:
- Separate test() for: Create, List (GET all), Get by ID, Update, Delete
- Use request fixture for all
- Infer API paths from entity name (e.g. /api/${entityName.toLowerCase()}s or /${entityName.toLowerCase()}s)
- Use seed data for realistic payloads
- Include one validation error test (missing required field → 422)${buildAuthNote(vars)}
- Write a comment before EVERY await line describing what that step does`
}

function pageRouteGroupPrompt(routes: Array<{ route: string; componentName?: string }>, vars: ProjectVars): string {
  const list = routes.map((r) => `  ${r.route}${r.componentName ? ` (${r.componentName})` : ''}`).join('\n')
  return `Generate Playwright E2E tests for these UI pages:
${list}

Project config:
${buildApiContext(vars)}

Requirements:
- Use page fixture: test('...', async ({ page }) => {...})
- Navigate to page, verify key elements visible
- Test user interactions (forms, buttons, navigation)
- Use CSS/role selectors (prefer data-testid when guessable from component name)
- Write a comment before EVERY await line describing what that step does`
}

// ---------------------------------------------------------------------------
// Group building from analysis artifacts
// ---------------------------------------------------------------------------

type RawGroup = TestgenGroup & { items: unknown[]; platform: 'web' | 'api' | 'mobile' | 'desktop' }

export function buildGroupsFromArtifacts(artifacts: CodeAnalysisArtifact[]): RawGroup[] {
  const groups: RawGroup[] = []

  const routeArtifact = artifacts.find((a) => a.type === 'route-catalog')
  if (routeArtifact) {
    try {
      const data = JSON.parse(routeArtifact.contentJson) as {
        endpoints?: EndpointItem[]
        pages?: Array<{ route: string; componentName?: string }>
      }

      // API endpoints → grouped by first path segment
      const endpoints = data.endpoints ?? []
      const prefixMap = new Map<string, EndpointItem[]>()
      for (const ep of endpoints) {
        const prefix = ep.path.split('/').filter(Boolean)[0] ?? 'root'
        const key = `api-${prefix}`
        if (!prefixMap.has(key)) prefixMap.set(key, [])
        prefixMap.get(key)!.push(ep)
      }
      for (const [key, items] of prefixMap) {
        const prefix = key.slice(4)
        groups.push({
          id: key,
          label: `/${prefix} API (${items.length})`,
          type: 'endpoints',
          count: items.length,
          items,
          platform: 'api',
        })
      }

      // UI pages → one group
      const pages = data.pages ?? []
      if (pages.length > 0) {
        groups.push({
          id: 'ui-pages',
          label: `UI Pages (${pages.length})`,
          type: 'endpoints',
          count: pages.length,
          items: pages,
          platform: 'web',
        })
      }
    } catch { /* ignore */ }
  }

  const entityArtifact = artifacts.find((a) => a.type === 'entity-catalog')
  if (entityArtifact) {
    try {
      const entities = JSON.parse(entityArtifact.contentJson) as Array<{ name: string }>
      for (const entity of entities) {
        const id = `entity-${entity.name.toLowerCase()}`
        groups.push({
          id,
          label: `${entity.name} CRUD`,
          type: 'entity',
          count: 5,
          items: [entity],
          platform: 'api',
        })
      }
    } catch { /* ignore */ }
  }

  return groups
}

// ---------------------------------------------------------------------------
// File saving
// ---------------------------------------------------------------------------

async function saveFiles(
  projectPath: string,
  groupId: string,
  playwrightCode: string,
  jkautoTests: unknown[],
): Promise<{ playwright: string; jkauto: string[] }> {
  const genDir = path.join(projectPath, 'test-cases', 'generated')
  await fs.mkdir(genDir, { recursive: true })

  const safeName = groupId.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)

  const playwrightPath = path.join(genDir, `${safeName}.spec.ts`)
  const header = `import { test, expect } from '@playwright/test'\n\n`
  await fs.writeFile(playwrightPath, header + playwrightCode, 'utf-8')

  const jkautoPaths: string[] = []
  for (const [i, tc] of (jkautoTests as Array<{ name?: string }>).entries()) {
    const tcName = (tc.name ?? `${safeName}-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
    const tcPath = path.join(genDir, `${tcName}.test.yaml`)
    await fs.writeFile(tcPath, yamlStringify(tc), 'utf-8')
    jkautoPaths.push(tcPath)
  }

  return { playwright: playwrightPath, jkauto: jkautoPaths }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateGroup(
  projectPath: string,
  group: RawGroup,
  seeds: unknown[],
  configOverride?: { baseUrl?: string; apiKey?: string; model?: string },
  varsOverride?: Record<string, string>,
  onProgress?: (p: TestgenProgress) => void,
): Promise<TestgenSavedResult> {
  const config = getConfig(configOverride)
  const provider = createOpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey })

  const profileVars = await readProjectVars(projectPath)
  // User-supplied overrides take priority over profile defaults
  const vars: ProjectVars = { ...profileVars, ...varsOverride }

  onProgress?.({ groupId: group.id, status: 'generating', message: `Generating ${group.label}...` })

  let prompt: string
  if (group.platform === 'web') {
    const pages = group.items as Array<{ route: string; componentName?: string }>
    prompt = pageRouteGroupPrompt(pages, vars)
  } else if (group.type === 'entity') {
    prompt = entityGroupPrompt((group.items[0] as { name: string }).name, seeds, vars)
  } else {
    prompt = endpointGroupPrompt(group.items as EndpointItem[], seeds, vars)
  }

  let playwrightCode = ''
  try {
    const result = streamText({
      model: provider(config.model),
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 4000,
    })

    for await (const chunk of result.textStream) {
      playwrightCode += chunk
      onProgress?.({ groupId: group.id, status: 'generating', chunk })
    }

    // Strip markdown fences if model wrapped output
    playwrightCode = playwrightCode
      .replace(/^```(?:typescript|ts|javascript|js)?\n?/gm, '')
      .replace(/```\s*$/gm, '')
      .trim()

    onProgress?.({ groupId: group.id, status: 'converting' })
    const platform = group.platform === 'web' ? 'web' : 'api'
    const jkautoTests = playwrightToJKAuto(playwrightCode, [group.id, group.type], platform)

    onProgress?.({ groupId: group.id, status: 'saving' })
    const savedPaths = await saveFiles(projectPath, group.id, playwrightCode, jkautoTests)

    onProgress?.({ groupId: group.id, status: 'done', message: `Saved ${jkautoTests.length} test(s)` })
    return { groupId: group.id, savedPaths }
  } catch (e) {
    const error = String(e)
    onProgress?.({ groupId: group.id, status: 'error', message: error })
    return { groupId: group.id, savedPaths: { playwright: '', jkauto: [] }, error }
  }
}
