export interface TestStep {
  id: string
  name?: string
  keyword: string
  description: string
  objectRef: string
  input: string
  expected: string
  enabled: boolean
  continueOnFailure: boolean
  timeout: number | null
}

export interface TestCase {
  schemaVersion: number
  id: string
  name: string
  description: string
  owner?: string
  tags?: string[]
  platform?: 'web' | 'mobile' | 'desktop' | 'api' | 'appium'
  runner?: 'playwright' | 'maestro' | 'appium' | 'api'
  app?: {
    id?: string
    env?: string
    path?: string
  }
  config?: {
    timeoutMs?: number | null
    retry?: number
    stepDelayMs?: number | null
  }
  variables?: Record<string, string>
  dataFile?: string
  stepDelayMs?: number | null
  steps: TestStep[]
  createdAt?: string
  updatedAt?: string
}
