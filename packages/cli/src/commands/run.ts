import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { runTestCase } from '@jkauto/engine'
import type { StepEvent, RunCompleteEvent } from '@jkauto/core'
import {
  loadProject,
  loadProfile,
  loadObjectRepositories,
  findTestCase,
  findSuite,
  loadTestCaseByPath,
} from '../loader/project.js'
import { printReport, printStep } from '../reporters/console.js'
import { toJUnitXml } from '../reporters/junit.js'
import { toJsonReport } from '../reporters/json-reporter.js'
import type { RunReport, TestCaseResult, StepResult } from '../reporters/types.js'
import type { TestCase } from '@jkauto/core'

export type RunOptions = {
  project: string
  suite?: string
  testCase?: string
  profile: string
  headless: boolean
  reporter: 'console' | 'junit' | 'json'
  output?: string
  screenshotDir?: string
  continueOnFailure: boolean
  verbose: boolean
}

type PendingRun = {
  tc: TestCase
  filePath: string
}

export async function runCommand(opts: RunOptions): Promise<void> {
  const projectRoot = path.resolve(opts.project)
  const { project } = await loadProject(projectRoot)
  const fmt = project.format
  const profile = await loadProfile(projectRoot, opts.profile, fmt)
  const repos = await loadObjectRepositories(projectRoot, fmt)

  const pendingRuns: PendingRun[] = []

  if (opts.suite) {
    const suite = await findSuite(projectRoot, opts.suite, fmt)
    for (const item of suite.items) {
      if (!item.enabled) continue
      const tcPath = path.isAbsolute(item.testCasePath)
        ? item.testCasePath
        : path.join(projectRoot, item.testCasePath)
      const tc = await loadTestCaseByPath(tcPath, fmt)
      pendingRuns.push({ tc, filePath: tcPath })
    }
  } else if (opts.testCase) {
    const { tc, filePath } = await findTestCase(projectRoot, opts.testCase, fmt)
    pendingRuns.push({ tc, filePath })
  } else {
    console.error('Error: --suite or --test-case required')
    process.exit(2)
  }

  const screenshotDir = opts.screenshotDir
    ? path.resolve(opts.screenshotDir)
    : undefined

  const runId = randomUUID()
  const startedAt = new Date().toISOString()
  const runStart = Date.now()
  const tcResults: TestCaseResult[] = []

  let anyFailed = false

  for (const { tc } of pendingRuns) {
    const tcStart = Date.now()
    const tcRunId = `${runId}-${tc.id}`
    const stepResults: StepResult[] = []
    let stepMap: Map<number, StepResult> = new Map()

    await runTestCase(
      tc,
      profile,
      tcRunId,
      (event: StepEvent) => {
        const step = tc.steps[event.stepIndex]
        if (!step) return

        if (event.status === 'running') {
          if (opts.verbose) {
            printStep(tc.name, event.stepIndex, step.keyword, 'running')
          }
          stepMap.set(event.stepIndex, {
            stepIndex: event.stepIndex,
            keyword: step.keyword,
            name: step.name,
            status: 'passed',
          })
          return
        }

        const existing = stepMap.get(event.stepIndex) ?? {
          stepIndex: event.stepIndex,
          keyword: step.keyword,
          name: step.name,
          status: 'passed' as const,
        }

        const updated: StepResult = {
          ...existing,
          status: event.status === 'passed' ? 'passed' : event.status === 'skipped' ? 'skipped' : 'failed',
          message: event.message,
          durationMs: event.durationMs,
          screenshotPath: event.screenshotPath,
        }
        stepMap.set(event.stepIndex, updated)

        if (opts.reporter === 'console') {
          printStep(tc.name, event.stepIndex, step.keyword, updated.status, event.message)
        }
      },
      (event: RunCompleteEvent) => {
        if (event.status !== 'passed') anyFailed = true
      },
      undefined,
      {
        headless: opts.headless,
        objectRepositories: repos,
        screenshotDir,
        loadTestCase: async (p: string) => {
          const resolved = path.isAbsolute(p) ? p : path.join(projectRoot, p)
          return loadTestCaseByPath(resolved, fmt)
        },
      },
    )

    stepResults.push(...Array.from(stepMap.values()))

    const passed = stepResults.every((s) => s.status !== 'failed')
    tcResults.push({
      testCaseId: tc.id,
      testCaseName: tc.name,
      status: passed ? 'passed' : 'failed',
      steps: stepResults,
      durationMs: Date.now() - tcStart,
      startedAt: new Date(tcStart).toISOString(),
    })

    if (!passed && !opts.continueOnFailure) break
  }

  const report: RunReport = {
    runId,
    projectName: project.name,
    suiteName: opts.suite,
    profile: opts.profile,
    startedAt,
    durationMs: Date.now() - runStart,
    total: tcResults.length,
    passed: tcResults.filter((r) => r.status === 'passed').length,
    failed: tcResults.filter((r) => r.status === 'failed').length,
    testCases: tcResults,
  }

  await writeReport(report, opts)

  process.exit(anyFailed ? 1 : 0)
}

async function writeReport(report: RunReport, opts: RunOptions): Promise<void> {
  if (opts.reporter === 'junit') {
    const xml = toJUnitXml(report)
    if (opts.output) {
      await fs.mkdir(path.dirname(path.resolve(opts.output)), { recursive: true })
      await fs.writeFile(path.resolve(opts.output), xml, 'utf-8')
      console.log(`JUnit report written to ${opts.output}`)
    } else {
      console.log(xml)
    }
    printReport(report)
  } else if (opts.reporter === 'json') {
    const json = toJsonReport(report)
    if (opts.output) {
      await fs.mkdir(path.dirname(path.resolve(opts.output)), { recursive: true })
      await fs.writeFile(path.resolve(opts.output), json, 'utf-8')
      console.log(`JSON report written to ${opts.output}`)
    } else {
      console.log(json)
    }
    printReport(report)
  } else {
    printReport(report)
  }
}
