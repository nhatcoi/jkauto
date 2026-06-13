import type { KeywordDef } from '../types'

const noop = async () => {}

export const callTestCaseKeyword: KeywordDef = {
  name: 'call-test-case',
  label: 'Call Test Case',
  color: 'bg-cyan-600',
  description: 'Execute another test case inline, reusing the current session',
  platforms: ['web', 'mobile', 'desktop', 'api', 'appium'],
  params: [{ name: 'input', description: 'Absolute path to the test case file', required: true }],
  hasObject: false,
  hasInput: true,
  hasExpected: false,
  inputPlaceholder: '/path/to/test-cases/login.test.json',
  executors: { web: noop, mobile: noop, desktop: noop, api: noop, appium: noop },
}
