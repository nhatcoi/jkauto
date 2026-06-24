export type StepResult = {
  stepIndex: number
  keyword: string
  name: string
  status: 'passed' | 'failed' | 'skipped'
  message?: string
  durationMs?: number
  screenshotPath?: string
}

export type TestCaseResult = {
  testCaseId: string
  testCaseName: string
  status: 'passed' | 'failed' | 'stopped'
  steps: StepResult[]
  durationMs: number
  startedAt: string
}

export type RunReport = {
  runId: string
  projectName: string
  suiteName?: string
  profile: string
  startedAt: string
  durationMs: number
  total: number
  passed: number
  failed: number
  testCases: TestCaseResult[]
}
