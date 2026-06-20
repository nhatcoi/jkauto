import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { detectStack } from './detector'
import type {
  AnalysisFinding,
  DetectedModule,
  Language,
  ModuleRole,
  ProjectTag,
  SourceFileInfo,
  WorkspaceAnalysis,
  CodeRelation,
} from './types'

const SKIP_DIRS = new Set([
  '.git', '.autotest', '.idea', '.vscode', 'node_modules', 'dist', 'build',
  'out', 'target', 'coverage', '.next', '.nuxt', '.gradle', 'vendor',
])
const MANIFESTS = new Set([
  'package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'go.mod',
  'Cargo.toml', 'composer.json', 'requirements.txt', 'pyproject.toml',
  'pubspec.yaml',
])
const ENTRYPOINT_NAMES = new Set([
  'main.ts', 'main.tsx', 'main.js', 'main.jsx', 'server.ts', 'server.js',
  'app.ts', 'app.js', 'manage.py', 'main.py', 'Program.cs',
])
const CONFIG_NAMES = new Set([
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml',
  'compose.yaml', '.env.example', '.env.sample', 'angular.json',
  'workspace.json', 'nx.json', 'turbo.json', 'pnpm-workspace.yaml',
])
const MAX_MANIFEST_DEPTH = 5
const MAX_FILE_SIZE = 1_000_000

function normalize(value: string): string {
  return value.split(path.sep).join('/')
}

function languageForFile(file: string): SourceFileInfo['language'] {
  const ext = path.extname(file).toLowerCase()
  if (['.ts', '.tsx'].includes(ext)) return 'typescript'
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript'
  if (['.java', '.kt', '.kts'].includes(ext)) return ext === '.java' ? 'java' : 'kotlin'
  if (ext === '.go') return 'go'
  if (ext === '.rs') return 'rust'
  if (ext === '.py') return 'python'
  if (ext === '.php') return 'php'
  if (ext === '.cs') return 'csharp'
  if (ext === '.sql') return 'sql'
  if (['.yml', '.yaml'].includes(ext)) return 'yaml'
  if (ext === '.json') return 'json'
  if (['.md', '.mdx', '.rst'].includes(ext)) return 'markdown'
  return 'other'
}

function manifestContent(root: string): string {
  const parts: string[] = []
  for (const manifest of MANIFESTS) {
    const file = path.join(root, manifest)
    if (!fs.existsSync(file)) continue
    try { parts.push(fs.readFileSync(file, 'utf-8').toLocaleLowerCase()) } catch {}
  }
  return parts.join('\n')
}

function roleFor(root: string, stack: ReturnType<typeof detectStack>): ModuleRole {
  const name = path.basename(root).toLowerCase()
  const manifest = manifestContent(root)
  if (
    /android|ios|mobile|expo|flutter/.test(name) ||
    /react-native|@expo\/|flutter:/.test(manifest)
  ) return 'mobile'
  if (
    /desktop|electron|tauri/.test(name) ||
    /"electron"|"@tauri-apps\//.test(manifest)
  ) return 'desktop'
  if (/front|web|client|ui/.test(name)) return 'frontend'
  if (/back|server|api/.test(name)) return 'backend'
  if (/infra|deploy|ops|sso/.test(name)) return 'infrastructure'
  if (/database|db|schema|migration/.test(name)) return 'database'
  if (/test|e2e|automation/.test(name)) return 'automation'
  if (['react', 'nextjs', 'vue', 'nuxt', 'angular', 'svelte'].includes(stack.framework)) return 'frontend'
  if (['spring', 'quarkus', 'micronaut', 'nestjs', 'express', 'fastify', 'koa', 'gin', 'echo', 'fiber', 'chi', 'actix', 'axum', 'rocket', 'fastapi', 'django', 'flask', 'laravel', 'symfony', 'codeigniter'].includes(stack.framework)) return 'backend'
  if (/playwright|cypress|appium|webdriverio|maestro/.test(manifest)) return 'automation'
  if (/tensorflow|pytorch|torch|scikit-learn|pandas|jupyter/.test(manifest)) return 'data'
  if (/"bin"\s*:|commander|yargs|oclif/.test(manifest)) return 'cli'
  if (
    fs.existsSync(path.join(root, 'package.json')) ||
    fs.existsSync(path.join(root, 'Cargo.toml')) ||
    fs.existsSync(path.join(root, 'pyproject.toml'))
  ) return 'library'
  return 'unknown'
}

function tagsForModule(root: string, role: ModuleRole, stack: ReturnType<typeof detectStack>): ProjectTag[] {
  const manifest = stack.readmePath ?? root
  const ref = [{ file: manifest }]
  const tags: ProjectTag[] = []
  if (role === 'frontend') tags.push({ type: 'web-application', confidence: 0.95, evidence: ref })
  if (role === 'backend') tags.push({ type: 'backend-api', confidence: 0.95, evidence: ref })
  if (role === 'mobile') tags.push({ type: 'mobile-app', confidence: 0.9, evidence: ref })
  if (role === 'desktop') tags.push({ type: 'desktop-app', confidence: 0.9, evidence: ref })
  if (role === 'infrastructure') tags.push({ type: 'infrastructure-devops', confidence: 0.9, evidence: ref })
  if (role === 'database') tags.push({ type: 'database', confidence: 0.95, evidence: ref })
  if (role === 'automation') tags.push({ type: 'automation-test', confidence: 0.9, evidence: ref })
  if (role === 'cli') tags.push({ type: 'cli-tool', confidence: 0.9, evidence: ref })
  if (role === 'data') tags.push({ type: 'data-ai', confidence: 0.9, evidence: ref })
  if (role === 'library') tags.push({ type: 'library-sdk', confidence: 0.8, evidence: ref })
  if (
    role === 'backend' &&
    (fs.existsSync(path.join(root, 'Dockerfile')) || fs.existsSync(path.join(root, 'docker-compose.yml')))
  ) {
    tags.push({ type: 'microservice', confidence: 0.7, evidence: ref })
  }
  if (tags.length === 0) tags.push({ type: 'unknown-mixed', confidence: 0.35, evidence: ref })
  return tags
}

function discoverManifestRoots(root: string): Map<string, string[]> {
  const roots = new Map<string, string[]>()
  function walk(dir: string, depth: number): void {
    if (depth > MAX_MANIFEST_DEPTH) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.isFile() && MANIFESTS.has(entry.name)) {
        const files = roots.get(dir) ?? []
        files.push(path.join(dir, entry.name))
        roots.set(dir, files)
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), depth + 1)
      }
    }
  }
  walk(root, 0)
  return roots
}

function infrastructureModules(root: string): Array<{ root: string; manifests: string[]; role: ModuleRole }> {
  const result: Array<{ root: string; manifests: string[]; role: ModuleRole }> = []
  for (const candidate of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    const file = path.join(root, candidate)
    if (fs.existsSync(file)) {
      result.push({ root, manifests: [file], role: 'infrastructure' })
      break
    }
  }
  for (const dirName of ['database', 'db', 'sso', 'infra', 'infrastructure']) {
    const dir = path.join(root, dirName)
    if (!fs.existsSync(dir)) continue
    const role: ModuleRole = /database|db/.test(dirName) ? 'database' : 'infrastructure'
    const manifests = fs.readdirSync(dir)
      .filter((name) => /\.(sql|ya?ml|json)$/i.test(name))
      .map((name) => path.join(dir, name))
    result.push({ root: dir, manifests, role })
  }
  return result
}

function buildModules(root: string): DetectedModule[] {
  const manifestRoots = discoverManifestRoots(root)
  const candidates = [
    ...Array.from(manifestRoots, ([moduleRoot, manifests]) => ({ root: moduleRoot, manifests, role: undefined as ModuleRole | undefined })),
    ...infrastructureModules(root),
  ]
  const seen = new Set<string>()
  const modules: DetectedModule[] = []
  for (const candidate of candidates) {
    const key = `${candidate.root}:${candidate.role ?? 'code'}`
    if (seen.has(key)) continue
    seen.add(key)
    const stack = detectStack(candidate.root)
    const role = candidate.role ?? roleFor(candidate.root, stack)
    const relativeRoot = normalize(path.relative(root, candidate.root)) || '.'
    modules.push({
      id: crypto.createHash('sha1').update(key).digest('hex').slice(0, 16),
      name: relativeRoot === '.' ? path.basename(root) : path.basename(candidate.root),
      root: candidate.root,
      relativeRoot,
      role,
      stack,
      tags: tagsForModule(candidate.root, role, stack),
      manifests: candidate.manifests,
    })
  }
  if (modules.length === 0) {
    const stack = detectStack(root)
    const role = roleFor(root, stack)
    modules.push({
      id: crypto.createHash('sha1').update(root).digest('hex').slice(0, 16),
      name: path.basename(root),
      root,
      relativeRoot: '.',
      role,
      stack,
      tags: tagsForModule(root, role, stack),
      manifests: [],
    })
  }
  return modules
}

function ownerFor(file: string, modules: DetectedModule[]): DetectedModule {
  return modules
    .filter((module) => file === module.root || file.startsWith(`${module.root}${path.sep}`))
    .sort((a, b) => b.root.length - a.root.length)[0] ?? modules[0]
}

function scanFiles(root: string, modules: DetectedModule[]): { files: SourceFileInfo[]; skipped: number } {
  const files: SourceFileInfo[] = []
  let skipped = 0
  function walk(dir: string): void {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { skipped += 1; return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) skipped += 1
        else walk(full)
        continue
      }
      if (!entry.isFile()) continue
      let stat: fs.Stats
      try { stat = fs.statSync(full) } catch { skipped += 1; continue }
      if (stat.size > MAX_FILE_SIZE) { skipped += 1; continue }
      const language = languageForFile(full)
      if (
        language === 'other' &&
        !ENTRYPOINT_NAMES.has(entry.name) &&
        !MANIFESTS.has(entry.name) &&
        !CONFIG_NAMES.has(entry.name) &&
        !/^\.env(?:\.|$)/.test(entry.name)
      ) continue
      let content: Buffer
      try { content = fs.readFileSync(full) } catch { skipped += 1; continue }
      const owner = ownerFor(full, modules)
      const shouldPreview =
        ['markdown', 'yaml', 'json', 'sql'].includes(language) ||
        MANIFESTS.has(entry.name) ||
        CONFIG_NAMES.has(entry.name) ||
        /\.env\.(?:example|sample)$/i.test(entry.name) ||
        ENTRYPOINT_NAMES.has(entry.name)
      files.push({
        path: full,
        relativePath: normalize(path.relative(root, full)),
        moduleId: owner.id,
        language,
        size: stat.size,
        contentHash: crypto.createHash('sha256').update(content).digest('hex'),
        preview: shouldPreview
          ? content.toString('utf-8').replace(/\0/g, '').slice(0, 8_000)
          : undefined,
      })
    }
  }
  walk(root)
  return { files, skipped }
}

function initialFindings(files: SourceFileInfo[], modules: DetectedModule[]): AnalysisFinding[] {
  const findings: AnalysisFinding[] = []
  for (const file of files) {
    const base = path.basename(file.path)
    if (ENTRYPOINT_NAMES.has(base) || /Application\.java$/.test(base)) {
      findings.push({
        id: `entrypoint:${file.relativePath}`,
        kind: 'entrypoint',
        name: base,
        summary: `Entrypoint candidate in ${file.relativePath}`,
        status: 'verified',
        confidence: 0.9,
        sourceRefs: [{ file: file.path }],
        moduleId: file.moduleId,
      })
    }
    if (/^readme|\.md$/i.test(base)) {
      findings.push({
        id: `documentation:${file.relativePath}`,
        kind: 'documentation',
        name: base,
        summary: `Project documentation at ${file.relativePath}`,
        status: 'verified',
        confidence: 1,
        sourceRefs: [{ file: file.path }],
        moduleId: file.moduleId,
      })
    }
    if (/auth|login|oauth|security/i.test(file.relativePath)) {
      findings.push({
        id: `auth:${file.relativePath}`,
        kind: 'auth',
        name: file.relativePath,
        summary: 'Authentication or authorization implementation candidate.',
        status: 'inferred',
        confidence: 0.65,
        sourceRefs: [{ file: file.path }],
        moduleId: file.moduleId,
      })
    }
    if (file.language === 'sql' || /schema|migration|changelog/i.test(file.relativePath)) {
      findings.push({
        id: `database:${file.relativePath}`,
        kind: 'database',
        name: file.relativePath,
        summary: 'Database schema or migration source.',
        status: 'verified',
        confidence: 0.9,
        sourceRefs: [{ file: file.path }],
        moduleId: file.moduleId,
      })
      if (file.language === 'sql' && file.preview) {
        const tablePattern = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([\w.]+)["`]?/gi
        let table: RegExpExecArray | null
        while ((table = tablePattern.exec(file.preview)) !== null) {
          findings.push({
            id: `database-table:${file.relativePath}:${table[1]}`,
            kind: 'database',
            name: table[1],
            summary: `Database table declared in ${file.relativePath}.`,
            status: 'verified',
            confidence: 0.95,
            sourceRefs: [{
              file: file.path,
              line: file.preview.slice(0, table.index).split('\n').length,
              symbol: table[1],
            }],
            moduleId: file.moduleId,
          })
        }
      }
    }
  }
  return findings
}

function importRelations(files: SourceFileInfo[]): CodeRelation[] {
  const relations: CodeRelation[] = []
  const byPath = new Map(files.map((file) => [path.resolve(file.path), file]))
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.java', '/index.ts', '/index.tsx', '/index.js']
  for (const file of files) {
    if (!['typescript', 'javascript', 'java', 'kotlin'].includes(file.language)) continue
    let source: string
    try { source = fs.readFileSync(file.path, 'utf-8') } catch { continue }
    const specifiers: Array<{ value: string; index: number }> = []
    const patterns = file.language === 'typescript' || file.language === 'javascript'
      ? [
          /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
          /require\(\s*['"]([^'"]+)['"]\s*\)/g,
        ]
      : [/^\s*import\s+([\w.]+);/gm]
    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      pattern.lastIndex = 0
      while ((match = pattern.exec(source)) !== null) {
        specifiers.push({ value: match[1], index: match.index })
      }
    }
    for (const specifier of specifiers) {
      let target: SourceFileInfo | undefined
      if (specifier.value.startsWith('.')) {
        const base = path.resolve(path.dirname(file.path), specifier.value)
        target = extensions
          .map((extension) => byPath.get(`${base}${extension}`))
          .find(Boolean)
      } else if (file.language === 'java' || file.language === 'kotlin') {
        const suffix = specifier.value.replace(/\./g, path.sep)
        target = files.find((candidate) =>
          candidate.path.endsWith(`${suffix}.java`) ||
          candidate.path.endsWith(`${suffix}.kt`),
        )
      }
      if (!target) continue
      relations.push({
        from: `file:${file.relativePath}`,
        to: `file:${target.relativePath}`,
        type: 'imports',
        sourceRef: {
          file: file.path,
          line: source.slice(0, specifier.index).split('\n').length,
        },
        confidence: 0.95,
      })
    }
  }
  return relations
}

export function discoverWorkspace(root: string): WorkspaceAnalysis {
  const modules = buildModules(root)
  const { files, skipped } = scanFiles(root, modules)
  const tags: ProjectTag[] = modules.flatMap((module) => module.tags)
  if (modules.filter((module) => module.role !== 'infrastructure' && module.role !== 'database').length > 1) {
    tags.unshift({
      type: 'monorepo',
      confidence: 0.98,
      evidence: modules.flatMap((module) => module.manifests.map((file) => ({ file }))).slice(0, 20),
    })
  }
  const relations: CodeRelation[] = modules.flatMap((module) =>
    module.manifests.map((manifest) => ({
      from: `module:${module.id}`,
      to: `file:${normalize(path.relative(root, manifest))}`,
      type: 'contains' as const,
      sourceRef: { file: manifest },
      confidence: 1,
    })),
  )
  relations.push(...importRelations(files))
  return {
    root,
    tags,
    modules,
    files,
    relations,
    findings: initialFindings(files, modules),
    gaps: [],
    diagnostics: {
      scannedFiles: files.length,
      parsedFiles: 0,
      failedFiles: 0,
      unsupportedFiles: files.filter((file) => file.language === 'other').length,
      skippedFiles: skipped,
      coverage: 0,
    },
  }
}
