import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { createBackup } from '../file-history'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const SKIP_DIRS = new Set(['.autotest', '.git', 'node_modules', 'reports'])

async function findFiles(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  const results: string[] = []
  async function walk(d: string): Promise<void> {
    const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(path.join(d, entry.name))
      } else if (predicate(entry.name)) {
        results.push(path.join(d, entry.name))
      }
    }
  }
  await walk(dir)
  return results
}

const RULES: Record<string, string> = {
  'file-naming': `
File naming conventions:
- Test cases: test-cases/<subfolder>/<kebab-name>.test.yaml  (e.g. test-cases/web/tc-login.test.yaml, test-cases/api/get-users.test.yaml)
- Suites: test-suites/<name>.suite.yaml
- Keywords: keywords/<name>.keywords.yaml
- Objects/selectors: object-repository/<page>.objects.json
- API request templates: api-requests/<name>.request.json
- Never overwrite an existing test case when asked to create a NEW one. Always use a new file path.`,

  'test-cases': `
Test case file schema (YAML):
  id: <uuid>             # stable, set at creation, never change
  name: <string>
  description: <string>
  schemaVersion: 1
  platform: web | mobile | desktop | api   # REQUIRED — drives which engine runs it
  runner: playwright | maestro | appium | api  # derived from platform if omitted
  tags: []               # optional string array
  variables: {}          # optional key-value map for TC-level vars (API tests use this for BASE_URL etc.)
  steps: []
  createdAt: <iso>
  updatedAt: <iso>

Platform → runner mapping:
  web      → playwright
  mobile   → maestro
  desktop  → playwright
  api      → api

Rules:
- Always set platform. Omitting it defaults engine to playwright (web), which is WRONG for API tests.
- To create: call create_test_case(filePath, name, platform). Then call save_test_case_steps.
- To modify: call read_test_case first, then save_test_case_steps with full updated array.
- Never use write_file to create or edit test cases.`,

  'steps': `
Step object schema (same for all platforms):
  keyword: <string>       # required — built-in or custom keyword name
  description: <string>   # human label
  objectRef: <string>     # selector (UI) | HTTP method (API) | JSON path | header name
  input: <string>         # URL/path, text to type, value to set; supports \${varName}
  expected: <string>      # assertion value or JSON config string
  enabled: true
  continueOnFailure: false
  timeout: null           # override ms or null

- Output COMPLETE steps array when calling save_test_case_steps (not a diff).
- Omit the "id" field from steps — engine auto-generates it.
- End every test with at least one assertion step.`,

  'platforms': `
Platform selection guide:

| Goal                                 | platform | runner     |
|--------------------------------------|----------|------------|
| Test a web page / browser UI         | web      | playwright |
| Test a mobile app (iOS/Android)      | mobile   | maestro    |
| Test a desktop app                   | desktop  | playwright |
| Test an HTTP/REST API endpoint       | api      | api        |

UI tests (web/mobile/desktop): use UI keywords (navigate-to, click, type-text, assert-text…).
API tests: use API keywords (http-request, assert-status-code, assert-json-path…).
Call get_rules("ui-steps") or get_rules("api-steps") for keyword reference.

Profile API config (profile.api): when set, ApiAdapter auto-injects baseUrl + Authorization header
for all http-request steps — no manual set-base-url / set-auth-bearer steps needed at TC start.`,

  'ui-steps': `
UI built-in keywords (platform: web | mobile | desktop):

Navigation:
  navigate-to       input=url or path
  assert-url        expected=exact url
  assert-url-contains  expected=substring

Interaction:
  click             objectRef=selector
  type-text         objectRef=selector, input=text
  clear-text        objectRef=selector
  hover             objectRef=selector
  press-key         objectRef=selector, input=key (e.g. Enter, Tab)
  scroll-to         objectRef=selector
  select-option     objectRef=selector, input=value
  check             objectRef=selector
  uncheck           objectRef=selector

Assertions:
  assert-text       objectRef=selector, expected=text
  assert-visible    objectRef=selector
  assert-hidden     objectRef=selector
  assert-element-value  objectRef=selector, expected=value

Waits:
  wait              input=ms
  wait-ms           input=ms
  wait-for-element  objectRef=selector
  wait-for-visible  objectRef=selector

Other:
  take-screenshot   description=label

Selector priority: testid > role > css > xpath.
Use data-testid or semantic roles when available; avoid fragile absolute XPaths.`,

  'api-steps': `
API built-in keywords (platform: api, runner: api):

Request:
  http-request         objectRef=METHOD (GET/POST/PUT/PATCH/DELETE), input=path (e.g. /users/\${userId})
  set-base-url         input=url  — override session baseUrl (skip if profile.api.baseUrl is set)
  set-request-header   objectRef=Header-Name, input=value  — add/override a request header
  set-auth-bearer      input=token  — sets Authorization: Bearer <token>

Assertions:
  assert-status-code        expected=200  (or any HTTP status string)
  assert-response-time      expected=2000  (max ms)
  assert-json-path          objectRef=jsonPath (e.g. data.id), expected=value
  assert-response-contains  expected=substring

Variables:
  set-variable    objectRef=varName, input=literal value
                  OR objectRef=varName, expected=jsonPath  — extracts from last response JSON
  log-response    continueOnFailure=true  — logs full response to console

Profile persistence:
  save-to-profile   Single mode: objectRef=profileKey, input=sessionVarName
                    Batch mode: expected='{"type":"variables","mappings":[{"from":"sessionVar","to":"profileKey"}]}'
                    API config: expected='{"type":"api-config","mappings":[{"from":"BASE_URL","to":"baseUrl"},{"from":"token","to":"auth.bearer.token"}]}'

Typical API test structure:
  1. http-request  → call endpoint
  2. assert-status-code  → verify HTTP status
  3. assert-json-path / assert-response-contains  → verify response body
  4. set-variable  → extract values for subsequent steps
  5. (optional) save-to-profile  → persist tokens/config across test cases in a suite

If profile.api.baseUrl and profile.api.auth are configured, steps 1+ work without any setup headers.
Use \${varName} in input/expected to reference session variables or profile variables.`,

  'keywords': `
Custom keywords live in keywords/*.keywords.yaml.
Each keyword composes built-in steps. Call list_keywords to see available ones.
Prefer custom keywords over raw built-ins when the project has relevant ones.`,
}

export async function createJkautoMcpClient(projectPath: string): Promise<Client> {
  const server = new Server(
    { name: 'jkauto-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_test_cases',
        description: 'List all test case files (.test.yaml) in the project',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'read_test_case',
        description: 'Read the raw YAML content of a test case file',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path to the test case file' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'create_test_case',
        description:
          'Create a new test case file with correct JKAuto schema. Always specify platform. Use platform="api" for HTTP/REST tests, "web" for browser UI, "mobile" for mobile app, "desktop" for desktop app.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute path for the new .test.yaml file. Must be under test-cases/ in the project.',
            },
            name: { type: 'string', description: 'Human-readable test case name' },
            description: { type: 'string', description: 'What this test case tests (optional)' },
            platform: {
              type: 'string',
              enum: ['web', 'mobile', 'desktop', 'api'],
              description: 'Test platform: "api" for HTTP/REST, "web" for browser UI, "mobile" for iOS/Android, "desktop" for desktop app. Defaults to "web" if omitted.',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags (e.g. ["smoke", "auth", "api"])',
            },
          },
          required: ['filePath', 'name'],
        },
      },
      {
        name: 'save_test_case_steps',
        description:
          'Overwrite the steps array in an existing YAML test case file. Use after read_test_case to update steps. Always provide the COMPLETE steps array.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path to .test.yaml file' },
            steps: { type: 'array', description: 'Complete steps array (all steps, not a diff). Omit "id" field from each step.' },
          },
          required: ['filePath', 'steps'],
        },
      },
      {
        name: 'list_keywords',
        description: 'List all custom keywords defined in the project keywords folder',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'list_api_requests',
        description: 'List API request template files (.request.json) in the project api-requests folder. Useful to understand existing API endpoints and conventions.',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'get_project_info',
        description: 'Read project.json metadata (name, type, description, format)',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'get_rules',
        description:
          'Get JKAuto domain rules and conventions. Call this when unsure about file structure, naming, step schema, or which keywords to use.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            topic: {
              type: 'string',
              enum: ['platforms', 'test-cases', 'steps', 'ui-steps', 'api-steps', 'keywords', 'file-naming', 'all'],
              description: 'platforms — when to use web/api/mobile/desktop; ui-steps — browser/app keywords; api-steps — HTTP test keywords; test-cases — file schema; steps — step schema; file-naming — naming conventions; all — everything.',
            },
          },
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    const a = (args ?? {}) as Record<string, unknown>

    try {
      switch (name) {
        case 'list_test_cases': {
          const files = await findFiles(
            projectPath,
            (f) => f.endsWith('.test.yaml') || f.endsWith('.test.yml'),
          )
          return { content: [{ type: 'text' as const, text: JSON.stringify(files, null, 2) }] }
        }

        case 'read_test_case': {
          const raw = await fs.readFile(a.filePath as string, 'utf-8')
          return { content: [{ type: 'text' as const, text: raw }] }
        }

        case 'create_test_case': {
          const filePath = a.filePath as string
          const tcName = a.name as string
          const description = (a.description as string | undefined) ?? ''
          const platform = (a.platform as string | undefined) ?? 'web'
          const tags = (a.tags as string[] | undefined) ?? []
          const runner =
            platform === 'api' ? 'api'
            : platform === 'mobile' ? 'maestro'
            : 'playwright'

          await fs.mkdir(path.dirname(filePath), { recursive: true })

          const tc: Record<string, unknown> = {
            schemaVersion: 1,
            id: crypto.randomUUID(),
            name: tcName,
            description,
            platform,
            runner,
            tags,
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          await fs.writeFile(filePath, yamlStringify(tc), 'utf-8')
          return { content: [{ type: 'text' as const, text: `Created: ${filePath}` }] }
        }

        case 'save_test_case_steps': {
          const filePath = a.filePath as string
          const raw = await fs.readFile(filePath, 'utf-8')
          const tc = yamlParse(raw) as Record<string, unknown>
          tc.steps = a.steps
          tc.updatedAt = new Date().toISOString()
          await createBackup(filePath)
          await fs.writeFile(filePath, yamlStringify(tc), 'utf-8')
          return { content: [{ type: 'text' as const, text: `Saved ${filePath}` }] }
        }

        case 'list_keywords': {
          const files = await findFiles(
            projectPath,
            (f) => f.endsWith('.keywords.json') || f.endsWith('.keywords.yaml'),
          )
          const keywords: unknown[] = []
          for (const f of files) {
            try {
              const raw = await fs.readFile(f, 'utf-8')
              const kw = JSON.parse(raw) as { keywords?: unknown[] }
              if (Array.isArray(kw.keywords)) keywords.push(...kw.keywords)
            } catch { /* skip */ }
          }
          return { content: [{ type: 'text' as const, text: JSON.stringify(keywords, null, 2) }] }
        }

        case 'list_api_requests': {
          const files = await findFiles(
            projectPath,
            (f) => f.endsWith('.request.json'),
          )
          if (files.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No .request.json files found in project.' }] }
          }
          const snippets: string[] = []
          for (const f of files) {
            try {
              const raw = await fs.readFile(f, 'utf-8')
              snippets.push(`${path.relative(projectPath, f)}:\n${raw}`)
            } catch { /* skip */ }
          }
          return { content: [{ type: 'text' as const, text: snippets.join('\n\n---\n\n') }] }
        }

        case 'get_project_info': {
          const raw = await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8')
          return { content: [{ type: 'text' as const, text: raw }] }
        }

        case 'get_rules': {
          const topic = (a.topic as string | undefined) ?? 'all'
          const text =
            topic === 'all'
              ? Object.values(RULES).join('\n\n---\n')
              : (RULES[topic] ?? `Unknown topic: ${topic}. Valid: ${Object.keys(RULES).join(', ')}`)

          return { content: [{ type: 'text' as const, text: text.trim() }] }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      }
    }
  })

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'jkauto-host', version: '1.0.0' })
  await client.connect(clientTransport)

  return client
}
