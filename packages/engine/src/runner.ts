import { chromium } from '@playwright/test'
import type { TestCase, Profile } from '@jkauto/core'
import type { StepEvent, RunCompleteEvent } from '@jkauto/core'
import { getKeyword } from './keywords/registry'

export type StepEventCallback = (event: StepEvent) => void
export type RunCompleteCallback = (event: RunCompleteEvent) => void

export async function runTestCase(
  testCase: TestCase,
  profile: Profile,
  runId: string,
  onStep: StepEventCallback,
  onComplete: RunCompleteCallback,
  signal?: AbortSignal,
): Promise<void> {
  const startTime = Date.now()
  let passedSteps = 0
  let failedSteps = 0

  const variables = profile.variables

  function interpolate(value: string): string {
    return value.replace(/\$\{(\w+)\}/g, (_, key) => variables[key] ?? `\${${key}}`)
  }

  async function resolveLocator(ref: string): Promise<string> {
    if (!ref) return ''
    return ref
  }

  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    for (let i = 0; i < testCase.steps.length; i++) {
      if (signal?.aborted) break

      const step = testCase.steps[i]
      if (!step.enabled) {
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'skipped' })
        continue
      }

      onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'running' })

      const keyword = getKeyword(step.keyword)
      if (!keyword) {
        onStep({
          runId,
          testCaseId: testCase.id,
          stepIndex: i,
          status: 'failed',
          message: `Unknown keyword: ${step.keyword}`,
        })
        failedSteps++
        if (!step.continueOnFailure) break
        continue
      }

      const timeout = step.timeout ?? 30000
      try {
        await Promise.race([
          keyword.execute({ page, objectRef: step.objectRef, input: step.input, expected: step.expected, resolveLocator, interpolate }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
        ])
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'passed' })
        passedSteps++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'failed', message })
        failedSteps++
        if (!step.continueOnFailure) break
      }
    }
  } finally {
    await browser.close()
  }

  onComplete({
    runId,
    status: failedSteps > 0 ? 'failed' : signal?.aborted ? 'stopped' : 'passed',
    totalSteps: testCase.steps.length,
    passedSteps,
    failedSteps,
    durationMs: Date.now() - startTime,
  })
}
