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

// ── Legacy low-level keywords (appium-only) ──────────────────────────────────

export const mobileKeywords: KeywordDef[] = [
  {
    name: 'tap',
    label: 'Tap',
    color: 'bg-green-500',
    description: 'Touch-tap an element (mobile native gesture)',
    platforms: ['appium'],
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
    platforms: ['appium'],
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
    platforms: ['appium'],
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
    platforms: ['appium'],
    params: [{ name: 'objectRef', description: 'Selector or accessibility ID', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    executors: { mobile: longPressFn, appium: appiumLongPressFn },
  },

  // ── Neutral DSL keywords (mobile + appium) — map to Maestro YAML or Appium ──

  {
    name: 'mobile.launchApp',
    label: 'Launch App',
    color: 'bg-emerald-600',
    description: 'Launch the mobile app (appId from profile or input)',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'input', description: 'App ID (optional, falls back to APP_ID profile var)', required: false }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'com.example.app',
    executors: {
      appium: async ({ driver, input, interpolate }) => {
        const appId = input ? interpolate(input) : undefined
        if (appId) await driver.activateApp(appId)
      },
    },
  },
  {
    name: 'mobile.tap',
    label: 'Tap',
    color: 'bg-green-500',
    description: 'Tap on element by text, accessibilityId, or selector',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'objectRef', description: 'Text, ~accessibilityId, or selector', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Login button text or ~accessibilityId',
    executors: {
      appium: appiumTapFn,
    },
  },
  {
    name: 'mobile.inputText',
    label: 'Input Text',
    color: 'bg-blue-500',
    description: 'Type text into an input field',
    platforms: ['mobile', 'appium'],
    params: [
      { name: 'objectRef', description: 'Field selector or ~accessibilityId', required: true },
      { name: 'input', description: 'Text to type', required: true },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: '~emailInput',
    inputPlaceholder: 'Text to type',
    executors: {
      appium: async ({ driver, objectRef, input, resolveLocator, interpolate }) => {
        const s = await resolveLocator(objectRef)
        await driver.$(s).setValue(interpolate(input))
      },
    },
  },
  {
    name: 'mobile.clearText',
    label: 'Clear Text',
    color: 'bg-blue-400',
    description: 'Clear text from an input field',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'objectRef', description: 'Field selector or ~accessibilityId', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: '~emailInput',
    executors: {
      appium: async ({ driver, objectRef, resolveLocator }) => {
        const s = await resolveLocator(objectRef)
        await driver.$(s).clearValue()
      },
    },
  },
  {
    name: 'mobile.assertVisible',
    label: 'Assert Visible',
    color: 'bg-violet-500',
    description: 'Assert that an element is visible on screen',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'objectRef', description: 'Element selector, text, or ~accessibilityId', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Welcome text or ~successBanner',
    executors: {
      appium: async ({ driver, objectRef, resolveLocator }) => {
        const s = await resolveLocator(objectRef)
        const el = await driver.$(s)
        const displayed = await el.isDisplayed()
        if (!displayed) throw new Error(`Element "${objectRef}" is not visible`)
      },
    },
  },
  {
    name: 'mobile.assertNotVisible',
    label: 'Assert Not Visible',
    color: 'bg-violet-400',
    description: 'Assert that an element is NOT visible on screen',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'objectRef', description: 'Element selector, text, or ~accessibilityId', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: '~errorMessage',
    executors: {
      appium: async ({ driver, objectRef, resolveLocator }) => {
        const s = await resolveLocator(objectRef)
        const el = await driver.$(s)
        const displayed = await el.isDisplayed().catch(() => false)
        if (displayed) throw new Error(`Element "${objectRef}" should not be visible`)
      },
    },
  },
  {
    name: 'mobile.waitForVisible',
    label: 'Wait For Visible',
    color: 'bg-yellow-500',
    description: 'Wait until an element becomes visible (default 5s)',
    platforms: ['mobile', 'appium'],
    params: [
      { name: 'objectRef', description: 'Element selector or ~accessibilityId', required: true },
      { name: 'input', description: 'Timeout ms (default 5000)', required: false },
    ],
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: '~loadingSpinner',
    inputPlaceholder: '5000',
    executors: {
      appium: async ({ driver, objectRef, input, resolveLocator, interpolate }) => {
        const s = await resolveLocator(objectRef)
        const timeout = input ? parseInt(interpolate(input), 10) : 5000
        await driver.$(s).waitForDisplayed({ timeout })
      },
    },
  },
  {
    name: 'mobile.swipe',
    label: 'Swipe',
    color: 'bg-sky-500',
    description: 'Swipe in a direction (up/down/left/right)',
    platforms: ['mobile', 'appium'],
    params: [
      { name: 'input', description: 'Direction: up | down | left | right', required: true },
      { name: 'objectRef', description: 'Distance px (default 300)', required: false },
    ],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'up',
    executors: {
      appium: async ({ driver, input, interpolate }) => {
        const dir = interpolate(input).toLowerCase() as 'up' | 'down' | 'left' | 'right'
        const distance = 300
        const { width, height } = await driver.getWindowSize()
        const cx = Math.round(width / 2)
        const cy = Math.round(height / 2)
        const vectors = {
          up:    [cx, cy, cx, Math.max(0, cy - distance)],
          down:  [cx, cy, cx, Math.min(height, cy + distance)],
          left:  [cx, cy, Math.max(0, cx - distance), cy],
          right: [cx, cy, Math.min(width, cx + distance), cy],
        }
        const [sx, sy, ex, ey] = vectors[dir] ?? vectors.up
        await driver.touchAction([
          { action: 'press', x: sx, y: sy },
          { action: 'moveTo', x: ex, y: ey },
          'release',
        ])
      },
    },
  },
  {
    name: 'mobile.scrollUntilVisible',
    label: 'Scroll Until Visible',
    color: 'bg-sky-600',
    description: 'Scroll down until an element appears (max 10 swipes)',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'objectRef', description: 'Element selector or ~accessibilityId', required: true }],
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: '~submitButton',
    executors: {
      appium: async ({ driver, objectRef, resolveLocator }) => {
        const s = await resolveLocator(objectRef)
        const { width, height } = await driver.getWindowSize()
        const cx = Math.round(width / 2)
        for (let i = 0; i < 10; i++) {
          const el = await driver.$(s)
          if (await el.isDisplayed().catch(() => false)) return
          await driver.touchAction([
            { action: 'press', x: cx, y: Math.round(height * 0.8) },
            { action: 'moveTo', x: cx, y: Math.round(height * 0.2) },
            'release',
          ])
        }
        throw new Error(`Element "${objectRef}" not found after scrolling`)
      },
    },
  },
  {
    name: 'mobile.back',
    label: 'Back',
    color: 'bg-slate-500',
    description: 'Press the device back button',
    platforms: ['mobile', 'appium'],
    params: [],
    hasObject: false,
    hasInput: false,
    hasExpected: false,
    executors: {
      appium: async ({ driver }) => {
        await driver.back()
      },
    },
  },
  {
    name: 'mobile.pressKey',
    label: 'Press Key',
    color: 'bg-slate-400',
    description: 'Press a key (Enter, Delete, Home, etc.)',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'input', description: 'Key name: Enter | Delete | Home | Back | Search', required: true }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Enter',
    executors: {
      appium: async ({ driver, input, interpolate }) => {
        const key = interpolate(input)
        await driver.pressKeyCode(key === 'Enter' ? 66 : key === 'Delete' ? 67 : key === 'Home' ? 3 : key === 'Back' ? 4 : key === 'Search' ? 84 : 66)
      },
    },
  },
  {
    name: 'mobile.screenshot',
    label: 'Screenshot',
    color: 'bg-pink-500',
    description: 'Take a screenshot checkpoint',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'input', description: 'Checkpoint name (optional)', required: false }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'login-screen',
    executors: {
      appium: async ({ driver, input, interpolate }) => {
        await driver.saveScreenshot(`/tmp/${interpolate(input) || 'checkpoint'}-${Date.now()}.png`)
      },
    },
  },
  {
    name: 'mobile.closeApp',
    label: 'Close App',
    color: 'bg-red-500',
    description: 'Close / terminate the mobile app',
    platforms: ['mobile', 'appium'],
    params: [{ name: 'input', description: 'App ID (optional, falls back to APP_ID profile var)', required: false }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'com.example.app',
    executors: {
      appium: async ({ driver, input, interpolate }) => {
        const appId = input ? interpolate(input) : undefined
        if (appId) await driver.terminateApp(appId)
      },
    },
  },
]
