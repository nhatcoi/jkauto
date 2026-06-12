import type { KeywordDef, PageKeywordExecutor } from '../types'

const getTitleFn: PageKeywordExecutor = async ({ page, expected, interpolate }) => {
  const title = await page.title()
  const exp = interpolate(expected)
  if (!title.includes(exp)) throw new Error(`Expected window title to contain "${exp}" but got "${title}"`)
}
const focusWindowFn: PageKeywordExecutor = async ({ page, input, interpolate }) => {
  const index = input ? parseInt(interpolate(input), 10) : 0
  const pages = page.context().pages()
  if (!pages[index]) throw new Error(`Window at index ${index} not found`)
  await pages[index].bringToFront()
}
const closeWindowFn: PageKeywordExecutor = async ({ page }) => {
  await page.close()
}
const maximizeWindowFn: PageKeywordExecutor = async ({ page }) => {
  await page.evaluate(() => {
    window.moveTo(0, 0)
    window.resizeTo(screen.width, screen.height)
  })
}

export const desktopKeywords: KeywordDef[] = [
  {
    name: 'assert-window-title',
    label: 'Assert Window Title',
    color: 'bg-violet-700',
    description: 'Assert window/page title contains expected text',
    platforms: ['desktop', 'web'],
    params: [{ name: 'expected', description: 'Expected title substring', required: true }],
    hasObject: false,
    hasInput: false,
    hasExpected: true,
    expectedPlaceholder: 'Expected title',
    executors: { desktop: getTitleFn, web: getTitleFn },
  },
  {
    name: 'focus-window',
    label: 'Focus Window',
    color: 'bg-blue-700',
    description: 'Bring a window/tab to front by index (0 = first)',
    platforms: ['desktop', 'web'],
    params: [{ name: 'input', description: 'Window index (default 0)', required: false }],
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Window index',
    executors: { desktop: focusWindowFn, web: focusWindowFn },
  },
  {
    name: 'close-window',
    label: 'Close Window',
    color: 'bg-red-700',
    description: 'Close the current window',
    platforms: ['desktop'],
    params: [],
    hasObject: false,
    hasInput: false,
    hasExpected: false,
    executors: { desktop: closeWindowFn },
  },
  {
    name: 'maximize-window',
    label: 'Maximize Window',
    color: 'bg-gray-600',
    description: 'Maximize the current window to screen size',
    platforms: ['desktop', 'web'],
    params: [],
    hasObject: false,
    hasInput: false,
    hasExpected: false,
    executors: { desktop: maximizeWindowFn, web: maximizeWindowFn },
  },
]
