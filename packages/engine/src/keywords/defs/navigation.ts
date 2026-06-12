import type { KeywordDef, PageKeywordExecutor } from '../types'

const navigateFn: PageKeywordExecutor = async ({ page, input, interpolate }) => {
  await page.goto(interpolate(input))
}

export const navigationKeywords: KeywordDef[] = [
  {
    name: 'navigate-to',
    label: 'Navigate To',
    color: 'bg-blue-600',
    description: 'Navigate browser to URL',
    platforms: ['web', 'mobile'],
    params: [{ name: 'input', description: 'URL to navigate to', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'URL',
    executors: { web: navigateFn, mobile: navigateFn },
  },
]
