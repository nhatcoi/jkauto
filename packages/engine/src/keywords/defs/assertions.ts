import type { KeywordDef, PageKeywordExecutor, AppiumKeywordExecutor } from '../types'

const assertTextFn: PageKeywordExecutor = async ({ page, objectRef, expected, resolveLocator, interpolate }) => {
  const s = await resolveLocator(objectRef)
  const text = await page.textContent(s)
  const exp = interpolate(expected)
  if (!text?.includes(exp)) throw new Error(`Expected text to contain "${exp}" but got "${text}"`)
}
const assertUrlContainsFn: PageKeywordExecutor = async ({ page, expected, interpolate }) => {
  const exp = interpolate(expected)
  const url = page.url()
  if (!url.includes(exp)) throw new Error(`Expected URL to contain "${exp}" but got "${url}"`)
}
const assertVisibleFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  if (!(await page.isVisible(s))) throw new Error(`Element "${s}" is not visible`)
}
const assertHiddenFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  if (await page.isVisible(s)) throw new Error(`Element "${s}" is visible but expected hidden`)
}
const assertValueFn: PageKeywordExecutor = async ({ page, objectRef, expected, resolveLocator, interpolate }) => {
  const s = await resolveLocator(objectRef)
  const value = await page.inputValue(s)
  const exp = interpolate(expected)
  if (value !== exp) throw new Error(`Expected value "${exp}" but got "${value}"`)
}
const getTextFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.textContent(s)
}

const appiumAssertTextFn: AppiumKeywordExecutor = async ({ driver, objectRef, expected, resolveLocator, interpolate }) => {
  const s = await resolveLocator(objectRef)
  const text = await driver.$(s).getText()
  const exp = interpolate(expected)
  if (!text?.includes(exp)) throw new Error(`Expected text to contain "${exp}" but got "${text}"`)
}
const appiumAssertVisibleFn: AppiumKeywordExecutor = async ({ driver, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  if (!(await driver.$(s).isDisplayed())) throw new Error(`Element "${s}" is not visible`)
}
const appiumAssertHiddenFn: AppiumKeywordExecutor = async ({ driver, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  if (await driver.$(s).isDisplayed()) throw new Error(`Element "${s}" is visible but expected hidden`)
}
const appiumGetTextFn: AppiumKeywordExecutor = async ({ driver, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await driver.$(s).getText()
}

export const assertionKeywords: KeywordDef[] = [
  {
    name: 'assert-text',
    label: 'Assert Text',
    color: 'bg-amber-600',
    description: 'Assert element contains expected text',
    platforms: ['web', 'mobile', 'desktop', 'appium'],
    params: [
      { name: 'objectRef', description: 'CSS selector or object reference', required: true },
      { name: 'expected', description: 'Expected text content', required: true },
    ],
    hasObject: true,
    hasInput: false,
    hasExpected: true,
    objectPlaceholder: 'Selector',
    expectedPlaceholder: 'Expected text',
    executors: { web: assertTextFn, mobile: assertTextFn, desktop: assertTextFn, appium: appiumAssertTextFn },
  },
  {
    name: 'assert-url-contains',
    label: 'Assert URL Contains',
    color: 'bg-teal-600',
    description: 'Assert current URL contains a substring',
    platforms: ['web', 'mobile'],
    params: [{ name: 'expected', description: 'Expected URL substring', required: true }],
    hasObject: false,
    hasInput: false,
    hasExpected: true,
    expectedPlaceholder: 'URL substring',
    executors: { web: assertUrlContainsFn, mobile: assertUrlContainsFn },
  },
  {
    name: 'assert-url',
    label: 'Assert URL',
    color: 'bg-teal-600',
    description: 'Assert current URL contains a value (alias for assert-url-contains)',
    platforms: ['web', 'mobile'],
    params: [{ name: 'expected', description: 'Expected URL fragment', required: true }],
    hasObject: false,
    hasInput: false,
    hasExpected: true,
    expectedPlaceholder: 'URL substring',
    executors: { web: assertUrlContainsFn, mobile: assertUrlContainsFn },
  },
  {
    name: 'assert-visible',
    label: 'Assert Visible',
    color: 'bg-emerald-600',
    description: 'Assert element is visible',
    platforms: ['web', 'mobile', 'desktop', 'appium'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: assertVisibleFn, mobile: assertVisibleFn, desktop: assertVisibleFn, appium: appiumAssertVisibleFn },
  },
  {
    name: 'assert-hidden',
    label: 'Assert Hidden',
    color: 'bg-red-600',
    description: 'Assert element is hidden/not visible',
    platforms: ['web', 'mobile', 'desktop', 'appium'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: assertHiddenFn, mobile: assertHiddenFn, desktop: assertHiddenFn, appium: appiumAssertHiddenFn },
  },
  {
    name: 'assert-element-value',
    label: 'Assert Element Value',
    color: 'bg-amber-700',
    description: 'Assert input element has expected value',
    platforms: ['web', 'mobile', 'desktop'],
    params: [
      { name: 'objectRef', description: 'CSS selector or object reference', required: true },
      { name: 'expected', description: 'Expected value', required: true },
    ],
    hasObject: true,
    hasInput: false,
    hasExpected: true,
    objectPlaceholder: 'Selector',
    expectedPlaceholder: 'Expected value',
    executors: { web: assertValueFn, mobile: assertValueFn, desktop: assertValueFn },
  },
  {
    name: 'get-text',
    label: 'Get Text',
    color: 'bg-rose-600',
    description: 'Get text content of element',
    platforms: ['web', 'mobile', 'desktop', 'appium'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: getTextFn, mobile: getTextFn, desktop: getTextFn, appium: appiumGetTextFn },
  },
]
