/**
 * JKAuto CLI Agent Chat
 * Usage: ./scripts/agent-chat.sh "PROJECTS/ECM PROJECT" [model]
 *   model: v1 (default), cc/claude-sonnet-4-6, cc/claude-opus-4-8, etc.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import crypto from 'node:crypto'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

const ROOT = path.resolve(import.meta.dirname, '..')
const projectRelPath = process.argv[2] ?? 'PROJECTS/ECM PROJECT'
const MODEL = process.argv[3] ?? 'v1'
const BASE_URL = process.env.AGENT_BASE_URL ?? 'http://127.0.0.1:20128/v1'
const API_KEY = process.env.AGENT_API_KEY ?? 'local'

const projectPath = path.isAbsolute(projectRelPath)
  ? projectRelPath
  : path.resolve(ROOT, projectRelPath)

// ── ANSI ──────────────────────────────────────────────────
const R = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m'
const CYAN = '\x1b[36m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m', BLUE = '\x1b[34m'

// ── Project context ────────────────────────────────────────
const SKIP_DIRS = new Set(['.autotest', '.git', 'node_modules', 'reports'])

async function findFiles(dir, predicate) {
  const results = []
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(path.join(d, e.name)) }
      else if (predicate(e.name)) results.push(path.join(d, e.name))
    }
  }
  await walk(dir)
  return results
}

async function buildProjectContext() {
  const parts = []

  // project.json
  try {
    const proj = JSON.parse(await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8'))
    parts.push(`## Project\nName: ${proj.name}\nType: ${proj.type}\nFormat: ${proj.format ?? 'json'}`)
  } catch { /* no project.json */ }

  // Profiles
  const profileDir = path.join(projectPath, 'profiles')
  const profileEntries = await fs.readdir(profileDir).catch(() => [])
  const profileInfos = []
  for (const entry of profileEntries.filter(e => e.endsWith('.env.json'))) {
    try {
      const p = JSON.parse(await fs.readFile(path.join(profileDir, entry), 'utf-8'))
      const vars = p.variables ?? {}
      profileInfos.push({
        name: p.name ?? entry.replace('.env.json', ''), file: entry,
        variables: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, /token|secret|password|key|auth/i.test(k) ? '***' : v]))
      })
    } catch { /* skip */ }
  }
  if (profileInfos.length) parts.push(`## Profiles\n${JSON.stringify(profileInfos, null, 2)}`)

  // Object repos
  const objRepos = []
  for (const dir of ['object-repository', 'api-request']) {
    const repoDir = path.join(projectPath, dir)
    const entries = await fs.readdir(repoDir).catch(() => [])
    for (const entry of entries.filter(e => e.endsWith('.objects.json'))) {
      try {
        const r = JSON.parse(await fs.readFile(path.join(repoDir, entry), 'utf-8'))
        objRepos.push({ name: r.name, objects: (r.objects ?? []).map(o => ({ name: o.name, locators: (o.locators ?? []).map(l => `${l.strategy}=${l.value}`) })) })
      } catch { /* skip */ }
    }
  }
  if (objRepos.length) parts.push(`## Object Repositories\n${JSON.stringify(objRepos, null, 2)}`)

  // Test cases (paths only)
  const tcFiles = await findFiles(path.join(projectPath, 'test-cases'), f => f.endsWith('.test.yaml') || f.endsWith('.test.yml'))
  if (tcFiles.length) parts.push(`## Test Cases (${tcFiles.length})\n${tcFiles.map(f => '  - ' + path.relative(projectPath, f)).join('\n')}`)

  // Suites
  const suiteFiles = await findFiles(path.join(projectPath, 'test-suites'), f => f.endsWith('.suite.yaml') || f.endsWith('.suite.yml'))
  if (suiteFiles.length) parts.push(`## Test Suites\n${suiteFiles.map(f => '  - ' + path.relative(projectPath, f)).join('\n')}`)

  return parts.join('\n\n')
}

// ── Tools ─────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function', function: {
      name: 'list_test_cases',
      description: 'List all test case files in the project',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function', function: {
      name: 'list_profiles',
      description: 'List env profiles with variables (secrets masked)',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function', function: {
      name: 'list_object_repositories',
      description: 'List object repos and selectors',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function', function: {
      name: 'read_test_case',
      description: 'Read a test case file',
      parameters: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] }
    }
  },
  {
    type: 'function', function: {
      name: 'write_test_case',
      description: 'Write/create a test case YAML file',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute or relative-to-project path' },
          content: { type: 'string', description: 'Full YAML content' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function', function: {
      name: 'run_test_case',
      description: 'Run a test case through Playwright engine. Returns per-step results and screenshot paths on failure. Use in fix-loop.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          profile: { type: 'string', description: 'Profile name (default: default)' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function', function: {
      name: 'create_test_suite',
      description: 'Create a new test suite grouping multiple test cases',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          testCasePaths: { type: 'array', items: { type: 'string' } }
        },
        required: ['filePath', 'name']
      }
    }
  },
  {
    type: 'function', function: {
      name: 'get_screenshot',
      description: 'Get failure screenshot path info for a recent test run',
      parameters: {
        type: 'object',
        properties: { screenshotPath: { type: 'string' } },
        required: ['screenshotPath']
      }
    }
  },
]

// ── Tool execution ─────────────────────────────────────────
async function executeTool(name, args) {
  try {
    switch (name) {
      case 'list_test_cases': {
        const files = await findFiles(path.join(projectPath, 'test-cases'), f => f.endsWith('.test.yaml') || f.endsWith('.test.yml'))
        return files.map(f => path.relative(projectPath, f)).join('\n') || 'No test cases found'
      }

      case 'list_profiles': {
        const dir = path.join(projectPath, 'profiles')
        const entries = await fs.readdir(dir).catch(() => [])
        const profiles = []
        for (const entry of entries.filter(e => e.endsWith('.env.json'))) {
          try {
            const p = JSON.parse(await fs.readFile(path.join(dir, entry), 'utf-8'))
            profiles.push({ name: p.name ?? entry.replace('.env.json', ''), file: entry, variables: Object.fromEntries(Object.entries(p.variables ?? {}).map(([k, v]) => [k, /token|secret|password|key|auth/i.test(k) ? '***' : v])) })
          } catch { /* skip */ }
        }
        return JSON.stringify(profiles, null, 2)
      }

      case 'list_object_repositories': {
        const repos = []
        for (const dir of ['object-repository', 'api-request']) {
          const repoDir = path.join(projectPath, dir)
          const entries = await fs.readdir(repoDir).catch(() => [])
          for (const entry of entries.filter(e => e.endsWith('.objects.json'))) {
            try {
              const r = JSON.parse(await fs.readFile(path.join(repoDir, entry), 'utf-8'))
              repos.push({ name: r.name, objects: (r.objects ?? []).map(o => ({ name: o.name, locators: (o.locators ?? []).map(l => `${l.strategy}=${l.value}`) })) })
            } catch { /* skip */ }
          }
        }
        return JSON.stringify(repos, null, 2)
      }

      case 'read_test_case': {
        const fp = path.isAbsolute(args.filePath) ? args.filePath : path.resolve(projectPath, args.filePath)
        return await fs.readFile(fp, 'utf-8')
      }

      case 'write_test_case': {
        const fp = path.isAbsolute(args.filePath) ? args.filePath : path.resolve(projectPath, args.filePath)
        await fs.mkdir(path.dirname(fp), { recursive: true })
        await fs.writeFile(fp, args.content, 'utf-8')
        return `Written: ${path.relative(projectPath, fp)}`
      }

      case 'run_test_case': {
        // Dynamic import engine at call time (heavy)
        const { runTestCase } = await import('@jkauto/engine')
        const { parse: yParse } = await import('yaml')
        const { z } = await import('zod')

        const fp = path.isAbsolute(args.filePath) ? args.filePath : path.resolve(projectPath, args.filePath)
        const raw = await fs.readFile(fp, 'utf-8')
        const testCase = yParse(raw)

        // Load profile
        const profileDir = path.join(projectPath, 'profiles')
        const profileEntries = await fs.readdir(profileDir).catch(() => [])
        const target = args.profile ? `${args.profile}.env.json` : null
        const candidate = (target && profileEntries.find(e => e === target)) ?? profileEntries.find(e => e === 'default.env.json') ?? profileEntries.find(e => e.endsWith('.env.json'))
        const profile = candidate ? JSON.parse(await fs.readFile(path.join(profileDir, candidate), 'utf-8')) : { schemaVersion: 1, name: 'default', variables: {} }

        // Load object repos
        const objectRepositories = []
        for (const dir of ['object-repository', 'api-request']) {
          const repoDir = path.join(projectPath, dir)
          const entries = await fs.readdir(repoDir).catch(() => [])
          for (const entry of entries.filter(e => e.endsWith('.objects.json'))) {
            try { objectRepositories.push(JSON.parse(await fs.readFile(path.join(repoDir, entry), 'utf-8'))) } catch { /* skip */ }
          }
        }

        const runId = crypto.randomUUID()
        const steps = []
        const screenshotDir = path.join(projectPath, '.autotest', 'screenshots')

        return await new Promise((resolve, reject) => {
          runTestCase(
            testCase, profile, runId,
            (evt) => { if (evt.status !== 'running') steps.push({ step: evt.stepIndex + 1, status: evt.status, message: evt.message, screenshotPath: evt.screenshotPath, durationMs: evt.durationMs }) },
            (evt) => resolve(JSON.stringify({ passed: evt.status === 'passed', steps, totalSteps: steps.length, failedSteps: steps.filter(s => s.status === 'failed') }, null, 2)),
            undefined,
            { headless: true, screenshotDir, screenshotMode: 'failure', objectRepositories, loadTestCase: async (p) => yParse(await fs.readFile(path.isAbsolute(p) ? p : path.resolve(projectPath, p), 'utf-8')) }
          ).catch(reject)
        })
      }

      case 'create_test_suite': {
        const fp = path.isAbsolute(args.filePath) ? args.filePath : path.resolve(projectPath, args.filePath)
        const items = (args.testCasePaths ?? []).map(p => ({ path: path.relative(projectPath, path.isAbsolute(p) ? p : path.resolve(projectPath, p)) }))
        const suite = { schemaVersion: 1, id: crypto.randomUUID(), name: args.name, description: args.description ?? '', items, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        await fs.mkdir(path.dirname(fp), { recursive: true })
        await fs.writeFile(fp, yamlStringify(suite), 'utf-8')
        return `Suite created: ${path.relative(projectPath, fp)} (${items.length} tests)`
      }

      case 'get_screenshot': {
        try {
          await fs.access(args.screenshotPath)
          return `Screenshot exists at: ${args.screenshotPath}\n(Open file to view in image viewer)`
        } catch {
          return `Screenshot not found: ${args.screenshotPath}`
        }
      }

      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ── LLM streaming ──────────────────────────────────────────
async function streamChat(messages) {
  const body = JSON.stringify({
    model: MODEL,
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
    stream: true,
    max_tokens: 4096,
  })

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM error ${res.status}: ${text}`)
  }

  let content = ''
  const toolCalls = {}  // id → { name, arguments }

  process.stdout.write(`${CYAN}${BOLD}Agent: ${R}`)

  for await (const line of res.body) {
    const chunk = Buffer.isBuffer(line) ? line.toString() : String(line)
    for (const part of chunk.split('\n')) {
      const trimmed = part.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') break
      try {
        const delta = JSON.parse(data)
        const choice = delta.choices?.[0]
        if (!choice) continue
        const d = choice.delta

        // Text content
        if (d?.content) {
          content += d.content
          process.stdout.write(d.content)
        }

        // Tool call streaming
        if (d?.tool_calls) {
          for (const tc of d.tool_calls) {
            const id = tc.id ?? String(tc.index ?? 0)
            if (!toolCalls[id]) toolCalls[id] = { name: '', arguments: '' }
            if (tc.function?.name) toolCalls[id].name += tc.function.name
            if (tc.function?.arguments) toolCalls[id].arguments += tc.function.arguments
          }
        }

        if (choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls') break
      } catch { /* skip parse errors */ }
    }
  }

  process.stdout.write('\n')

  return { content, toolCalls: Object.values(toolCalls) }
}

// ── Main chat loop ─────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${BLUE}╔══════════════════════════════════════╗${R}`)
  console.log(`${BOLD}${BLUE}║   JKAuto CLI Agent Chat              ║${R}`)
  console.log(`${BOLD}${BLUE}╚══════════════════════════════════════╝${R}`)
  console.log(`${DIM}Project: ${projectPath}${R}`)
  console.log(`${DIM}Model: ${MODEL} @ ${BASE_URL}${R}`)
  console.log(`${DIM}Type "exit" to quit, "context" to show project context${R}\n`)

  const projectContext = await buildProjectContext()

  const SYSTEM = `You are JKAuto AI, an automation testing assistant.

You have access to a JKAuto test project. Use tools to read, create, and run test cases.

## Project Context
${projectContext}

## Rules
- Use run_test_case to verify tests after creating/editing them
- Use write_test_case to save YAML content directly
- Profiles use \${varName} interpolation (e.g. \${uiBaseUrl}, \${apiBaseUrl})
- Built-in vars: \${__rand} (6-char random), \${__timestamp}
- Always wait-for-element BEFORE clicking/typing
- After form submit, wait-for-element the result or new-doc-btn
- accept-dialog BEFORE clicking Delete button
- Use unique names: DEL_\${__rand}, test_\${__rand}@example.com

## Available keywords (web platform)
navigate-to, wait-for-element, wait-for-element-hidden, wait-ms, click, type-text, assert-visible, assert-hidden, assert-text, accept-dialog, dismiss-dialog, scroll-to, press-key, hover

## YAML step format
keyword: <name>
objectRef: <CSS selector or "text=..." or object repo name>
input: <text to type / URL / timeout ms>
expected: <expected text for assertions>
description: <human label>
`

  const messages = [{ role: 'system', content: SYSTEM }]

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (prompt) => new Promise(resolve => rl.question(prompt, resolve))

  while (true) {
    const userInput = await ask(`\n${BOLD}${GREEN}You: ${R}`)
    const trimmed = userInput.trim()
    if (!trimmed) continue
    if (trimmed === 'exit' || trimmed === 'quit') { console.log('Bye.'); rl.close(); break }
    if (trimmed === 'context') { console.log(`\n${DIM}${projectContext}${R}`); continue }

    messages.push({ role: 'user', content: trimmed })

    // Agentic loop: keep calling until no more tool calls
    let rounds = 0
    while (rounds < 15) {
      rounds++
      const { content, toolCalls } = await streamChat(messages)

      messages.push({ role: 'assistant', content, tool_calls: toolCalls.length ? toolCalls.map((tc, i) => ({ id: tc.name + i, type: 'function', function: { name: tc.name, arguments: tc.arguments } })) : undefined })

      if (!toolCalls.length) break

      // Execute each tool
      for (const tc of toolCalls) {
        let args = {}
        try { args = JSON.parse(tc.arguments || '{}') } catch { /* use empty */ }

        console.log(`\n${YELLOW}  ▶ Tool: ${tc.name}${R} ${DIM}${JSON.stringify(args).slice(0, 80)}${R}`)
        const result = await executeTool(tc.name, args)
        const resultStr = String(result)
        console.log(`${DIM}  ← ${resultStr.slice(0, 200)}${resultStr.length > 200 ? '...' : ''}${R}`)

        messages.push({
          role: 'tool',
          tool_call_id: tc.name + (toolCalls.indexOf(tc)),
          content: resultStr,
        })
      }
    }
  }
}

main().catch(err => { console.error(RED + 'Fatal: ' + err.message + R); process.exit(1) })
