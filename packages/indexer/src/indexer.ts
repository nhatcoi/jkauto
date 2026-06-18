import type { IndexProgress, DetectedStack, CodeMap, Language, UIElement } from './types'
import { detectStack } from './detector'
import { extractRoutes } from './parsers/routes'
import { walkAndExtractAST } from './parsers/ast-ts'
import { parseOpenApi } from './parsers/openapi'
import { walkJava } from './parsers/java'
import { walkGo } from './parsers/go'
import { walkPython } from './parsers/python'
import { walkRust } from './parsers/rust'

type Emit = (p: IndexProgress) => void

export async function indexRepo(
  repoPath: string,
  onProgress: Emit
): Promise<{ stack: DetectedStack; map: CodeMap }> {
  onProgress({ phase: 'detect', message: 'Detecting stack...', percent: 25 })
  const stack = detectStack(repoPath)
  onProgress({ phase: 'detect', message: `Detected: ${stack.framework} / ${stack.language}`, percent: 30 })

  onProgress({ phase: 'parse', message: 'Extracting routes...', percent: 35 })
  const pages = extractRoutes(repoPath, stack.framework)

  onProgress({ phase: 'parse', message: 'Parsing source files...', percent: 45 })
  const { endpoints: langEndpoints, symbols, elements } = parseLangSpecific(repoPath, stack.language)

  onProgress({ phase: 'parse', message: 'Parsing API spec...', percent: 65 })
  let apiEndpoints = langEndpoints
  if (stack.hasOpenApi && stack.openApiPath) {
    try {
      const specEndpoints = await parseOpenApi(stack.openApiPath)
      apiEndpoints = specEndpoints
      onProgress({ phase: 'parse', message: `OpenAPI: ${specEndpoints.length} endpoints`, percent: 72 })
    } catch {
      onProgress({ phase: 'parse', message: 'OpenAPI parse failed, using source', percent: 72 })
    }
  }

  onProgress({ phase: 'index', message: 'Building code map...', percent: 80 })
  const map: CodeMap = {
    pages,
    elements: dedupeElements(elements),
    endpoints: apiEndpoints,
    symbols,
    flows: [],
  }

  onProgress({ phase: 'done', message: `Done: ${pages.length} pages, ${elements.length} elements, ${apiEndpoints.length} endpoints`, percent: 100 })
  return { stack, map }
}

function parseLangSpecific(repoPath: string, language: Language) {
  switch (language) {
    case 'java':
    case 'kotlin': {
      const { endpoints, symbols } = walkJava(repoPath)
      return { endpoints, symbols, elements: [] }
    }
    case 'go': {
      const { endpoints, symbols } = walkGo(repoPath)
      return { endpoints, symbols, elements: [] }
    }
    case 'rust': {
      const { endpoints, symbols } = walkRust(repoPath)
      return { endpoints, symbols, elements: [] }
    }
    case 'python': {
      const { endpoints, symbols } = walkPython(repoPath)
      return { endpoints, symbols, elements: [] }
    }
    case 'typescript':
    case 'javascript': {
      const { elements, symbols } = walkAndExtractAST(repoPath)
      return { endpoints: [], symbols, elements }
    }
    default:
      return { endpoints: [], symbols: [], elements: [] }
  }
}

function dedupeElements(elements: UIElement[]) {
  const seen = new Set<string>()
  return elements.filter((e) => {
    const key = `${e.sourceFile}:${e.line}:${e.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
