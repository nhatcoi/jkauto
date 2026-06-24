/**
 * Standalone stdio MCP server — lets Claude Code (and any MCP client)
 * control a JKAuto project from the terminal.
 *
 * Usage:
 *   node dist/jkauto-mcp-stdio.js <projectPath>
 *
 * Claude Code .mcp.json:
 *   {
 *     "jkauto": {
 *       "command": "node",
 *       "args": ["/abs/path/to/jkauto-mcp-stdio.js", "/abs/path/to/project"]
 *     }
 *   }
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { ProfileSchema, TestCaseSchema } from '@jkauto/core'
import type { Profile, TestCase } from '@jkauto/core'
import { runTestCase } from '@jkauto/engine'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const projectPath = process.argv[2]
if (!projectPath) {
  console.error('Usage: jkauto-mcp-stdio <projectPath>')
  process.exit(1)
}

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

async function loadProfile(profileName?: string): Promise<Profile> {
  const profileDir = path.join(projectPath, 'profiles')
  const entries = await fs.readdir(profileDir).catch(() => [])
  const target = profileName ? `${profileName}.env.json` : undefined
  const candidate =
    (target && entries.find((e) => e === target)) ??
    entries.find((e) => e === 'default.env.json') ??
    entries.find((e) => e.endsWith('.env.json'))
  if (candidate) {
    try {
      return ProfileSchema.parse(JSON.parse(await fs.readFile(path.join(profileDir, candidate), 'utf-8')))
    } catch { /* fall through */ }
  }
  return { schemaVersion: 1, name: 'default', variables: {} }
}

async function loadObjectRepos() {
  const repos: Array<{ name: string; objects: Array<{ name: string; locators: Array<{ strategy: string; value: string }> }> }> = []
  for (const dir of ['object-repository', 'api-request']) {
    const repoDir = path.join(projectPath, dir)
    const entries = await fs.readdir(repoDir).catch(() => [] as string[])
    for (const entry of entries) {
      if (!entry.endsWith('.objects.json')) continue
      try { repos.push(JSON.parse(await fs.readFile(path.join(repoDir, entry), 'utf-8'))) } catch { /* skip */ }
    }
  }
  return repos
}

async function runTC(filePath: string, profileName?: string) {
  const testCase = TestCaseSchema.parse(yamlParse(await fs.readFile(filePath, 'utf-8'))) as TestCase
  const profile = await loadProfile(profileName)
  const objectRepositories = await loadObjectRepos()
  const screenshotDir = path.join(projectPath, '.autotest', 'screenshots')
  const runId = crypto.randomUUID()
  const steps: Array<{ stepIndex: number; status: string; message?: string; screenshotPath?: string; durationMs: number }> = []

  return new Promise<{ passed: boolean; steps: typeof steps }>((resolve, reject) => {
    runTestCase(
      testCase, profile, runId,
      (evt) => { if (evt.status !== 'running') steps.push({ stepIndex: evt.stepIndex, status: evt.status, message: evt.message, screenshotPath: evt.screenshotPath, durationMs: evt.durationMs ?? 0 }) },
      (evt) => resolve({ passed: evt.status === 'passed', steps }),
      undefined,
      { headless: true, screenshotDir, screenshotMode: 'failure', objectRepositories,
        loadTestCase: async (p) => TestCaseSchema.parse(yamlParse(await fs.readFile(path.isAbsolute(p) ? p : path.resolve(projectPath, p), 'utf-8'))) },
    ).catch(reject)
  })
}

const server = new Server({ name: 'jkauto', version: '1.0.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'list_test_cases', description: 'List all test case files in the project', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_test_suites', description: 'List all test suite files', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_profiles', description: 'List all env profiles with variables (secrets masked)', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_object_repositories', description: 'List object repositories and their selectors', inputSchema: { type: 'object', properties: {} } },
    { name: 'read_test_case', description: 'Read a test case YAML file', inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
    { name: 'write_test_case', description: 'Write/overwrite a test case YAML file', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, content: { type: 'string', description: 'Full YAML content' } }, required: ['filePath', 'content'] } },
    { name: 'run_test_case', description: 'Run a test case through the engine. Returns pass/fail per step + screenshot paths on failure.', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, profile: { type: 'string' } }, required: ['filePath'] } },
    { name: 'run_test_suite', description: 'Run all tests in a suite', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, profile: { type: 'string' } }, required: ['filePath'] } },
    { name: 'create_test_suite', description: 'Create a new test suite grouping test cases', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, testCasePaths: { type: 'array', items: { type: 'string' } } }, required: ['filePath', 'name'] } },
    { name: 'get_screenshot', description: 'Get failure screenshot as base64 image for visual diagnosis', inputSchema: { type: 'object', properties: { screenshotPath: { type: 'string' } }, required: ['screenshotPath'] } },
    { name: 'search_in_codebase', description: 'Search for text/pattern across source files. Find selectors, API routes, component names, existing test patterns.', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, fileExtensions: { type: 'array', items: { type: 'string' } }, searchPath: { type: 'string' }, maxResults: { type: 'number' } }, required: ['pattern'] } },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const a = (args ?? {}) as Record<string, unknown>

  try {
    switch (name) {
      case 'list_test_cases': {
        const files = await findFiles(projectPath, (f) => f.endsWith('.test.yaml') || f.endsWith('.test.yml'))
        return { content: [{ type: 'text', text: files.map((f) => path.relative(projectPath, f)).join('\n') }] }
      }

      case 'list_test_suites': {
        const files = await findFiles(projectPath, (f) => f.endsWith('.suite.yaml') || f.endsWith('.suite.yml'))
        return { content: [{ type: 'text', text: files.map((f) => path.relative(projectPath, f)).join('\n') }] }
      }

      case 'list_profiles': {
        const dir = path.join(projectPath, 'profiles')
        const entries = await fs.readdir(dir).catch(() => [] as string[])
        const profiles = []
        for (const entry of entries.filter((e) => e.endsWith('.env.json'))) {
          try {
            const p = JSON.parse(await fs.readFile(path.join(dir, entry), 'utf-8'))
            profiles.push({
              name: p.name ?? entry.replace('.env.json', ''),
              file: entry,
              variables: Object.fromEntries(Object.entries(p.variables ?? {}).map(([k, v]) => [k, /token|secret|password|key|auth/i.test(k) ? '***' : v])),
            })
          } catch { /* skip */ }
        }
        return { content: [{ type: 'text', text: JSON.stringify(profiles, null, 2) }] }
      }

      case 'list_object_repositories': {
        const repos = await loadObjectRepos()
        const summary = repos.map((r) => ({
          name: r.name,
          objects: (r.objects ?? []).map((o) => ({ name: o.name, locators: (o.locators ?? []).map((l) => `${l.strategy}=${l.value}`) })),
        }))
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
      }

      case 'read_test_case': {
        const raw = await fs.readFile(String(a.filePath), 'utf-8')
        return { content: [{ type: 'text', text: raw }] }
      }

      case 'write_test_case': {
        const filePath = String(a.filePath)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, String(a.content), 'utf-8')
        return { content: [{ type: 'text', text: `Written: ${filePath}` }] }
      }

      case 'run_test_case': {
        const result = await runTC(String(a.filePath), a.profile ? String(a.profile) : undefined)
        const failed = result.steps.filter((s) => s.status === 'failed')
        return {
          content: [{
            type: 'text', text: JSON.stringify({
              passed: result.passed,
              steps: result.steps.length,
              failedSteps: failed.map((s) => ({ step: s.stepIndex + 1, message: s.message, screenshotPath: s.screenshotPath })),
            }, null, 2),
          }],
          isError: !result.passed,
        }
      }

      case 'run_test_suite': {
        const raw = await fs.readFile(String(a.filePath), 'utf-8')
        const suite = yamlParse(raw) as { items?: Array<{ path: string }> }
        const items = suite.items ?? []
        const results = []
        for (const item of items) {
          const tcPath = path.isAbsolute(item.path) ? item.path : path.resolve(projectPath, item.path)
          try {
            const r = await runTC(tcPath, a.profile ? String(a.profile) : undefined)
            results.push({ file: item.path, passed: r.passed, failedSteps: r.steps.filter((s) => s.status === 'failed').map((s) => ({ step: s.stepIndex + 1, message: s.message })) })
          } catch (err) {
            results.push({ file: item.path, passed: false, failedSteps: [{ message: String(err) }] })
          }
        }
        const passing = results.filter((r) => r.passed).length
        return { content: [{ type: 'text', text: JSON.stringify({ passing, total: results.length, results }, null, 2) }], isError: passing !== results.length }
      }

      case 'create_test_suite': {
        const items = ((a.testCasePaths as string[] | undefined) ?? []).map((p) => ({ path: path.relative(projectPath, p) }))
        const suite = { schemaVersion: 1, id: crypto.randomUUID(), name: String(a.name), description: a.description ? String(a.description) : '', items, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        const filePath = String(a.filePath)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, yamlStringify(suite), 'utf-8')
        return { content: [{ type: 'text', text: `Suite created: ${filePath}` }] }
      }

      case 'get_screenshot': {
        const buf = await fs.readFile(String(a.screenshotPath))
        return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: 'image/png' }] }
      }

      case 'search_in_codebase': {
        const { execSync } = await import('node:child_process')
        const pattern = String(a.pattern)
        const exts = (a.fileExtensions as string[] | undefined) ?? ['ts', 'tsx', 'js', 'jsx', 'vue', 'svelte', 'py', 'yaml', 'yml', 'json']
        const maxResults = typeof a.maxResults === 'number' ? a.maxResults : 50
        const searchRoot = a.searchPath ? String(a.searchPath) : projectPath
        const includeFlags = exts.map((e: string) => `--include="*.${e}"`).join(' ')
        const excludeDirs = ['node_modules', '.git', '.autotest', 'dist', 'build', '.next', 'reports']
          .map((d: string) => `--exclude-dir="${d}"`).join(' ')
        try {
          const cmd = `grep -rn ${excludeDirs} ${includeFlags} -E "${pattern.replace(/"/g, '\\"')}" "${searchRoot}" 2>/dev/null | head -${maxResults}`
          const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim()
          const lines = output ? output.split('\n').length : 0
          return { content: [{ type: 'text', text: output ? `[${lines} matches]\n${output}` : `No matches found for: ${pattern}` }] }
        } catch (execErr) {
          const msg = execErr instanceof Error ? execErr.message : String(execErr)
          if (msg.includes('status 1') || (execErr as NodeJS.ErrnoException).status === 1) {
            return { content: [{ type: 'text', text: `No matches found for: ${pattern}` }] }
          }
          throw execErr
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
