import type { KeywordDef, PageKeywordExecutor } from '../types'

const waitMsFn: PageKeywordExecutor = async ({ page, input, interpolate }) => {
  await page.waitForTimeout(parseInt(interpolate(input), 10))
}
const waitForElementFn: PageKeywordExecutor = async ({ page, objectRef, input, resolveLocator, interpolate }) => {
  const s = await resolveLocator(objectRef)
  const timeout = input ? parseInt(interpolate(input), 10) : 30000
  await page.waitForSelector(s, { state: 'visible', timeout })
}
const waitForVisibleFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.waitForSelector(s, { state: 'visible' })
}

export const waitKeywords: KeywordDef[] = [
  {
    name: 'wait-ms',
    label: 'Wait',
    color: 'bg-slate-500',
    description: 'Wait for specified milliseconds',
    platforms: ['web', 'mobile', 'desktop'],
    params: [{ name: 'input', description: 'Milliseconds to wait', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Milliseconds',
    executors: { web: waitMsFn, mobile: waitMsFn, desktop: waitMsFn },
  },
  {
    name: 'wait',
    label: 'Wait',
    color: 'bg-slate-500',
    description: 'Wait for specified milliseconds (alias for wait-ms)',
    platforms: ['web', 'mobile', 'desktop'],
    params: [{ name: 'input', description: 'Milliseconds to wait', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Milliseconds',
    executors: { web: waitMsFn, mobile: waitMsFn, desktop: waitMsFn },
  },
  {
    name: 'wait-for-element',
    label: 'Wait For Element',
    color: 'bg-cyan-600',
    description: 'Wait for element to become visible',
    platforms: ['web', 'mobile', 'desktop'],
    params: [
      { name: 'objectRef', description: 'CSS selector or object reference', required: true },
      { name: 'input', description: 'Timeout in ms (default 30000)', required: false },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    inputPlaceholder: 'Timeout ms',
    executors: { web: waitForElementFn, mobile: waitForElementFn, desktop: waitForElementFn },
  },
  {
    name: 'wait-for-visible',
    label: 'Wait For Visible',
    color: 'bg-cyan-700',
    description: 'Wait for element to be visible',
    platforms: ['web', 'mobile', 'desktop'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: waitForVisibleFn, mobile: waitForVisibleFn, desktop: waitForVisibleFn },
  },
]
