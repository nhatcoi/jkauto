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
import { startIndex } from '../autogen/autogen.service'
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
): Promise<ArtifactInput> {
  const refs = [stack.readmePath].filter((value): value is string => Boolean(value))
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
      type: 'runtime-requirements',
      title: 'Runtime requirements',
      summary: `Runtime candidates inferred for ${stack.framework}.`,
      content: runtimeRequirements(stack),
      itemCount: 1,
      confidence: 0.7,
      sourceRefs: [],
    },
    await documentationArtifact(sourcePath, stack),
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
