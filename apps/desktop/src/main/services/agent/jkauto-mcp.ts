import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { ProfileSchema, TestCaseSchema } from '@jkauto/core'
import type { Profile, TestCase } from '@jkauto/core'
import { runTestCase } from '@jkauto/engine'
import { createBackup } from '../file-history'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  markCompileAndSave,
  recordRuntimeResult,
  recordTestPlan,
  recordVerification,
  validateGeneratedTest,
} from './harness.service'
import { buildFeatureBundle, listFeatures } from '../autogen/feature-bundle'

const SKIP_DIRS = new Set(['.autotest', '.git', 'node_modules', 'reports'])

function assertTestCasePath(projectPath: string, filePath: string): string {
  const resolved = path.resolve(filePath)
  const root = path.resolve(projectPath, 'test-cases')
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Test case path must be inside the project test-cases directory')
  }
  return resolved
}

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
                       expected=JSON body string — REQUIRED for POST/PUT/PATCH that send a payload.
                       Example login: objectRef="POST", input="/auth/login",
                       expected='{"username":"admin","password":"Admin@123"}'
                       Without a body, POST requests send nothing and fail (e.g. login returns 400).
  set-base-url         input=url  — set session baseUrl. ALWAYS add this as step 1 unless the active
                       profile already has api.baseUrl. Use a concrete URL (e.g. http://localhost:3000),
                       not an undefined \${VAR}/{{VAR}} — unresolved base URLs fail with "Failed to parse URL".
  set-request-header   objectRef=Header-Name, input=value  — add/override a request header
  set-auth-bearer      input=token  — sets Authorization: Bearer <token>

Assertions:
  assert-status-code        expected=200  (or any HTTP status string)
  assert-response-time      expected=2000  (max ms)
  assert-json-path          objectRef=jsonPath (e.g. data.id), expected=value.
                            Use expected="*" (or empty) to assert the field exists / is non-empty —
                            REQUIRED for dynamic values like accessToken, refreshToken, id, timestamps.
                            Never assert an exact value for a token/id you cannot know in advance.
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

  'test-generation': `
Test generation workflow (when asked to generate tests for a feature, e.g. "login", "documents"):
1. Call get_feature_bundle(feature) — returns endpoints + validation rules, ready request bodies
   (sampleRequestBody / sampleRequestBodyInvalid), seed/test accounts, auth requirements, baseUrlHint,
   authSetup, and suggested scenarios. Call list_features first if unsure of the feature name.
2. Every API test must be runnable:
   - Step 1: set-base-url with the bundle's baseUrlHint (e.g. http://localhost:3001). Never leave it unresolved.
   - POST/PUT/PATCH http-request: put the JSON body in the step's "expected" field. Copy sampleRequestBody
     for happy paths, sampleRequestBodyInvalid for negative/boundary tests. Never leave a write body empty.
   - Auth-required endpoints: follow the bundle's authSetup — login with the seed account, store the token
     (set-variable objectRef=accessToken, expected=accessToken — "expected" extracts a JSON path from the
     last response), then set-auth-bearer input=\${accessToken}. Reference stored variables with \${name}.
   - Reuse the token across a suite: save-to-profile
     expected='{"type":"api-config","mappings":[{"from":"accessToken","to":"auth.bearer.token"}]}'.
     After that profile.api auto-injects Authorization on every API test — later tests skip login.
   - Use each endpoint's samplePath for the http-request URL — it already includes REQUIRED query params
     (e.g. /search?q=test). Missing a required query param returns 400. Path params like {id} must be
     substituted with a real value (extract one from a prior create/list response).
   - assert-json-path with expected="*" asserts a dynamic field (token/id) merely exists.
3. Author ONE test case per suggested scenario (happy / missing-required / invalid-value / wrong-credentials
   / unauthorized). Use seed accounts for valid logins; never invent credentials when seed data exists.
4. For each: create_test_case then save_test_case_steps. A login feature typically yields 3-4 test cases.`,
}

async function loadRuntimeProfile(projectPath: string, profileName?: string): Promise<Profile> {
  const profileDir = path.join(projectPath, 'profiles')
  const entries = await fs.readdir(profileDir).catch(() => [])
  const target = profileName ? `${profileName}.env.json` : undefined
  const candidate =
    (target && entries.find((entry) => entry === target)) ??
    entries.find((entry) => entry === 'default.env.json') ??
    entries.find((entry) => entry.endsWith('.env.json'))
  if (candidate) {
    try {
      return ProfileSchema.parse(
        JSON.parse(await fs.readFile(path.join(profileDir, candidate), 'utf-8')),
      )
    } catch {
      // Fall through to an empty runtime profile.
    }
  }
  return { schemaVersion: 1, name: 'default', variables: {}, secrets: [] }
}

async function loadAllObjectRepositories(projectPath: string): Promise<Array<{ name: string; objects: Array<{ name: string; locators: Array<{ strategy: string; value: string }> }> }>> {
  const repos: Array<{ name: string; objects: Array<{ name: string; locators: Array<{ strategy: string; value: string }> }> }> = []
  for (const dir of ['object-repository', 'api-request']) {
    const repoDir = path.join(projectPath, dir)
    try {
      const entries = await fs.readdir(repoDir)
      for (const entry of entries) {
        if (!entry.endsWith('.objects.json')) continue
        try {
          const raw = await fs.readFile(path.join(repoDir, entry), 'utf-8')
          repos.push(JSON.parse(raw))
        } catch { /* skip malformed */ }
      }
    } catch { /* dir missing */ }
  }
  return repos
}

interface StepEventRecord {
  stepIndex: number
  status: string
  message?: string
  durationMs: number
  screenshotPath?: string
}

async function runTestCaseFull(
  projectPath: string,
  filePath: string,
  profileName?: string,
  screenshotDir?: string,
): Promise<{ passed: boolean; steps: StepEventRecord[]; durationMs: number; error?: string }> {
  const parsed = yamlParse(await fs.readFile(filePath, 'utf-8'))
  const testCase = TestCaseSchema.parse(parsed) as TestCase
  const profile = await loadRuntimeProfile(projectPath, profileName)
  const objectRepositories = await loadAllObjectRepositories(projectPath)
  const runId = crypto.randomUUID()
  const steps: StepEventRecord[] = []
  const start = Date.now()

  return new Promise((resolve, reject) => {
    runTestCase(
      testCase,
      profile,
      runId,
      (event) => {
        if (event.status !== 'running') {
          steps.push({
            stepIndex: event.stepIndex,
            status: event.status,
            message: event.message,
            durationMs: event.durationMs ?? 0,
            screenshotPath: event.screenshotPath,
          })
        }
      },
      (event) => resolve({
        passed: event.status === 'passed',
        steps,
        durationMs: Date.now() - start,
      }),
      undefined,
      {
        headless: true,
        screenshotDir: screenshotDir ?? path.join(projectPath, '.autotest', 'screenshots'),
        screenshotMode: 'failure',
        objectRepositories,
        loadTestCase: async (calledPath) => {
          const raw = await fs.readFile(
            path.isAbsolute(calledPath) ? calledPath : path.resolve(projectPath, calledPath),
            'utf-8',
          )
          return TestCaseSchema.parse(yamlParse(raw))
        },
      },
    ).catch(reject)
  })
}

async function runGeneratedTest(
  projectPath: string,
  filePath: string,
): Promise<{ passed: boolean; details: unknown }> {
  const parsed = yamlParse(await fs.readFile(filePath, 'utf-8'))
  const testCase = TestCaseSchema.parse(parsed) as TestCase
  const profile = await loadRuntimeProfile(projectPath)
  const runId = crypto.randomUUID()
  const stepEvents: unknown[] = []
  return new Promise((resolve, reject) => {
    runTestCase(
      testCase,
      profile,
      runId,
      (event) => stepEvents.push(event),
      (event) => resolve({ passed: event.status === 'passed', details: { runId, event, stepEvents } }),
      undefined,
      {
        headless: true,
        loadTestCase: async (calledPath) => {
          const raw = await fs.readFile(
            path.isAbsolute(calledPath)
              ? calledPath
              : path.resolve(projectPath, calledPath),
            'utf-8',
          )
          return TestCaseSchema.parse(yamlParse(raw))
        },
      },
    ).catch(reject)
  })
}

export async function createJkautoMcpClient(
  projectPath: string,
  getSessionId: () => string = () => '',
): Promise<Client> {
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
        name: 'list_features',
        description:
          'List testable features grouped from analyzed endpoints + UI routes (e.g. auth, users, documents). Each entry shows how many endpoints and pages belong to it. Call this first to discover what features can be tested, then get_feature_bundle for one.',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'get_feature_bundle',
        description:
          'Get a complete test dossier for ONE feature: its API endpoints with validation rules (required/minLength/format/enum + sample valid & invalid values), related UI pages, seed/test accounts found in the codebase, auth requirements, and suggested test scenarios (happy/negative/boundary/auth). Use this to author multiple coherent test cases for a feature (e.g. 3-4 login tests) in one pass.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            feature: {
              type: 'string',
              description: 'Feature key from list_features (e.g. "auth", "documents", "users"). Path substrings also match (e.g. "login").',
            },
          },
          required: ['feature'],
        },
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
              enum: ['platforms', 'test-cases', 'steps', 'ui-steps', 'api-steps', 'keywords', 'file-naming', 'test-generation', 'all'],
              description: 'platforms — when to use web/api/mobile/desktop; ui-steps — browser/app keywords; api-steps — HTTP test keywords; test-cases — file schema; steps — step schema; file-naming — naming conventions; test-generation — step-by-step recipe for generating a feature\'s test suite; all — everything.',
            },
          },
        },
      },
      {
        name: 'record_test_plan',
        description:
          'Persist the structured test plan for the active Directly harness before executing tools.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            target: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['page', 'api', 'flow'] },
                id: { type: 'string' },
              },
              required: ['type', 'id'],
            },
            preconditions: { type: 'array', items: { type: 'string' } },
            scenarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  goal: { type: 'string' },
                  priority: {
                    type: 'string',
                    enum: ['critical', 'normal', 'edge'],
                  },
                  actions: { type: 'array', items: { type: 'string' } },
                  assertions: { type: 'array', items: { type: 'string' } },
                  evidenceRequired: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: [
                  'id',
                  'goal',
                  'priority',
                  'actions',
                  'assertions',
                  'evidenceRequired',
                ],
              },
            },
            sourceRefs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  file: { type: 'string' },
                  line: { type: 'number' },
                  symbol: { type: 'string' },
                },
                required: ['file'],
              },
            },
          },
          required: ['target', 'preconditions', 'scenarios', 'sourceRefs'],
        },
      },
      {
        name: 'record_verification',
        description:
          'Persist a browser/API assertion and its observed evidence. Call for both pass and failure; a failure moves the harness into repair.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            passed: { type: 'boolean' },
            assertion: { type: 'string' },
            evidence: { type: 'string' },
            generatedTestPath: { type: 'string' },
          },
          required: ['passed', 'assertion', 'evidence'],
        },
      },
      {
        name: 'validate_test_case',
        description:
          'Hard-gate a generated JKAuto test file against TestCaseSchema.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'run_generated_test',
        description:
          'Execute the saved JKAuto test through the real engine. This runtime gate must pass before Directly can complete.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'run_test_case',
        description: 'Run a test case file through the engine. Returns per-step results and screenshot paths on failure. Use this in the agent fix-loop: generate → run → check failure → fix → run again.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path to .test.yaml' },
            profile: { type: 'string', description: 'Profile name (default: "default")' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'run_test_suite',
        description: 'Run all test cases in a suite file. Returns aggregated results.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path to .suite.yaml' },
            profile: { type: 'string', description: 'Profile name (default: "default")' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'list_profiles',
        description: 'List all environment profiles and their variable keys (secrets masked).',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'list_object_repositories',
        description: 'List all object repositories with their element names and primary locators.',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'create_test_suite',
        description: 'Create a new test suite YAML file that groups multiple test cases.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path for the new .suite.yaml' },
            name: { type: 'string', description: 'Suite display name' },
            description: { type: 'string' },
            testCasePaths: { type: 'array', items: { type: 'string' }, description: 'Absolute paths to test cases to include' },
          },
          required: ['filePath', 'name'],
        },
      },
      {
        name: 'get_screenshot',
        description: 'Read a failure screenshot as base64 to visually diagnose what the browser showed when a step failed.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            screenshotPath: { type: 'string', description: 'Absolute path to the PNG screenshot' },
          },
          required: ['screenshotPath'],
        },
      },
      {
        name: 'search_in_codebase',
        description: 'Search for text/pattern across source files. Use to find selectors, API routes, component names, existing test patterns. Returns file:line:content matches.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string', description: 'Text or regex to search for' },
            fileExtensions: {
              type: 'array',
              items: { type: 'string' },
              description: 'File extensions to search (e.g. ["ts","tsx","vue"]). Defaults to common source extensions.',
            },
            searchPath: {
              type: 'string',
              description: 'Directory to search. Defaults to project directory.',
            },
            maxResults: {
              type: 'number',
              description: 'Max lines to return (default 50)',
            },
          },
          required: ['pattern'],
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
          const filePath = assertTestCasePath(projectPath, a.filePath as string)
          const tcName = a.name as string
          const description = (a.description as string | undefined) ?? ''
          const platform = (a.platform as string | undefined) ?? 'web'
          const tags = (a.tags as string[] | undefined) ?? []
          const runner =
            platform === 'api' ? 'api'
            : platform === 'mobile' ? 'maestro'
            : 'playwright'

          const exists = await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false)
          if (exists) {
            throw new Error(`Test case already exists: ${filePath}`)
          }
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
          const filePath = assertTestCasePath(projectPath, a.filePath as string)
          const raw = await fs.readFile(filePath, 'utf-8')
          const tc = yamlParse(raw) as Record<string, unknown>
          tc.steps = (a.steps as Array<Record<string, unknown>>).map((step) => ({
            id: typeof step.id === 'string' ? step.id : crypto.randomUUID(),
            name: String(step.name ?? ''),
            keyword: String(step.keyword ?? ''),
            description: String(step.description ?? ''),
            objectRef: String(step.objectRef ?? ''),
            input: String(step.input ?? ''),
            expected: String(step.expected ?? ''),
            enabled: step.enabled !== false,
            continueOnFailure: step.continueOnFailure === true,
            timeout: typeof step.timeout === 'number' ? step.timeout : null,
          }))
          tc.updatedAt = new Date().toISOString()
          await createBackup(filePath)
          await fs.writeFile(filePath, yamlStringify(tc), 'utf-8')
          if (getSessionId()) {
            markCompileAndSave(projectPath, getSessionId(), filePath)
          }
          return { content: [{ type: 'text' as const, text: `Saved ${filePath}` }] }
        }

        case 'record_test_plan': {
          recordTestPlan(projectPath, getSessionId(), a as never)
          return {
            content: [{ type: 'text' as const, text: 'Test plan persisted.' }],
          }
        }

        case 'record_verification': {
          recordVerification(projectPath, getSessionId(), {
            passed: Boolean(a.passed),
            assertion: String(a.assertion ?? ''),
            evidence: String(a.evidence ?? ''),
            generatedTestPath: a.generatedTestPath
              ? String(a.generatedTestPath)
              : undefined,
          })
          return {
            content: [{ type: 'text' as const, text: 'Verification persisted.' }],
          }
        }

        case 'validate_test_case': {
          const validation = await validateGeneratedTest(
            projectPath,
            getSessionId(),
            String(a.filePath),
          )
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify(validation) },
            ],
            isError: !validation.valid,
          }
        }

        case 'run_generated_test': {
          const filePath = String(a.filePath)
          const result = await runGeneratedTest(projectPath, filePath)
          recordRuntimeResult(projectPath, getSessionId(), {
            passed: result.passed,
            filePath,
            details: result.details,
          })
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify(result) },
            ],
            isError: !result.passed,
          }
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

        case 'list_features': {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(listFeatures(projectPath), null, 2),
            }],
          }
        }

        case 'get_feature_bundle': {
          const bundle = buildFeatureBundle(projectPath, String(a.feature ?? ''))
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(bundle, null, 2) }],
          }
        }

        case 'get_rules': {
          const topic = (a.topic as string | undefined) ?? 'all'
          const text =
            topic === 'all'
              ? Object.values(RULES).join('\n\n---\n')
              : (RULES[topic] ?? `Unknown topic: ${topic}. Valid: ${Object.keys(RULES).join(', ')}`)

          return { content: [{ type: 'text' as const, text: text.trim() }] }
        }

        case 'run_test_case': {
          const filePath = String(a.filePath)
          const profileName = a.profile ? String(a.profile) : undefined
          const screenshotDir = path.join(projectPath, '.autotest', 'screenshots')
          const result = await runTestCaseFull(projectPath, filePath, profileName, screenshotDir)
          const failed = result.steps.filter((s) => s.status === 'failed')
          const summary = {
            passed: result.passed,
            totalSteps: result.steps.length,
            failedSteps: failed.map((s) => ({
              stepIndex: s.stepIndex + 1,
              message: s.message,
              screenshotPath: s.screenshotPath,
            })),
            durationMs: result.durationMs,
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
            isError: !result.passed,
          }
        }

        case 'run_test_suite': {
          const suiteFilePath = String(a.filePath)
          const profileName = a.profile ? String(a.profile) : undefined
          const raw = await fs.readFile(suiteFilePath, 'utf-8')
          let parsed: { name?: string; items?: Array<{ path: string }> }
          try {
            parsed = JSON.parse(raw)
          } catch {
            const { parse: yParse } = await import('yaml')
            parsed = yParse(raw)
          }
          const items = parsed.items ?? []
          const suiteDir = path.dirname(suiteFilePath)
          const results: Array<{ file: string; passed: boolean; failedSteps: unknown[] }> = []
          for (const item of items) {
            const tcPath = path.isAbsolute(item.path)
              ? item.path
              : path.resolve(projectPath, item.path)
            try {
              const r = await runTestCaseFull(projectPath, tcPath, profileName)
              results.push({
                file: path.relative(suiteDir, tcPath),
                passed: r.passed,
                failedSteps: r.steps.filter((s) => s.status === 'failed').map((s) => ({
                  stepIndex: s.stepIndex + 1, message: s.message, screenshotPath: s.screenshotPath,
                })),
              })
            } catch (err) {
              results.push({ file: path.relative(suiteDir, tcPath), passed: false, failedSteps: [{ message: String(err) }] })
            }
          }
          const totalPassed = results.filter((r) => r.passed).length
          const summary = { passed: totalPassed === results.length, total: results.length, passing: totalPassed, results }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
            isError: totalPassed !== results.length,
          }
        }

        case 'list_profiles': {
          const profileDir = path.join(projectPath, 'profiles')
          const entries = await fs.readdir(profileDir).catch(() => [] as string[])
          const profiles = []
          for (const entry of entries) {
            if (!entry.endsWith('.env.json')) continue
            try {
              const raw = await fs.readFile(path.join(profileDir, entry), 'utf-8')
              const p = JSON.parse(raw)
              const vars = p.variables ?? {}
              profiles.push({
                name: p.name ?? entry.replace('.env.json', ''),
                file: entry,
                variables: Object.fromEntries(
                  Object.entries(vars).map(([k, v]) => [
                    k,
                    /token|secret|password|key|auth/i.test(k) ? '***' : v,
                  ])
                ),
              })
            } catch { /* skip */ }
          }
          return { content: [{ type: 'text' as const, text: JSON.stringify(profiles, null, 2) }] }
        }

        case 'list_object_repositories': {
          const repos = await loadAllObjectRepositories(projectPath)
          const summary = repos.map((r) => ({
            name: r.name,
            objects: (r.objects ?? []).map((o) => ({
              name: o.name,
              locators: (o.locators ?? []).map((l) => `${l.strategy}=${l.value}`),
            })),
          }))
          return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] }
        }

        case 'create_test_suite': {
          const suiteFilePath = String(a.filePath)
          const items = ((a.testCasePaths as string[] | undefined) ?? []).map((p) => ({
            path: path.relative(projectPath, p),
          }))
          const suite = {
            schemaVersion: 1,
            id: crypto.randomUUID(),
            name: String(a.name),
            description: a.description ? String(a.description) : '',
            items,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          await fs.mkdir(path.dirname(suiteFilePath), { recursive: true })
          await fs.writeFile(suiteFilePath, yamlStringify(suite), 'utf-8')
          return { content: [{ type: 'text' as const, text: `Suite created: ${suiteFilePath} (${items.length} tests)` }] }
        }

        case 'get_screenshot': {
          const screenshotPath = String(a.screenshotPath)
          const buf = await fs.readFile(screenshotPath)
          const base64 = buf.toString('base64')
          return {
            content: [{
              type: 'image' as const,
              data: base64,
              mimeType: 'image/png',
            }],
          }
        }

        case 'search_in_codebase': {
          const { execSync } = await import('node:child_process')
          const pattern = String(a.pattern)
          const exts = (a.fileExtensions as string[] | undefined) ?? ['ts', 'tsx', 'js', 'jsx', 'vue', 'svelte', 'py', 'yaml', 'yml', 'json']
          const maxResults = typeof a.maxResults === 'number' ? a.maxResults : 50
          const searchRoot = a.searchPath ? String(a.searchPath) : projectPath

          const includeFlags = exts.map((e) => `--include="*.${e}"`).join(' ')
          const excludeDirs = ['node_modules', '.git', '.autotest', 'dist', 'build', '.next', 'reports']
            .map((d) => `--exclude-dir="${d}"`).join(' ')

          try {
            const cmd = `grep -rn ${excludeDirs} ${includeFlags} -E "${pattern.replace(/"/g, '\\"')}" "${searchRoot}" 2>/dev/null | head -${maxResults}`
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim()
            const lines = output ? output.split('\n').length : 0
            return {
              content: [{
                type: 'text' as const,
                text: output || `No matches found for: ${pattern}`,
              }],
              // attach summary as first line
              ...(output && { content: [{ type: 'text' as const, text: `[${lines} matches]\n${output}` }] }),
            }
          } catch (execErr) {
            // grep exits 1 when no matches — not an error
            const msg = execErr instanceof Error ? execErr.message : String(execErr)
            if (msg.includes('status 1') || (execErr as NodeJS.ErrnoException).status === 1) {
              return { content: [{ type: 'text' as const, text: `No matches found for: ${pattern}` }] }
            }
            throw execErr
          }
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
