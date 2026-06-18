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
