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

define({
  name: 'navigate-to',
  description: 'Navigate browser to URL',
  params: [{ name: 'input', description: 'URL to navigate to', required: true }],
  async execute({ page, input, interpolate }) {
    await page.goto(interpolate(input))
  },
})

define({
  name: 'click',
  description: 'Click an element',
  params: [{ name: 'objectRef', description: 'Object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.click(selector)
  },
})

define({
  name: 'type-text',
  description: 'Type text into an input element',
  params: [
    { name: 'objectRef', description: 'Object reference', required: true },
    { name: 'input', description: 'Text to type', required: true },
  ],
  async execute({ page, objectRef, input, resolveLocator, interpolate }) {
    const selector = await resolveLocator(objectRef)
    await page.fill(selector, interpolate(input))
  },
})

define({
  name: 'assert-text',
  description: 'Assert element contains text',
  params: [
    { name: 'objectRef', description: 'Object reference', required: true },
    { name: 'expected', description: 'Expected text', required: true },
  ],
  async execute({ page, objectRef, expected, resolveLocator, interpolate }) {
    const selector = await resolveLocator(objectRef)
    const text = await page.textContent(selector)
    const expectedText = interpolate(expected)
    if (!text?.includes(expectedText)) {
      throw new Error(`Expected "${expectedText}" but got "${text}"`)
    }
  },
})

define({
  name: 'wait-for-visible',
  description: 'Wait for element to be visible',
  params: [{ name: 'objectRef', description: 'Object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.waitForSelector(selector, { state: 'visible' })
  },
})

define({
  name: 'take-screenshot',
  description: 'Take a screenshot',
  params: [],
  async execute({ page }) {
    await page.screenshot()
  },
})

define({
  name: 'select-option',
  description: 'Select option in a select element',
  params: [
    { name: 'objectRef', description: 'Object reference', required: true },
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
  params: [{ name: 'objectRef', description: 'Object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.check(selector)
  },
})

define({
  name: 'uncheck',
  description: 'Uncheck a checkbox',
  params: [{ name: 'objectRef', description: 'Object reference', required: true }],
  async execute({ page, objectRef, resolveLocator }) {
    const selector = await resolveLocator(objectRef)
    await page.uncheck(selector)
  },
})

define({
  name: 'wait',
  description: 'Wait for specified milliseconds',
  params: [{ name: 'input', description: 'Milliseconds to wait', required: true }],
  async execute({ page, input }) {
    await page.waitForTimeout(parseInt(input, 10))
  },
})

define({
  name: 'assert-url',
  description: 'Assert current URL contains value',
  params: [{ name: 'expected', description: 'Expected URL fragment', required: true }],
  async execute({ page, expected, interpolate }) {
    const url = page.url()
    const expectedUrl = interpolate(expected)
    if (!url.includes(expectedUrl)) {
      throw new Error(`Expected URL to contain "${expectedUrl}" but got "${url}"`)
    }
  },
})

export function getKeyword(name: string): KeywordDef | undefined {
  return keywords.get(name)
}

export function getAllKeywords(): KeywordDef[] {
  return Array.from(keywords.values())
}
