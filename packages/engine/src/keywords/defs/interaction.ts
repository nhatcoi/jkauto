import type { KeywordDef, PageKeywordExecutor, AppiumKeywordExecutor } from '../types'

const clickFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.click(s)
}
const typeFn: PageKeywordExecutor = async ({ page, objectRef, input, resolveLocator, interpolate }) => {
  const s = await resolveLocator(objectRef)
  await page.fill(s, interpolate(input))
}
const clearFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.fill(s, '')
}

const appiumClickFn: AppiumKeywordExecutor = async ({ driver, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await driver.$(s).click()
}
const appiumTypeFn: AppiumKeywordExecutor = async ({ driver, objectRef, input, resolveLocator, interpolate }) => {
  const s = await resolveLocator(objectRef)
  const el = driver.$(s)
  await el.clearValue()
  await el.setValue(interpolate(input))
}
const appiumClearFn: AppiumKeywordExecutor = async ({ driver, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await driver.$(s).clearValue()
}
const hoverFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.hover(s)
}
const pressKeyFn: PageKeywordExecutor = async ({ page, input, interpolate }) => {
  await page.keyboard.press(interpolate(input))
}
const scrollToFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.locator(s).scrollIntoViewIfNeeded()
}
const selectFn: PageKeywordExecutor = async ({ page, objectRef, input, resolveLocator, interpolate }) => {
  const s = await resolveLocator(objectRef)
  await page.selectOption(s, interpolate(input))
}
const checkFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.check(s)
}
const uncheckFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.uncheck(s)
}

export const interactionKeywords: KeywordDef[] = [
  {
    name: 'click',
    label: 'Click',
    color: 'bg-green-600',
    description: 'Click an element',
    platforms: ['web', 'mobile', 'desktop', 'appium'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: clickFn, mobile: clickFn, desktop: clickFn, appium: appiumClickFn },
  },
  {
    name: 'type-text',
    label: 'Type Text',
    color: 'bg-violet-600',
    description: 'Type text into an input element',
    platforms: ['web', 'mobile', 'desktop', 'appium'],
    params: [
      { name: 'objectRef', description: 'CSS selector or object reference', required: true },
      { name: 'input', description: 'Text to type', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    inputPlaceholder: 'Text',
    executors: { web: typeFn, mobile: typeFn, desktop: typeFn, appium: appiumTypeFn },
  },
  {
    name: 'clear-text',
    label: 'Clear Text',
    color: 'bg-orange-500',
    description: 'Clear the value of an input element',
    platforms: ['web', 'mobile', 'desktop', 'appium'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: clearFn, mobile: clearFn, desktop: clearFn, appium: appiumClearFn },
  },
  {
    name: 'hover',
    label: 'Hover',
    color: 'bg-lime-600',
    description: 'Hover over an element',
    platforms: ['web', 'desktop'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: hoverFn, desktop: hoverFn },
  },
  {
    name: 'press-key',
    label: 'Press Key',
    color: 'bg-pink-600',
    description: 'Press a keyboard key',
    platforms: ['web', 'mobile', 'desktop'],
    params: [{ name: 'input', description: 'Key name (Enter, Tab, Escape, ArrowDown…)', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Enter, Tab, Escape…',
    executors: { web: pressKeyFn, mobile: pressKeyFn, desktop: pressKeyFn },
  },
  {
    name: 'scroll-to',
    label: 'Scroll To',
    color: 'bg-yellow-600',
    description: 'Scroll element into view',
    platforms: ['web', 'mobile', 'desktop'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: scrollToFn, mobile: scrollToFn, desktop: scrollToFn },
  },
  {
    name: 'select-option',
    label: 'Select Option',
    color: 'bg-indigo-600',
    description: 'Select option in a select element',
    platforms: ['web', 'desktop'],
    params: [
      { name: 'objectRef', description: 'CSS selector or object reference', required: true },
      { name: 'input', description: 'Option value or label', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    inputPlaceholder: 'Option value',
    executors: { web: selectFn, desktop: selectFn },
  },
  {
    name: 'check',
    label: 'Check',
    color: 'bg-green-700',
    description: 'Check a checkbox or radio button',
    platforms: ['web', 'desktop'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: checkFn, desktop: checkFn },
  },
  {
    name: 'uncheck',
    label: 'Uncheck',
    color: 'bg-red-700',
    description: 'Uncheck a checkbox',
    platforms: ['web', 'desktop'],
    params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { web: uncheckFn, desktop: uncheckFn },
  },
]
