import type {
  ApiEndpoint,
  CodePage,
  CodeSymbol,
  EntityModel,
  IndexProgress,
  DetectedStack,
  CodeMap,
  Language,
  Framework,
  UIElement,
  ValidationSchema,
} from './types'
import { detectStack } from './detector'
import { extractRoutes } from './parsers/routes'
import { walkAndExtractAST } from './parsers/ast-ts'
import { parseOpenApi } from './parsers/openapi'
import { walkJava } from './parsers/java'
import { walkGo } from './parsers/go'
import { walkPython } from './parsers/python'
import { walkRust } from './parsers/rust'
import { walkAngularElements } from './parsers/angular'
import { walkNodeRoutes } from './parsers/node-routes'
import { extractEntities } from './parsers/entities'
import { extractValidations } from './parsers/validations'
import { extractSeeds } from './parsers/seeds'
import { discoverWorkspace } from './workspace'

type Emit = (p: IndexProgress) => void

export async function indexRepo(
  repoPath: string,
  onProgress: Emit
): Promise<{ stack: DetectedStack; map: CodeMap }> {
  onProgress({ phase: 'detect', message: 'Detecting stack...', percent: 25 })
  const workspace = discoverWorkspace(repoPath)
  const primaryModule =
    workspace.modules.find((module) => module.role === 'frontend') ??
    workspace.modules.find((module) => module.role === 'backend') ??
    workspace.modules[0]
  const stack = primaryModule?.stack ?? detectStack(repoPath)
  onProgress({
    phase: 'detect',
    message: `Detected ${workspace.modules.length} module(s): ${workspace.tags.map((tag) => tag.type).join(', ')}`,
    percent: 30,
  })

  const pages: CodePage[] = []
  const elements: UIElement[] = []
  const symbols: CodeSymbol[] = []
  const apiEndpoints: ApiEndpoint[] = []
  const entities: EntityModel[] = []
  const validationSchemas: ValidationSchema[] = []
  let failedModules = 0
  for (let index = 0; index < workspace.modules.length; index += 1) {
    const module = workspace.modules[index]
    onProgress({
      phase: 'parse',
      message: `Analyzing ${module.relativeRoot} (${module.stack.framework}/${module.stack.language})...`,
      percent: 35 + Math.round((index / Math.max(1, workspace.modules.length)) * 35),
    })
    try {
      pages.push(...extractRoutes(module.root, module.stack.framework))
      const parsed = parseLangSpecific(module.root, module.stack.language, module.stack.framework)
      elements.push(...parsed.elements)
      symbols.push(...parsed.symbols)
      // OpenAPI is highest signal (carries schemas). Merge static-parsed routes
      // on top to surface endpoints missing from the spec.
      let endpoints = parsed.endpoints
      if (module.stack.hasOpenApi && module.stack.openApiPath) {
        try {
          const specEndpoints = await parseOpenApi(module.stack.openApiPath)
          endpoints = mergeEndpoints(specEndpoints, parsed.endpoints)
        } catch { /* keep static-parsed endpoints */ }
      }
      apiEndpoints.push(...endpoints)
      entities.push(...extractEntities(module.root, module.stack.language, module.stack.framework))
      validationSchemas.push(...extractValidations(module.root, module.stack.language, module.stack.framework))
    } catch {
      failedModules += 1
    }
  }

  const seeds = extractSeeds(repoPath)

  const supportedLanguages = new Set(['typescript', 'javascript', 'java', 'kotlin', 'go', 'rust', 'python'])
  const parseableFiles = workspace.files.filter((file) => supportedLanguages.has(file.language))
  workspace.diagnostics.parsedFiles = parseableFiles.length
  workspace.diagnostics.failedFiles = failedModules
  workspace.diagnostics.unsupportedFiles = workspace.files.length - parseableFiles.length
  workspace.diagnostics.coverage = workspace.files.length
    ? Math.round((parseableFiles.length / workspace.files.length) * 100) / 100
    : 0

  workspace.entities = entities
  workspace.validations = validationSchemas
  workspace.seeds = seeds

  onProgress({ phase: 'index', message: 'Building code map...', percent: 80 })
  const map: CodeMap = {
    pages,
    elements: dedupeElements(elements),
    endpoints: apiEndpoints,
    symbols,
    flows: [],
    entities,
    validations: validationSchemas,
    seeds,
    workspace,
  }

  onProgress({ phase: 'done', message: `Done: ${pages.length} pages, ${elements.length} elements, ${apiEndpoints.length} endpoints`, percent: 100 })
  return { stack, map }
}

function parseLangSpecific(repoPath: string, language: Language, framework?: Framework) {
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
      return {
        endpoints: framework ? walkNodeRoutes(repoPath, framework) : [],
        symbols,
        elements: framework === 'angular'
          ? [...elements, ...walkAngularElements(repoPath)]
          : elements,
      }
    }
    default:
      return { endpoints: [], symbols: [], elements: [] }
  }
}

// Normalize path params so `/users/:id` and `/users/{id}` compare equal.
function endpointKey(ep: ApiEndpoint): string {
  const normalized = ep.path
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\/+$/, '')
  return `${ep.method} ${normalized || '/'}`
}

// Merge endpoint lists, preferring spec entries (schemas) over static ones.
function mergeEndpoints(primary: ApiEndpoint[], extra: ApiEndpoint[]): ApiEndpoint[] {
  const byKey = new Map<string, ApiEndpoint>()
  for (const ep of [...primary, ...extra]) {
    const key = endpointKey(ep)
    if (!byKey.has(key)) byKey.set(key, ep)
  }
  return Array.from(byKey.values())
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
