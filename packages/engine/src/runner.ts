import { chromium } from '@playwright/test'
import type { TestCase, Profile } from '@jkauto/core'
import type { StepEvent, RunCompleteEvent } from '@jkauto/core'
import { getKeyword } from './keywords/registry'

export type StepEventCallback = (event: StepEvent) => void
export type RunCompleteCallback = (event: RunCompleteEvent) => void

export interface RunOptions {
  headless?: boolean
  stepDelay?: number
  waitForNext?: (stepIndex: number) => Promise<void>
}

export async function runTestCase(
  testCase: TestCase,
  profile: Profile,
  runId: string,
  onStep: StepEventCallback,
  onComplete: RunCompleteCallback,
  signal?: AbortSignal,
  options: RunOptions = {},
): Promise<void> {
  const { headless = false, stepDelay = 0, waitForNext } = options
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

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext()
  const page = await context.newPage()

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

      const stepStart = Date.now()
      const timeout = step.timeout ?? 30000
      try {
        await Promise.race([
          keyword.execute({ page, objectRef: step.objectRef, input: step.input, expected: step.expected, resolveLocator, interpolate }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Step timeout after ${timeout}ms`)), timeout),
          ),
        ])
        onStep({
          runId,
          testCaseId: testCase.id,
          stepIndex: i,
          status: 'passed',
          durationMs: Date.now() - stepStart,
        })
        passedSteps++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        onStep({
          runId,
          testCaseId: testCase.id,
          stepIndex: i,
          status: 'failed',
          message,
          durationMs: Date.now() - stepStart,
        })
        failedSteps++
        if (!step.continueOnFailure) break
      }

      if (waitForNext && !signal?.aborted) {
        await waitForNext(i)
      } else if (stepDelay > 0 && !signal?.aborted) {
        await new Promise((r) => setTimeout(r, stepDelay))
      }
    }
  } finally {
    await browser.close()
  }

  const finalStatus = signal?.aborted ? 'stopped' : failedSteps > 0 ? 'failed' : 'passed'

  onComplete({
    runId,
    status: finalStatus,
    totalSteps: testCase.steps.length,
    passedSteps,
    failedSteps,
    durationMs: Date.now() - startTime,
  })
}
