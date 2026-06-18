import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
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
          'Create a new test case file with correct JKAuto schema. Use this instead of write_file when creating new test cases.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: {
              type: 'string',
              description:
                'Absolute path for the new .test.yaml file. Must be under test-cases/ in the project.',
            },
            name: { type: 'string', description: 'Human-readable test case name' },
            description: { type: 'string', description: 'What this test case tests (optional)' },
          },
          required: ['filePath', 'name'],
        },
      },
      {
        name: 'save_test_case_steps',
        description:
          'Overwrite the steps array in an existing YAML test case file. Use after read_test_case to update steps.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path to .test.yaml file' },
            steps: { type: 'array', description: 'Complete steps array (all steps, not a diff)' },
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
        name: 'get_project_info',
        description: 'Read project.json metadata (name, type, description, format)',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'get_rules',
        description:
          'Get JKAuto domain rules and conventions. Call this when unsure about file structure, naming conventions, step schema, or how to perform a task correctly.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            topic: {
              type: 'string',
              enum: ['test-cases', 'steps', 'keywords', 'file-naming', 'all'],
              description: 'Which rules to return',
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
            (f) =>
              f.endsWith('.test.yaml') ||
              f.endsWith('.test.yml'),
          )
          return { content: [{ type: 'text' as const, text: JSON.stringify(files, null, 2) }] }
        }

        case 'read_test_case': {
          const raw = await fs.readFile(a.filePath as string, 'utf-8')
          return { content: [{ type: 'text' as const, text: raw }] }
        }

        case 'create_test_case': {
          const filePath = a.filePath as string
          const name = a.name as string
          const description = (a.description as string | undefined) ?? ''
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          const tc = {
            id: crypto.randomUUID(),
            name,
            description,
            schemaVersion: 1,
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
            } catch {}
          }
          return { content: [{ type: 'text' as const, text: JSON.stringify(keywords, null, 2) }] }
        }

        case 'get_project_info': {
          const raw = await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8')
          return { content: [{ type: 'text' as const, text: raw }] }
        }

        case 'get_rules': {
          const topic = (a.topic as string | undefined) ?? 'all'
          const rules: Record<string, string> = {
            'file-naming': `
File naming conventions:
- Test cases: test-cases/<subfolder>/<kebab-name>.test.yaml  (e.g. test-cases/web/tc-login.test.yaml)
- Suites: test-suites/<name>.suite.yaml
- Keywords: keywords/<name>.keywords.yaml
- Objects: api-request/<page>.objects.json
- Never overwrite an existing test case when asked to create a NEW one. Always use a new file path.`,
            'test-cases': `
Test case file schema (YAML):
  id: <uuid>           # stable, set at creation, never change
  name: <string>       # human label
  description: <string>
  schemaVersion: 1
  steps: []            # array of step objects
  createdAt: <iso>
  updatedAt: <iso>

Rules:
- One feature / scenario per file. Do not combine unrelated flows in one test case.
- To create a new test case: call create_test_case(filePath, name). Then call save_test_case_steps.
- To modify existing: call read_test_case first, then save_test_case_steps with full updated array.
- Never use write_file to create or edit test cases — use jkauto tools only.`,
            'steps': `
Step object schema:
  keyword: <string>    # required — must match a built-in or custom keyword
  description: <string>
  objectRef: <string>  # CSS/XPath selector or object repo ref
  input: <string>      # supports \${varName} from active profile
  expected: <string>
  enabled: true        # default
  continueOnFailure: false
  timeout: null        # ms or null

Built-in keywords:
  navigate-to, click, type-text, clear-text, hover, press-key,
  scroll-to, select-option, check, uncheck,
  assert-text, assert-url, assert-url-contains, assert-visible, assert-hidden, assert-element-value,
  wait, wait-ms, wait-for-element, wait-for-visible, take-screenshot

Rules:
- Output complete steps array (not a diff) when calling save_test_case_steps.
- Omit the "id" field from steps — engine generates it.
- Add assert steps for key outcomes; don't end a test without verification.`,
            'keywords': `
Custom keywords live in keywords/*.keywords.yaml.
Each keyword composes built-in steps. Call list_keywords to see available ones.
Prefer custom keywords over raw built-ins when project has relevant ones.`,
          }

          const text =
            topic === 'all'
              ? Object.values(rules).join('\n\n---\n')
              : (rules[topic] ?? `Unknown topic: ${topic}. Valid: ${Object.keys(rules).join(', ')}`)

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
