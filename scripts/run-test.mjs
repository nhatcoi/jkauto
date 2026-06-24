#!/usr/bin/env node
/**
 * CLI test runner — runs a single JKAuto test case or test suite from terminal.
 *
 * Usage:
 *   node scripts/run-test.mjs <testcase-or-suite.yaml> [project-dir] [profile-name]
 *
 * Examples:
 *   node scripts/run-test.mjs "PROJECTS/ECM PROJECT/test-cases/ecm-ui/auth/ui-login-valid.test.yaml" "PROJECTS/ECM PROJECT"
 *   node scripts/run-test.mjs "PROJECTS/ECM PROJECT/test-suites/ecm-ui-smoke.suite.yaml" "PROJECTS/ECM PROJECT"
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { parse as yamlParse } from 'yaml'
import { runTestCase } from '@jkauto/engine'

const ROOT = '/Users/coinhat/Documents/jkauto'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

const [, , tcArg, projectArg, profileName = 'default'] = process.argv
if (!tcArg) {
  console.error('Usage: node scripts/run-test.mjs <testcase.yaml> [project-dir] [profile-name]')
  process.exit(1)
}

const tcPath = path.resolve(ROOT, tcArg)
const projectPath = projectArg ? path.resolve(ROOT, projectArg) : path.dirname(tcPath)

async function loadProfile(projPath, name) {
  const candidates = [
    path.join(projPath, 'profiles', `${name}.env.json`),
    path.join(projPath, 'profiles', `${name}.json`),
  ]
  for (const f of candidates) {
    try {
      const raw = await fs.readFile(f, 'utf-8')
      return JSON.parse(raw)
    } catch { /* try next */ }
  }
  console.warn(`${YELLOW}[warn] profile "${name}" not found, using empty profile${RESET}`)
  return { variables: {} }
}

async function loadObjectRepositories(projPath) {
  const repos = []
  for (const dir of ['object-repository', 'api-request']) {
    const repoDir = path.join(projPath, dir)
    try {
      const entries = await fs.readdir(repoDir)
      for (const entry of entries) {
        if (!entry.endsWith('.objects.json')) continue
        try {
          const raw = await fs.readFile(path.join(repoDir, entry), 'utf-8')
          repos.push(JSON.parse(raw))
        } catch { /* skip */ }
      }
    } catch { /* dir missing */ }
  }
  return repos
}

function normalizeStep(step) {
  return {
    id: step.id ?? randomUUID(),
    name: step.name ?? '',
    keyword: step.keyword ?? '',
    description: step.description ?? '',
    objectRef: step.objectRef ?? '',
    input: step.input ?? '',
    expected: step.expected ?? '',
    enabled: step.enabled ?? true,
    continueOnFailure: step.continueOnFailure ?? false,
    timeout: step.timeout ?? null,
  }
}

function normalizeTestCase(tcData) {
  const platform = tcData.platform
  const runner = tcData.runner ?? (platform === 'api' ? 'api' : 'playwright')
  return {
    schemaVersion: 1,
    id: tcData.id ?? randomUUID(),
    name: tcData.name ?? 'Unnamed',
    description: tcData.description ?? '',
    owner: tcData.owner ?? '',
    tags: tcData.tags ?? [],
    platform,
    runner,
    app: { id: '', env: '', path: '' },
    config: { timeoutMs: null, retry: 0, stepDelayMs: null },
    variables: tcData.variables ?? {},
    stepDelayMs: tcData.stepDelayMs ?? null,
    steps: (tcData.steps ?? []).map(normalizeStep),
    createdAt: tcData.createdAt ?? new Date().toISOString(),
    updatedAt: tcData.updatedAt ?? new Date().toISOString(),
  }
}

async function readTestCase(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8')
  return normalizeTestCase(yamlParse(raw))
}

async function runSingle(filePath, profile, objectRepositories) {
  const tc = await readTestCase(filePath)
  const runId = randomUUID()
  console.log(`\n${BOLD}${CYAN}▶ ${tc.name}${RESET}  ${DIM}(${path.relative(ROOT, filePath)})${RESET}`)

  let passed = 0, failed = 0

  await runTestCase(
    tc,
    profile,
    runId,
    (evt) => {
      if (evt.status === 'passed') {
        passed++
        console.log(`  ${GREEN}✓${RESET} Step ${evt.stepIndex + 1} passed ${DIM}(${evt.durationMs}ms)${RESET}`)
      } else if (evt.status === 'failed') {
        failed++
        console.log(`  ${RED}✗${RESET} Step ${evt.stepIndex + 1} FAILED — ${evt.message ?? ''}`)
      } else if (evt.status === 'running') {
        const step = tc.steps[evt.stepIndex]
        process.stdout.write(`  ${DIM}→ Step ${evt.stepIndex + 1} [${step?.keyword ?? ''}] ${step?.description || step?.objectRef || ''}...${RESET}\r`)
      }
    },
    (evt) => {
      const icon = evt.status === 'passed' ? `${GREEN}✅ PASSED${RESET}` : `${RED}❌ FAILED${RESET}`
      console.log(`  ${icon} — ${passed}/${passed + failed} steps passed (${evt.durationMs}ms)\n`)
    },
    undefined,
    { headless: process.env.HEADLESS !== '0', objectRepositories, screenshotDir: '/tmp/jkauto-debug', screenshotMode: 'failure', loadTestCase: (p) => readTestCase(path.resolve(path.dirname(filePath), p)) }
  )

  return { passed, failed }
}

async function main() {
  const profile = await loadProfile(projectPath, profileName)
  const objectRepositories = await loadObjectRepositories(projectPath)

  console.log(`${BOLD}Project:${RESET} ${projectPath}`)
  console.log(`${BOLD}Profile:${RESET} ${profileName} (${Object.keys(profile.variables ?? {}).length} vars)`)
  console.log(`${BOLD}Object repos:${RESET} ${objectRepositories.length} loaded`)

  // Detect if it's a suite
  const raw = await fs.readFile(tcPath, 'utf-8')
  const parsed = yamlParse(raw)

  let totalPassed = 0, totalFailed = 0

  if (parsed.items) {
    // It's a suite
    console.log(`\n${BOLD}Suite: ${parsed.name}${RESET} (${parsed.items.length} test cases)\n`)
    const suiteProfileName = parsed.profile ?? profileName
    const suiteProfile = await loadProfile(projectPath, suiteProfileName)
    const enabledItems = parsed.items.filter(i => i.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    for (const item of enabledItems) {
      const itemPath = path.resolve(projectPath, item.testCasePath)
      const { passed, failed } = await runSingle(itemPath, suiteProfile, objectRepositories)
      totalPassed += passed
      totalFailed += failed
      if (failed > 0 && !parsed.continueOnFailure) {
        console.log(`${RED}Suite stopped (continueOnFailure=false)${RESET}`)
        break
      }
    }
    const suiteIcon = totalFailed === 0 ? `${GREEN}✅ SUITE PASSED${RESET}` : `${RED}❌ SUITE FAILED${RESET}`
    console.log(`${BOLD}${suiteIcon}${RESET} — ${totalPassed}/${totalPassed + totalFailed} steps total`)
  } else {
    // Single test case
    const { passed, failed } = await runSingle(tcPath, profile, objectRepositories)
    totalPassed = passed
    totalFailed = failed
  }

  process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(`${RED}Fatal:${RESET}`, err)
  process.exit(1)
})
