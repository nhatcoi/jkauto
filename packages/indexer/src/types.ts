export type Framework =
  | 'react' | 'nextjs' | 'vue' | 'nuxt' | 'angular' | 'svelte'
  | 'nestjs' | 'express' | 'fastify' | 'koa'
  | 'spring' | 'quarkus' | 'micronaut'
  | 'gin' | 'echo' | 'fiber' | 'chi'
  | 'actix' | 'axum' | 'rocket'
  | 'laravel' | 'symfony' | 'codeigniter'
  | 'fastapi' | 'django' | 'flask'
  | 'unknown'

export type Language =
  | 'typescript' | 'javascript'
  | 'java' | 'kotlin'
  | 'go'
  | 'rust'
  | 'php'
  | 'python'
  | 'csharp'
  | 'unknown'

export type ProjectType =
  | 'web-application'
  | 'backend-api'
  | 'mobile-app'
  | 'desktop-app'
  | 'microservice'
  | 'monorepo'
  | 'library-sdk'
  | 'cli-tool'
  | 'automation-test'
  | 'data-ai'
  | 'infrastructure-devops'
  | 'database'
  | 'unknown-mixed'

export type ModuleRole =
  | 'frontend'
  | 'backend'
  | 'mobile'
  | 'desktop'
  | 'library'
  | 'cli'
  | 'automation'
  | 'data'
  | 'infrastructure'
  | 'database'
  | 'unknown'

export interface SourceRef {
  file: string
  line?: number
  symbol?: string
}

export interface ProjectTag {
  type: ProjectType
  confidence: number
  evidence: SourceRef[]
}

export interface DetectedStack {
  framework: Framework
  language: Language
  hasOpenApi: boolean
  openApiPath?: string
  hasReadme: boolean
  readmePath?: string
  testFramework?: string
}

export interface DetectedModule {
  id: string
  name: string
  root: string
  relativeRoot: string
  role: ModuleRole
  stack: DetectedStack
  tags: ProjectTag[]
  manifests: string[]
}

export interface SourceFileInfo {
  path: string
  relativePath: string
  moduleId: string
  language: Language | 'sql' | 'yaml' | 'json' | 'markdown' | 'other'
  size: number
  contentHash: string
  preview?: string
}

export interface CodeRelation {
  from: string
  to: string
  type:
    | 'contains'
    | 'imports'
    | 'declares'
    | 'renders'
    | 'exposes'
    | 'reads'
    | 'calls'
    | 'depends-on'
  sourceRef?: SourceRef
  confidence: number
}

export interface AnalysisFinding {
  id: string
  kind: 'entrypoint' | 'documentation' | 'configuration' | 'auth' | 'database' | 'test-target'
  name: string
  summary: string
  status: 'verified' | 'inferred' | 'unknown'
  confidence: number
  sourceRefs: SourceRef[]
  moduleId?: string
}

export interface KnowledgeGap {
  id: string
  kind: 'entrypoint' | 'routes' | 'api' | 'ui' | 'database' | 'auth' | 'runtime' | 'framework'
  title: string
  reason: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  moduleId?: string
  suggestedActions: string[]
}

export interface WorkspaceAnalysis {
  root: string
  tags: ProjectTag[]
  modules: DetectedModule[]
  files: SourceFileInfo[]
  relations: CodeRelation[]
  findings: AnalysisFinding[]
  gaps: KnowledgeGap[]
  diagnostics: {
    scannedFiles: number
    parsedFiles: number
    failedFiles: number
    unsupportedFiles: number
    skippedFiles: number
    coverage: number
  }
}

export interface CodePage {
  route: string
  componentFile: string
  componentName: string
  title?: string
}

export interface UIElement {
  name: string
  tag: string
  type?: string
  testId?: string
  label?: string
  placeholder?: string
  ariaLabel?: string
  sourceFile: string
  line: number
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  summary?: string
  requestSchema?: unknown
  responseSchema?: unknown
  sourceFile: string
}

export interface CodeSymbol {
  kind: 'function' | 'class' | 'component' | 'service' | 'model' | 'interface'
  name: string
  file: string
  line: number
  exported: boolean
}

export interface CodeChunk {
  id: string
  filePath: string
  chunkType: 'route' | 'element' | 'endpoint' | 'function' | 'class' | 'component'
  name: string
  content: string
  metadata: Record<string, unknown>
}

export interface CodeMap {
  pages: CodePage[]
  elements: UIElement[]
  endpoints: ApiEndpoint[]
  symbols: CodeSymbol[]
  flows: string[]
  workspace?: WorkspaceAnalysis
}

export interface IndexProgress {
  phase: 'clone' | 'detect' | 'parse' | 'index' | 'done' | 'error'
  message: string
  percent: number
}

export interface ContextBundle {
  pages: CodePage[]
  elements: UIElement[]
  endpoints: ApiEndpoint[]
  existingTests: string[]
  tokenEstimate: number
}

export interface RepoConfig {
  url: string
  branch?: string
  localPath: string
}
