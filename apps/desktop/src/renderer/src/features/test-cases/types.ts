export interface TestStep {
  id: string
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
  platform?: 'web' | 'mobile' | 'desktop' | 'api'
  device?: string
  steps: TestStep[]
}
