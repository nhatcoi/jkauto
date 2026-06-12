import type { KeywordDef, PageKeywordExecutor } from '../types'

const screenshotFn: PageKeywordExecutor = async ({ page }) => {
  await page.screenshot()
}

export const screenshotKeywords: KeywordDef[] = [
  {
    name: 'take-screenshot',
    label: 'Take Screenshot',
    color: 'bg-zinc-600',
    description: 'Take a screenshot',
    platforms: ['web', 'mobile', 'desktop'],
    params: [],
    hasObject: false,
    hasInput: false,
    hasExpected: false,
    executors: { web: screenshotFn, mobile: screenshotFn, desktop: screenshotFn },
  },
]
