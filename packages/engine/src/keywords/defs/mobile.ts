import type { KeywordDef, PageKeywordExecutor, AppiumKeywordExecutor } from '../types'

// Tap uses Playwright's touch tap (different from mouse click on mobile).
const tapFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await page.tap(s)
}
// Swipe via JS scroll — Playwright touchscreen.scroll is coordinate-based only.
const swipeUpFn: PageKeywordExecutor = async ({ page, input, interpolate }) => {
  const distance = input ? parseInt(interpolate(input), 10) : 300
  await page.evaluate((d) => window.scrollBy(0, -d), distance)
}
const swipeDownFn: PageKeywordExecutor = async ({ page, input, interpolate }) => {
  const distance = input ? parseInt(interpolate(input), 10) : 300
  await page.evaluate((d) => window.scrollBy(0, d), distance)
}
const longPressFn: PageKeywordExecutor = async ({ page, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  const el = page.locator(s)
  const box = await el.boundingBox()
  if (!box) throw new Error(`Cannot long-press: element "${s}" not found`)
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

// Appium native gesture executors via WebDriverIO touch actions.
const appiumTapFn: AppiumKeywordExecutor = async ({ driver, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await driver.$(s).click()
}
const appiumSwipeUpFn: AppiumKeywordExecutor = async ({ driver, input, interpolate }) => {
  const distance = input ? parseInt(interpolate(input), 10) : 300
  const { width, height } = await driver.getWindowSize()
  const cx = Math.round(width / 2)
  const cy = Math.round(height / 2)
  await driver.touchAction([
    { action: 'press', x: cx, y: cy },
    { action: 'moveTo', x: cx, y: Math.max(0, cy - distance) },
    'release',
  ])
}
const appiumSwipeDownFn: AppiumKeywordExecutor = async ({ driver, input, interpolate }) => {
  const distance = input ? parseInt(interpolate(input), 10) : 300
  const { width, height } = await driver.getWindowSize()
  const cx = Math.round(width / 2)
  const cy = Math.round(height / 2)
  await driver.touchAction([
    { action: 'press', x: cx, y: cy },
    { action: 'moveTo', x: cx, y: Math.min(height, cy + distance) },
    'release',
  ])
}
const appiumLongPressFn: AppiumKeywordExecutor = async ({ driver, objectRef, resolveLocator }) => {
  const s = await resolveLocator(objectRef)
  await driver.touchAction([
    { action: 'longPress', element: driver.$(s) },
    'release',
  ])
}

export const mobileKeywords: KeywordDef[] = [
  {
    name: 'tap',
    label: 'Tap',
    color: 'bg-green-500',
    description: 'Touch-tap an element (mobile native gesture)',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'objectRef', description: 'Selector or accessibility ID', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { mobile: tapFn, appium: appiumTapFn },
  },
  {
    name: 'swipe-up',
    label: 'Swipe Up',
    color: 'bg-sky-500',
    description: 'Swipe/scroll up by pixels',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'input', description: 'Distance in px (default 300)', required: false }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Distance px',
    executors: { mobile: swipeUpFn, appium: appiumSwipeUpFn },
  },
  {
    name: 'swipe-down',
    label: 'Swipe Down',
    color: 'bg-sky-600',
    description: 'Swipe/scroll down by pixels',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'input', description: 'Distance in px (default 300)', required: false }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Distance px',
    executors: { mobile: swipeDownFn, appium: appiumSwipeDownFn },
  },
  {
    name: 'long-press',
    label: 'Long Press',
    color: 'bg-purple-600',
    description: 'Long-press (touch) an element',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'objectRef', description: 'Selector or accessibility ID', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { mobile: longPressFn, appium: appiumLongPressFn },
  },
]
