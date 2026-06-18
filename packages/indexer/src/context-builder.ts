import type { CodeMap, ContextBundle, UIElement, CodePage, ApiEndpoint } from './types'

const TOKEN_BUDGET = 12_000
// rough estimate: 1 token ≈ 4 chars
const estimateTokens = (s: string) => Math.ceil(s.length / 4)

export function buildContext(
  map: CodeMap,
  query: string,
  existingTests: string[]
): ContextBundle {
  const keywords = query.toLowerCase().split(/\s+/)

  const scoreText = (text: string) =>
    keywords.reduce((s, kw) => s + (text.toLowerCase().includes(kw) ? 1 : 0), 0)

  const rankedPages = map.pages
    .map((p) => ({ item: p, score: scoreText(p.route + ' ' + p.componentName) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)

  const rankedElements = map.elements
    .map((e) => ({ item: e, score: scoreText([e.name, e.testId, e.label, e.placeholder].join(' ')) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)

  const rankedEndpoints = map.endpoints
    .map((e) => ({ item: e, score: scoreText(e.path + ' ' + (e.summary ?? '')) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)

  let budget = TOKEN_BUDGET
  const pages: CodePage[] = []
  const elements: UIElement[] = []
  const endpoints: ApiEndpoint[] = []
  const tests: string[] = []

  for (const p of rankedPages) {
    const t = estimateTokens(JSON.stringify(p))
    if (budget - t < 0) break
    pages.push(p)
    budget -= t
  }

  for (const e of rankedElements) {
    const t = estimateTokens(JSON.stringify(e))
    if (budget - t < 0) break
    elements.push(e)
    budget -= t
  }

  for (const e of rankedEndpoints) {
    const t = estimateTokens(JSON.stringify(e))
    if (budget - t < 0) break
    endpoints.push(e)
    budget -= t
  }

  for (const test of existingTests) {
    const t = estimateTokens(test)
    if (budget - t < 0) break
    tests.push(test)
    budget -= t
  }

  return {
    pages,
    elements,
    endpoints,
    existingTests: tests,
    tokenEstimate: TOKEN_BUDGET - budget,
  }
}
