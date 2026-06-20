import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  CodeAnalysisArtifact,
  CodeAnalysisArtifactType,
  CodeAnalysisProgress,
  CodeAnalysisReport,
} from '@jkauto/core'
import type { CodeMap, DetectedStack } from '@jkauto/indexer'
import {
  getCodeKnowledgeSnapshot,
  startIndex,
} from '../autogen/autogen.service'
import {
  completeAnalysisRun,
  createAnalysisRun,
  failAnalysisRun,
  getAnalysisArtifacts,
  getAnalysisRun,
  getRepoIndex,
  saveAnalysisArtifact,
} from '../autogen/autogen-db'

interface StartAnalysisParams {
  projectPath: string
  sourceRef?: string
  branch?: string
}

interface ArtifactInput {
  type: CodeAnalysisArtifactType
  title: string
  summary: string
  content: unknown
  itemCount: number
  confidence?: number
  sourceRefs?: string[]
}

async function resolveSourceRef(
  projectPath: string,
  sourceRef?: string,
): Promise<string> {
  if (sourceRef?.trim()) return sourceRef.trim()
  const raw = await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8')
  const project = JSON.parse(raw) as { repoUrl?: string }
  if (!project.repoUrl?.trim()) {
    throw new Error('Configure a repository URL or local source path first.')
  }
  return project.repoUrl.trim()
}

async function isLocalSource(sourceRef: string): Promise<boolean> {
  try {
    return (await fs.stat(sourceRef)).isDirectory()
  } catch {
    return false
  }
}

function runtimeRequirements(stack: DetectedStack): Record<string, unknown> {
  const commands: Record<string, string[]> = {
    spring: ['./mvnw spring-boot:run', './gradlew bootRun'],
    nestjs: ['npm install', 'npm run start:dev'],
    express: ['npm install', 'npm start'],
    fastify: ['npm install', 'npm start'],
    nextjs: ['npm install', 'npm run dev'],
    react: ['npm install', 'npm run dev'],
    fastapi: ['pip install -r requirements.txt', 'uvicorn main:app --reload'],
    django: ['pip install -r requirements.txt', 'python manage.py runserver'],
    flask: ['pip install -r requirements.txt', 'flask run'],
  }
  return {
    framework: stack.framework,
    language: stack.language,
    suggestedCommands: commands[stack.framework] ?? [],
    hasOpenApi: stack.hasOpenApi,
    openApiPath: stack.openApiPath,
    testFramework: stack.testFramework,
    requiresRuntimeValidation: true,
    note: 'Commands are inferred candidates and must be validated before execution.',
  }
}

async function documentationArtifact(
  sourcePath: string,
  stack: DetectedStack,
  map: CodeMap,
): Promise<ArtifactInput> {
  const refs = Array.from(new Set([
    stack.readmePath,
    ...(map.workspace?.files
      .filter((file) => file.language === 'markdown')
      .map((file) => file.path) ?? []),
  ].filter((value): value is string => Boolean(value))))
  let excerpt = ''
  if (stack.readmePath) {
    try {
      excerpt = (await fs.readFile(stack.readmePath, 'utf-8')).slice(0, 20_000)
    } catch {
      excerpt = ''
    }
  }
  return {
    type: 'documentation',
    title: 'Project documentation',
    summary: refs.length
      ? `${refs.length} root documentation source indexed.`
      : 'No root README was detected.',
    content: {
      sourceRoot: sourcePath,
      files: refs,
      readmeExcerpt: excerpt,
      previews: map.workspace?.files
        .filter((file) => file.language === 'markdown' && file.preview)
        .slice(0, 20)
        .map((file) => ({
          file: file.path,
          preview: file.preview?.slice(0, 2_000),
        })) ?? [],
    },
    itemCount: refs.length,
    confidence: refs.length ? 1 : 0.5,
    sourceRefs: refs,
  }
}

async function buildArtifacts(
  sourcePath: string,
  stack: DetectedStack,
  map: CodeMap,
): Promise<ArtifactInput[]> {
  const counts = {
    pages: map.pages.length,
    endpoints: map.endpoints.length,
    elements: map.elements.length,
    symbols: map.symbols.length,
  }
  const sourceFiles = Array.from(new Set([
    ...map.pages.map((item) => item.componentFile),
    ...map.endpoints.map((item) => item.sourceFile),
    ...map.elements.map((item) => item.sourceFile),
    ...map.symbols.map((item) => item.file),
  ].filter(Boolean)))
  const workspace = map.workspace
  const testTargets = [
    ...map.pages.map((page) => ({
      type: 'page',
      id: page.route,
      name: page.componentName,
      status: 'verified',
      confidence: 0.9,
      sourceRefs: [page.componentFile],
    })),
    ...map.endpoints.map((endpoint) => ({
      type: 'api',
      id: `${endpoint.method} ${endpoint.path}`,
      name: endpoint.summary ?? endpoint.path,
      status: 'verified',
      confidence: 0.95,
      sourceRefs: [endpoint.sourceFile],
    })),
    ...(workspace?.findings
      .filter((finding) => finding.kind === 'auth' || finding.kind === 'database')
      .map((finding) => ({
        type: finding.kind === 'auth' ? 'flow' : 'data',
        id: finding.id,
        name: finding.name,
        status: finding.status,
        confidence: finding.confidence,
        sourceRefs: finding.sourceRefs.map((ref) => ref.file),
      })) ?? []),
  ]

  return [
    {
      type: 'project-summary',
      title: 'Project summary',
      summary: `${stack.framework} / ${stack.language}; ${counts.pages} pages, ${counts.endpoints} endpoints, ${counts.symbols} symbols.`,
      content: {
        stack,
        counts,
        sourceRoot: sourcePath,
        sourceFileCount: sourceFiles.length,
      },
      itemCount: Object.values(counts).reduce((total, count) => total + count, 0),
      sourceRefs: sourceFiles.slice(0, 100),
    },
    {
      type: 'project-classification',
      title: 'Project type detection',
      summary: workspace
        ? `${workspace.tags.length} workspace tags detected with evidence.`
        : 'No workspace classification is available.',
      content: {
        tags: workspace?.tags ?? [],
        primaryStack: stack,
      },
      itemCount: workspace?.tags.length ?? 0,
      confidence: workspace?.tags.length
        ? Math.max(...workspace.tags.map((tag) => tag.confidence))
        : 0,
      sourceRefs: workspace?.tags.flatMap((tag) => tag.evidence.map((ref) => ref.file)) ?? [],
    },
    {
      type: 'module-catalog',
      title: 'Workspace modules',
      summary: `${workspace?.modules.length ?? 0} independently classified modules discovered.`,
      content: { modules: workspace?.modules ?? [] },
      itemCount: workspace?.modules.length ?? 0,
      confidence: workspace?.modules.length ? 0.95 : 0,
      sourceRefs: workspace?.modules.flatMap((module) => module.manifests) ?? [],
    },
    {
      type: 'route-catalog',
      title: 'Routes and API endpoints',
      summary: `${counts.pages} UI routes and ${counts.endpoints} API endpoints discovered.`,
      content: { pages: map.pages, endpoints: map.endpoints },
      itemCount: counts.pages + counts.endpoints,
      sourceRefs: Array.from(new Set([
        ...map.pages.map((item) => item.componentFile),
        ...map.endpoints.map((item) => item.sourceFile),
      ].filter(Boolean))),
    },
    {
      type: 'ui-catalog',
      title: 'UI elements',
      summary: `${counts.elements} testable UI elements discovered.`,
      content: { elements: map.elements },
      itemCount: counts.elements,
      sourceRefs: Array.from(new Set(map.elements.map((item) => item.sourceFile).filter(Boolean))),
    },
    {
      type: 'symbol-catalog',
      title: 'Code symbols',
      summary: `${counts.symbols} exported functions, classes, services, models, and components discovered.`,
      content: { symbols: map.symbols },
      itemCount: counts.symbols,
      sourceRefs: Array.from(new Set(map.symbols.map((item) => item.file).filter(Boolean))),
    },
    {
      type: 'knowledge-graph',
      title: 'Codebase knowledge graph',
      summary: `${workspace?.relations.length ?? 0} verified or inferred relationships.`,
      content: {
        relations: workspace?.relations ?? [],
        findings: workspace?.findings ?? [],
      },
      itemCount: (workspace?.relations.length ?? 0) + (workspace?.findings.length ?? 0),
      confidence: workspace?.relations.length ? 0.85 : 0,
      sourceRefs: workspace?.relations
        .flatMap((relation) => relation.sourceRef?.file ? [relation.sourceRef.file] : []) ?? [],
    },
    {
      type: 'analysis-coverage',
      title: 'Analysis coverage',
      summary: workspace
        ? `${Math.round(workspace.diagnostics.coverage * 100)}% static file coverage; ${workspace.diagnostics.failedFiles} failures.`
        : 'Coverage diagnostics unavailable.',
      content: workspace?.diagnostics ?? {},
      itemCount: workspace?.diagnostics.scannedFiles ?? 0,
      confidence: 1,
      sourceRefs: [],
    },
    {
      type: 'known-unknowns',
      title: 'Known unknowns',
      summary: `${workspace?.gaps.length ?? 0} knowledge gaps require tool or runtime verification.`,
      content: { gaps: workspace?.gaps ?? [] },
      itemCount: workspace?.gaps.length ?? 0,
      confidence: 1,
      sourceRefs: [],
    },
    {
      type: 'test-targets',
      title: 'Verified test targets',
      summary: `${testTargets.length} candidate pages, APIs, flows, and data surfaces.`,
      content: { targets: testTargets },
      itemCount: testTargets.length,
      confidence: testTargets.length
        ? testTargets.reduce((sum, target) => sum + target.confidence, 0) / testTargets.length
        : 0,
      sourceRefs: Array.from(new Set(testTargets.flatMap((target) => target.sourceRefs))),
    },
    {
      type: 'runtime-requirements',
      title: 'Runtime requirements',
      summary: `Runtime candidates inferred for ${stack.framework}.`,
      content: runtimeRequirements(stack),
      itemCount: 1,
      confidence: 0.7,
      sourceRefs: [],
    },
    await documentationArtifact(sourcePath, stack, map),
  ]
}

export async function startCodeAnalysis(
  params: StartAnalysisParams,
  onProgress: (progress: CodeAnalysisProgress) => void,
): Promise<CodeAnalysisReport> {
  const sourceRef = await resolveSourceRef(params.projectPath, params.sourceRef)
  const sourceType = await isLocalSource(sourceRef) ? 'local' : 'git'
  const runId = randomUUID()
  createAnalysisRun(params.projectPath, {
    id: runId,
    sourceRef,
    sourceType,
    startedAt: new Date().toISOString(),
  })
  onProgress({
    runId,
    phase: 'source',
    message: `Resolved ${sourceType} source.`,
    percent: 2,
  })

  try {
    const result = await startIndex(
      {
        repoUrl: sourceRef,
        projectPath: params.projectPath,
        branch: params.branch,
      },
      (progress) => onProgress({ runId, ...progress }),
    )
    onProgress({
      runId,
      phase: 'artifacts',
      message: 'Building analysis artifacts...',
      percent: 92,
    })
    const sourcePath = sourceType === 'local'
      ? path.resolve(sourceRef)
      : String(getRepoIndex(params.projectPath)?.local_path ?? sourceRef)
    onProgress({
      runId,
      phase: 'memory',
      message: `Knowledge memory: ${result.memoryUpdate.created} new, ${result.memoryUpdate.updated} updated, ${result.memoryUpdate.stale} stale.`,
      percent: 88,
    })
    const artifacts = await buildArtifacts(sourcePath, result.stack, result.map)
    const createdAt = new Date().toISOString()
    for (const artifact of artifacts) {
      saveAnalysisArtifact(params.projectPath, {
        id: randomUUID(),
        runId,
        type: artifact.type,
        title: artifact.title,
        summary: artifact.summary,
        contentJson: JSON.stringify(artifact.content),
        itemCount: artifact.itemCount,
        confidence: artifact.confidence ?? 1,
        sourceRefs: artifact.sourceRefs ?? [],
        createdAt,
      })
    }
    completeAnalysisRun(params.projectPath, runId, {
      indexId: result.indexId,
      framework: result.stack.framework,
      language: result.stack.language,
      completedAt: new Date().toISOString(),
    })
    onProgress({
      runId,
      phase: 'done',
      message: `Analysis completed with ${artifacts.length} artifacts.`,
      percent: 100,
    })
    return getCodeAnalysisReport(params.projectPath, runId)!
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failAnalysisRun(params.projectPath, runId, message)
    onProgress({ runId, phase: 'error', message, percent: 0 })
    throw error
  }
}

export function getCodeAnalysisReport(
  projectPath: string,
  runId?: string,
): CodeAnalysisReport | null {
  const rawRun = getAnalysisRun(projectPath, runId) as any
  if (!rawRun) return null
  const artifacts = getAnalysisArtifacts(projectPath, rawRun.id).map((row: any) => ({
    id: row.id,
    runId: row.run_id,
    type: row.artifact_type,
    title: row.title,
    summary: row.summary,
    contentJson: row.content_json,
    itemCount: row.item_count,
    confidence: row.confidence,
    sourceRefs: JSON.parse(row.source_refs_json),
    createdAt: row.created_at,
  })) as CodeAnalysisArtifact[]
  const summaryArtifact = artifacts.find((item) => item.type === 'project-summary')
  const counts = summaryArtifact
    ? (JSON.parse(summaryArtifact.contentJson) as { counts?: Record<string, number> }).counts
    : undefined
  const classificationArtifact = artifacts.find((item) => item.type === 'module-catalog')
  const coverageArtifact = artifacts.find((item) => item.type === 'analysis-coverage')
  const gapsArtifact = artifacts.find((item) => item.type === 'known-unknowns')
  const classification = classificationArtifact
    ? JSON.parse(classificationArtifact.contentJson) as { modules?: unknown[] }
    : {}
  const coverage = coverageArtifact
    ? JSON.parse(coverageArtifact.contentJson) as { coverage?: number }
    : {}
  const gaps = gapsArtifact
    ? JSON.parse(gapsArtifact.contentJson) as { gaps?: unknown[] }
    : {}
  const knowledge = getCodeKnowledgeSnapshot(projectPath)
  const graphNodeCount = (knowledge.counts as Array<{ count?: number }>).reduce(
    (total, row) => total + Number(row.count ?? 0),
    0,
  )
  return {
    run: {
      id: rawRun.id,
      projectPath: rawRun.project_path,
      sourceRef: rawRun.source_ref,
      sourceType: rawRun.source_type,
      status: rawRun.status,
      indexId: rawRun.index_id ?? undefined,
      framework: rawRun.framework ?? undefined,
      language: rawRun.language ?? undefined,
      error: rawRun.error ?? undefined,
      startedAt: rawRun.started_at,
      completedAt: rawRun.completed_at ?? undefined,
    },
    artifacts,
    summary: {
      artifactCount: artifacts.length,
      pageCount: counts?.pages ?? 0,
      endpointCount: counts?.endpoints ?? 0,
      elementCount: counts?.elements ?? 0,
      symbolCount: counts?.symbols ?? 0,
      moduleCount: classification.modules?.length ?? 0,
      gapCount: gaps.gaps?.length ?? 0,
      graphNodeCount,
      graphEdgeCount: knowledge.edgeCount,
      coverage: coverage.coverage ?? 0,
    },
  }
}

export function formatAnalysisCommandResult(
  report: CodeAnalysisReport | null,
  command: string,
): string {
  if (!report) return 'No code analysis exists. Run `/analysis refresh` first.'
  if (report.run.status === 'failed') {
    return `Code analysis failed: ${report.run.error ?? 'Unknown error'}`
  }
  const artifactType = command === 'routes'
    ? 'route-catalog'
    : command === 'symbols'
      ? 'symbol-catalog'
      : null
  if (artifactType) {
    const artifact = report.artifacts.find((item) => item.type === artifactType)
    return artifact
      ? `${artifact.title}: ${artifact.summary}\n\nOpen Code Analysis in Explorer to inspect the complete artifact.`
      : `Artifact ${artifactType} is not available.`
  }
  return [
    `Code analysis: ${report.run.status}`,
    `Source: ${report.run.sourceRef}`,
    `Stack: ${report.run.framework ?? 'unknown'} / ${report.run.language ?? 'unknown'}`,
    `Artifacts: ${report.summary.artifactCount}`,
    `Pages: ${report.summary.pageCount}, endpoints: ${report.summary.endpointCount}, UI elements: ${report.summary.elementCount}, symbols: ${report.summary.symbolCount}`,
  ].join('\n')
}
