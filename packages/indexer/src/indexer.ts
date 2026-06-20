import type {
  ApiEndpoint,
  CodePage,
  CodeSymbol,
  IndexProgress,
  DetectedStack,
  CodeMap,
  Language,
  UIElement,
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
import { discoverWorkspace } from './workspace'
import path from 'node:path'

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
      let endpoints = parsed.endpoints
      if (module.stack.hasOpenApi && module.stack.openApiPath) {
        try { endpoints = await parseOpenApi(module.stack.openApiPath) } catch {}
      }
      apiEndpoints.push(...endpoints)
    } catch {
      failedModules += 1
    }
  }

  const supportedLanguages = new Set(['typescript', 'javascript', 'java', 'kotlin', 'go', 'rust', 'python'])
  const parseableFiles = workspace.files.filter((file) => supportedLanguages.has(file.language))
  workspace.diagnostics.parsedFiles = parseableFiles.length
  workspace.diagnostics.failedFiles = failedModules
  workspace.diagnostics.unsupportedFiles = workspace.files.length - parseableFiles.length
  workspace.diagnostics.coverage = workspace.files.length
    ? Math.round((parseableFiles.length / workspace.files.length) * 100) / 100
    : 0
  for (const module of workspace.modules) {
    const modulePages = pages.filter((item) => item.componentFile.startsWith(module.root))
    const moduleEndpoints = apiEndpoints.filter((item) => item.sourceFile.startsWith(module.root))
    const moduleElements = elements.filter((item) => item.sourceFile.startsWith(module.root))
    if (module.role === 'frontend' && modulePages.length === 0) {
      workspace.gaps.push({
        id: `routes:${module.id}`,
        kind: 'routes',
        title: `Routes not verified for ${module.relativeRoot}`,
        reason: `No routes matched the ${module.stack.framework} analyzer.`,
        priority: 'high',
        moduleId: module.id,
        suggestedActions: ['Inspect router configuration', 'Search navigation declarations', 'Verify routes at runtime'],
      })
    }
    if (module.role === 'backend' && moduleEndpoints.length === 0) {
      workspace.gaps.push({
        id: `api:${module.id}`,
        kind: 'api',
        title: `API endpoints not verified for ${module.relativeRoot}`,
        reason: `No endpoints matched the ${module.stack.framework} analyzer.`,
        priority: 'high',
        moduleId: module.id,
        suggestedActions: ['Inspect controllers/router registration', 'Load runtime OpenAPI', 'Search HTTP method annotations'],
      })
    }
    if (module.role === 'frontend' && moduleElements.length === 0) {
      workspace.gaps.push({
        id: `ui:${module.id}`,
        kind: 'ui',
        title: `Testable UI elements not verified for ${module.relativeRoot}`,
        reason: 'No stable selectors or semantic controls were extracted.',
        priority: 'normal',
        moduleId: module.id,
        suggestedActions: ['Inspect templates', 'Search data-testid and accessible labels', 'Inspect rendered DOM'],
      })
    }
  }
  const authFindings = workspace.findings.filter((finding) => finding.kind === 'auth')
  if (authFindings.length > 0 && !authFindings.some((finding) => finding.status === 'verified')) {
    workspace.gaps.push({
      id: 'auth:workspace',
      kind: 'auth',
      title: 'Authentication flow requires verification',
      reason: 'Auth-related files were found, but the end-to-end login flow is not statically verified.',
      priority: 'critical',
      suggestedActions: ['Trace login entrypoint', 'Follow token/session storage', 'Verify redirect and protected route behavior'],
    })
  }
  workspace.relations.push(
    ...workspace.files.map((file) => ({
      from: `module:${file.moduleId}`,
      to: `file:${file.relativePath}`,
      type: 'contains' as const,
      sourceRef: { file: file.path },
      confidence: 1,
    })),
    ...pages.map((page) => ({
      from: `route:${page.route}`,
      to: `file:${path.relative(repoPath, page.componentFile).split(path.sep).join('/')}`,
      type: 'renders' as const,
      sourceRef: { file: page.componentFile },
      confidence: 0.9,
    })),
    ...apiEndpoints.map((endpoint) => ({
      from: `endpoint:${endpoint.method}:${endpoint.path}`,
      to: `file:${path.relative(repoPath, endpoint.sourceFile).split(path.sep).join('/')}`,
      type: 'exposes' as const,
      sourceRef: { file: endpoint.sourceFile },
      confidence: 0.95,
    })),
  )

  onProgress({ phase: 'index', message: 'Building code map...', percent: 80 })
  const map: CodeMap = {
    pages,
    elements: dedupeElements(elements),
    endpoints: apiEndpoints,
    symbols,
    flows: [],
    workspace,
  }

  onProgress({ phase: 'done', message: `Done: ${pages.length} pages, ${elements.length} elements, ${apiEndpoints.length} endpoints`, percent: 100 })
  return { stack, map }
}

function parseLangSpecific(repoPath: string, language: Language, framework?: string) {
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
        endpoints: [],
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

function dedupeElements(elements: UIElement[]) {
  const seen = new Set<string>()
  return elements.filter((e) => {
    const key = `${e.sourceFile}:${e.line}:${e.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
