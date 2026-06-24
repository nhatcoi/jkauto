import type { RunReport } from './types.js'

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const SKIP = '\x1b[33m-\x1b[0m'
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`
const RED = (s: string) => `\x1b[31m${s}\x1b[0m`
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`

export function printReport(report: RunReport): void {
  const { testCases, passed, failed, total, durationMs, suiteName, projectName, profile } = report

  console.log()
  console.log(BOLD(`jkauto — ${projectName}`) + DIM(` [${profile}]`) + (suiteName ? DIM(` / ${suiteName}`) : ''))
  console.log()

  for (const tc of testCases) {
    const icon = tc.status === 'passed' ? PASS : FAIL
    const dur = DIM(`(${tc.durationMs}ms)`)
    console.log(`  ${icon} ${tc.testCaseName} ${dur}`)

    if (tc.status !== 'passed') {
      for (const step of tc.steps) {
        if (step.status === 'failed') {
          console.log(`     ${FAIL} Step ${step.stepIndex + 1}: ${step.keyword}`)
          if (step.message) console.log(`        ${RED(step.message)}`)
          if (step.screenshotPath) console.log(DIM(`        screenshot: ${step.screenshotPath}`))
        }
      }
    }
  }

  console.log()
  const summary = `${total} tests: ${passed} passed, ${failed} failed  ${DIM(`(${durationMs}ms)`)}`
  console.log(failed > 0 ? RED(summary) : GREEN(summary))
  console.log()
}

export function printStep(
  testCaseName: string,
  stepIndex: number,
  keyword: string,
  status: 'running' | 'passed' | 'failed' | 'skipped',
  message?: string,
): void {
  const icon = status === 'passed' ? PASS : status === 'failed' ? FAIL : status === 'skipped' ? SKIP : '…'
  const label = DIM(`[${testCaseName}]`)
  const step = `step ${stepIndex + 1}: ${keyword}`
  process.stdout.write(`  ${icon} ${label} ${step}${message ? ' — ' + RED(message) : ''}\n`)
}
