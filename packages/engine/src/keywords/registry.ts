import type { Page } from '@playwright/test'

export interface KeywordDef {
  name: string
  description: string
  params: Array<{ name: string; description: string; required: boolean }>
  execute: (ctx: KeywordContext) => Promise<void>
}

export interface KeywordContext {
  page: Page
  objectRef: string
  input: string
  expected: string
  resolveLocator: (ref: string) => Promise<string>
  interpolate: (value: string) => string
}

const keywords: Map<string, KeywordDef> = new Map()

function define(def: KeywordDef) {
  keywords.set(def.name, def)
}

// ── Navigation ────────────────────────────────────────────────────────────────
define({
  name: 'navigate-to',
  description: 'Navigate browser to URL',
  params: [{ name: 'input', description: 'URL to navigate to', required: true }],
  async execute({ page, input, interpolate }) {
    await page.goto(interpolate(input))
  },
})

// ── Click / Interaction ───────────────────────────────────────────────────────
define({
  name: 'click',
  description: 'Click an element',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.click(selector)
  },
})

define({
  name: 'type-text',
  description: 'Type text into an input element',
  params: [
    { name: 'objectRef', description: 'CSS selector or object reference', required: true },
    { name: 'input', description: 'Text to type', required: true },
  ],
  async execute({ page, objectRef, input, resolveLocator, interpolate }) {
    const selector = await resolveLocator(objectRef)
    await page.fill(selector, interpolate(input))
  },
})

define({
  name: 'clear-text',
  description: 'Clear the value of an input element',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.fill(selector, '')
  },
})

define({
  name: 'hover',
  description: 'Hover over an element',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.hover(selector)
  },
})

define({
  name: 'press-key',
  description: 'Press a keyboard key',
  params: [{ name: 'input', description: 'Key name (Enter, Tab, Escape, ArrowDown…)', required: true }],
  async execute({ page, input, interpolate }) {
    await page.keyboard.press(interpolate(input))
  },
})

define({
  name: 'scroll-to',
  description: 'Scroll element into view',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.locator(selector).scrollIntoViewIfNeeded()
  },
})

define({
  name: 'select-option',
  description: 'Select option in a select element',
  params: [
    { name: 'objectRef', description: 'CSS selector or object reference', required: true },
    { name: 'input', description: 'Option value or label', required: true },
  ],
  async execute({ page, objectRef, input, resolveLocator, interpolate }) {
    const selector = await resolveLocator(objectRef)
    await page.selectOption(selector, interpolate(input))
  },
})

define({
  name: 'check',
  description: 'Check a checkbox or radio button',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.check(selector)
  },
})

define({
  name: 'uncheck',
  description: 'Uncheck a checkbox',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.uncheck(selector)
  },
})

// ── Assertions ────────────────────────────────────────────────────────────────
define({
  name: 'assert-text',
  description: 'Assert element contains expected text',
  params: [
    { name: 'objectRef', description: 'CSS selector or object reference', required: true },
    { name: 'expected', description: 'Expected text content', required: true },
  ],
  async execute({ page, objectRef, expected, resolveLocator, interpolate }) {
    const selector = await resolveLocator(objectRef)
    const text = await page.textContent(selector)
    const exp = interpolate(expected)
    if (!text?.includes(exp)) {
      throw new Error(`Expected text to contain "${exp}" but got "${text}"`)
    }
  },
})

define({
  name: 'assert-url-contains',
  description: 'Assert current URL contains a substring',
  params: [{ name: 'expected', description: 'Expected URL substring', required: true }],
  async execute({ page, expected, interpolate }) {
    const url = page.url()
    const exp = interpolate(expected)
    if (!url.includes(exp)) {
      throw new Error(`Expected URL to contain "${exp}" but got "${url}"`)
    }
  },
})

// alias
define({
  name: 'assert-url',
  description: 'Assert current URL contains a value (alias for assert-url-contains)',
  params: [{ name: 'expected', description: 'Expected URL fragment', required: true }],
  async execute({ page, expected, interpolate }) {
    const url = page.url()
    const exp = interpolate(expected)
    if (!url.includes(exp)) {
      throw new Error(`Expected URL to contain "${exp}" but got "${url}"`)
    }
  },
})

define({
  name: 'assert-visible',
  description: 'Assert element is visible',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    const visible = await page.isVisible(selector)
    if (!visible) throw new Error(`Element "${selector}" is not visible`)
  },
})

define({
  name: 'assert-hidden',
  description: 'Assert element is hidden/not visible',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    const visible = await page.isVisible(selector)
    if (visible) throw new Error(`Element "${selector}" is visible but expected hidden`)
  },
})

define({
  name: 'assert-element-value',
  description: 'Assert input element has expected value',
  params: [
    { name: 'objectRef', description: 'CSS selector or object reference', required: true },
    { name: 'expected', description: 'Expected value', required: true },
  ],
  async execute({ page, objectRef, expected, resolveLocator, interpolate }) {
    const selector = await resolveLocator(objectRef)
    const value = await page.inputValue(selector)
    const exp = interpolate(expected)
    if (value !== exp) {
      throw new Error(`Expected value "${exp}" but got "${value}"`)
    }
  },
})

define({
  name: 'get-text',
  description: 'Get text content of element (logs to console)',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.textContent(selector)
  },
})

// ── Wait ──────────────────────────────────────────────────────────────────────
define({
  name: 'wait-ms',
  description: 'Wait for specified milliseconds',
  params: [{ name: 'input', description: 'Milliseconds to wait', required: true }],
  async execute({ page, input, interpolate }) {
    await page.waitForTimeout(parseInt(interpolate(input), 10))
  },
})

// alias
define({
  name: 'wait',
  description: 'Wait for specified milliseconds (alias for wait-ms)',
  params: [{ name: 'input', description: 'Milliseconds to wait', required: true }],
  async execute({ page, input, interpolate }) {
    await page.waitForTimeout(parseInt(interpolate(input), 10))
  },
})

define({
  name: 'wait-for-element',
  description: 'Wait for element to become visible',
  params: [
    { name: 'objectRef', description: 'CSS selector or object reference', required: true },
    { name: 'input', description: 'Timeout in ms (default 30000)', required: false },
  ],
  async execute({ page, objectRef, input, resolveLocator, interpolate }) {
    const selector = await resolveLocator(objectRef)
    const timeout = input ? parseInt(interpolate(input), 10) : 30000
    await page.waitForSelector(selector, { state: 'visible', timeout })
  },
})

define({
  name: 'wait-for-visible',
  description: 'Wait for element to be visible',
  params: [{ name: 'objectRef', description: 'CSS selector or object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.waitForSelector(selector, { state: 'visible' })
  },
})

// ── Screenshot ────────────────────────────────────────────────────────────────
define({
  name: 'take-screenshot',
  description: 'Take a screenshot',
  params: [],
  async execute({ page }) {
    await page.screenshot()
  },
})

export function getKeyword(name: string): KeywordDef | undefined {
  return keywords.get(name)
}

export function getAllKeywords(): KeywordDef[] {
  return Array.from(keywords.values())
}
