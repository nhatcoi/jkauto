import type { KeywordDef, PageKeywordExecutor, AppiumKeywordExecutor } from '../types'

const navigateFn: PageKeywordExecutor = async ({ page, input, interpolate }) => {
  await page.goto(interpolate(input))
}

// Appium navigate-to opens a deep link URL (e.g. myapp://screen) or web URL in a WebView.
const appiumNavigateFn: AppiumKeywordExecutor = async ({ driver, input, interpolate }) => {
  await driver.url(interpolate(input))
}

export const navigationKeywords: KeywordDef[] = [
  {
    name: 'navigate-to',
    label: 'Navigate To',
    color: 'bg-blue-600',
    description: 'Navigate to URL or deep link',
    platforms: ['web', 'mobile', 'appium'],
    params: [{ name: 'input', description: 'URL or deep link to navigate to', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'URL or deep link',
    executors: { web: navigateFn, mobile: navigateFn, appium: appiumNavigateFn },
  },
]
