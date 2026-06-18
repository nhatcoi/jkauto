// Types mirrored from @jkauto/indexer — kept local to avoid bundling Node.js modules in renderer

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
  | 'go' | 'rust' | 'php' | 'python' | 'csharp'
  | 'unknown'

export interface DetectedStack {
  framework: Framework
  language: Language
  hasOpenApi: boolean
  openApiPath?: string
  hasReadme: boolean
  readmePath?: string
  testFramework?: string
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

export interface CodeMap {
  pages: CodePage[]
  elements: UIElement[]
  endpoints: ApiEndpoint[]
  symbols: unknown[]
  flows: string[]
}

export interface IndexProgress {
  phase: 'clone' | 'detect' | 'parse' | 'index' | 'done' | 'error'
  message: string
  percent: number
}

export type TestType = 'e2e' | 'api' | 'unit' | 'integration'

export type GenerationStatus = 'idle' | 'indexing' | 'selecting' | 'generating' | 'done' | 'error'

export interface GenerateTarget {
  id: string
  label: string
  route?: string
  endpoint?: string
  description?: string
}

export interface GeneratedTest {
  id: string
  name: string
  type: TestType
  target: GenerateTarget
  content: unknown
  status: 'draft' | 'saved' | 'failed'
  errorMessage?: string
  streamBuffer?: string
}

export interface AutogenState {
  repoUrl: string
  status: GenerationStatus
  progress: IndexProgress | null
  stack: DetectedStack | null
  codeMap: CodeMap | null
  targets: GenerateTarget[]
  selectedTargets: string[]
  selectedTypes: TestType[]
  generatedTests: GeneratedTest[]
  errorMessage: string | null
}
