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

export interface EntityField {
  name: string
  type: string
  nullable?: boolean
  primaryKey?: boolean
  unique?: boolean
  defaultValue?: string
  validations?: string[]
}

export interface EntityModel {
  name: string
  tableName?: string
  fields: EntityField[]
  sourceFile: string
  line: number
  framework: string // 'typeorm' | 'prisma' | 'sequelize' | 'django' | 'sqlalchemy' | 'spring' | 'unknown'
}

export interface ValidationField {
  name: string
  type?: string
  rules: string[] // e.g. ['IsEmail', 'IsNotEmpty', 'MinLength(8)']
  optional?: boolean
}

export interface ValidationSchema {
  name: string // DTO class name or schema variable name
  fields: ValidationField[]
  sourceFile: string
  line: number
  framework: string // 'class-validator' | 'zod' | 'joi' | 'pydantic' | 'unknown'
}

export interface SeedEntry {
  entity: string // entity/table name this seed is for
  count: number // number of example records
  sample: Record<string, unknown>[] // first 3 records max
  sourceFile: string
}

export interface WorkspaceAnalysis {
  root: string
  tags: ProjectTag[]
  modules: DetectedModule[]
  files: SourceFileInfo[]
  entities: EntityModel[]
  validations: ValidationSchema[]
  seeds: SeedEntry[]
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

export interface ApiParameter {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required: boolean
  type?: string
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  summary?: string
  parameters?: ApiParameter[]
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
  entities: EntityModel[]
  validations: ValidationSchema[]
  seeds: SeedEntry[]
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
