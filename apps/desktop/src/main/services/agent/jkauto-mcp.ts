import fs from 'node:fs/promises'
import path from 'node:path'
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
        description: 'List all test case files (.test.json/.test.yaml) in the project',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'read_test_case',
        description: 'Read the raw content of a test case file',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path to the test case file' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'save_test_case_steps',
        description: 'Overwrite the steps array in a JSON test case file',
        inputSchema: {
          type: 'object' as const,
          properties: {
            filePath: { type: 'string', description: 'Absolute path to .test.json file' },
            steps: { type: 'array', description: 'Array of JKAuto step objects' },
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
              f.endsWith('.test.json') ||
              f.endsWith('.test.yaml') ||
              f.endsWith('.test.yml'),
          )
          return { content: [{ type: 'text' as const, text: JSON.stringify(files, null, 2) }] }
        }

        case 'read_test_case': {
          const raw = await fs.readFile(a.filePath as string, 'utf-8')
          return { content: [{ type: 'text' as const, text: raw }] }
        }

        case 'save_test_case_steps': {
          const filePath = a.filePath as string
          const raw = await fs.readFile(filePath, 'utf-8')
          const tc = JSON.parse(raw) as Record<string, unknown>
          tc.steps = a.steps
          tc.updatedAt = new Date().toISOString()
          await fs.writeFile(filePath, JSON.stringify(tc, null, 2), 'utf-8')
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
