import crypto, { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { stringify as yamlStringify } from 'yaml'
import { cloneRepo, indexRepo, resolveLocalPath, buildContext } from '@jkauto/indexer'
import type { IndexProgress, CodeMap, DetectedStack } from '@jkauto/indexer'
import {
  getAutogenDb,
  upsertRepoIndex,
  deleteIndexData,
  getRepoIndex,
  saveCodeMap,
  getStoredCodeMap,
  saveKnowledgeGraph,
  searchKnowledge,
  getKnowledgeSnapshot,
  traverseKnowledge,
  rememberKnowledgeNode,
} from './autogen-db'
import { generateTestsForTargets } from './test-generator'

export interface StartIndexParams {
  repoUrl: string
  projectPath: string
  branch?: string
}

export interface StartIndexResult {
  indexId: string
  stack: DetectedStack
  map: CodeMap
  memoryUpdate: {
    created: number
    updated: number
    unchanged: number
    stale: number
  }
}

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function buildKnowledgeGraph(map: CodeMap) {
  const workspace = map.workspace
  const nodes: Parameters<typeof saveKnowledgeGraph>[2] = []
  const edges: Parameters<typeof saveKnowledgeGraph>[3] = []
  if (workspace) {
    nodes.push({
      stableKey: 'workspace:root',
      kind: 'workspace',
      name: path.basename(workspace.root),
      summary: workspace.tags.map((tag) => tag.type).join(', '),
      confidence: Math.max(0.5, ...workspace.tags.map((tag) => tag.confidence)),
      sourceRefs: workspace.tags.flatMap((tag) => tag.evidence),
      metadata: {
        tags: workspace.tags,
        diagnostics: workspace.diagnostics,
      },
      contentHash: stableHash({
        tags: workspace.tags,
        diagnostics: workspace.diagnostics,
      }),
    })
    for (const module of workspace.modules) {
      nodes.push({
        stableKey: `module:${module.id}`,
        kind: 'module',
        name: module.relativeRoot,
        summary: `${module.role}; ${module.stack.framework}/${module.stack.language}`,
        confidence: Math.max(...module.tags.map((tag) => tag.confidence), 0.5),
        moduleId: module.id,
        sourceRefs: module.manifests.map((file) => ({ file })),
        metadata: module as unknown as Record<string, unknown>,
        contentHash: stableHash(module),
      })
      edges.push({
        sourceKey: 'workspace:root',
        targetKey: `module:${module.id}`,
        relation: 'contains',
      })
    }
    for (const file of workspace.files) {
      const meaningfulPreview = file.preview
        ?.split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 40)
        .join('\n')
      nodes.push({
        stableKey: `file:${file.relativePath}`,
        kind: 'file',
        name: file.relativePath,
        summary: meaningfulPreview
          ? `${file.language} source file\n${meaningfulPreview}`
          : `${file.language} source file`,
        moduleId: file.moduleId,
        contentHash: file.contentHash,
        sourceRefs: [{ file: file.path }],
        metadata: {
          language: file.language,
          size: file.size,
          relativePath: file.relativePath,
          preview: file.preview,
        },
      })
    }
    for (const finding of workspace.findings) {
      nodes.push({
        stableKey: `finding:${finding.id}`,
        kind: finding.kind,
        name: finding.name,
        summary: finding.summary,
        status: finding.status,
        confidence: finding.confidence,
        producer: 'static',
        moduleId: finding.moduleId,
        sourceRefs: finding.sourceRefs,
        metadata: finding as unknown as Record<string, unknown>,
        contentHash: stableHash(finding),
      })
    }
    for (const gap of workspace.gaps) {
      nodes.push({
        stableKey: `gap:${gap.id}`,
        kind: 'gap',
        name: gap.title,
        summary: gap.reason,
        status: 'unknown',
        confidence: 0,
        moduleId: gap.moduleId,
        metadata: gap as unknown as Record<string, unknown>,
        contentHash: stableHash(gap),
      })
    }
    edges.push(...workspace.relations.map((relation) => ({
      sourceKey: relation.from,
      targetKey: relation.to,
      relation: relation.type,
      confidence: relation.confidence,
      sourceRef: relation.sourceRef,
    })))
  }
  for (const page of map.pages) {
    nodes.push({
      stableKey: `route:${page.route}`,
      kind: 'route',
      name: page.route,
      summary: `UI route rendered by ${page.componentName}`,
      sourceRefs: [{ file: page.componentFile }],
      metadata: page as unknown as Record<string, unknown>,
      contentHash: stableHash(page),
    })
  }
  for (const endpoint of map.endpoints) {
    nodes.push({
      stableKey: `endpoint:${endpoint.method}:${endpoint.path}`,
      kind: 'endpoint',
      name: `${endpoint.method} ${endpoint.path}`,
      summary: endpoint.summary ?? 'HTTP API endpoint',
      sourceRefs: [{ file: endpoint.sourceFile }],
      metadata: endpoint as unknown as Record<string, unknown>,
      contentHash: stableHash(endpoint),
    })
  }
  for (const element of map.elements) {
    nodes.push({
      stableKey: `element:${element.sourceFile}:${element.line}:${element.name}`,
      kind: 'element',
      name: element.name,
      summary: `${element.tag} UI element`,
      sourceRefs: [{ file: element.sourceFile, line: element.line }],
      metadata: element as unknown as Record<string, unknown>,
      contentHash: stableHash(element),
    })
  }
  for (const symbol of map.symbols) {
    nodes.push({
      stableKey: `symbol:${symbol.file}:${symbol.line}:${symbol.name}`,
      kind: 'symbol',
      name: symbol.name,
      summary: `${symbol.kind} declared in ${symbol.file}`,
      sourceRefs: [{ file: symbol.file, line: symbol.line, symbol: symbol.name }],
      metadata: symbol as unknown as Record<string, unknown>,
      contentHash: stableHash(symbol),
    })
  }
  return {
    nodes: Array.from(new Map(nodes.map((node) => [node.stableKey, node])).values()),
    edges: Array.from(
      new Map(
        edges.map((edge) => [
          `${edge.sourceKey}:${edge.relation}:${edge.targetKey}`,
          edge,
        ]),
      ).values(),
    ),
  }
}

export async function startIndex(
  params: StartIndexParams,
  onProgress: (p: IndexProgress) => void
): Promise<StartIndexResult> {
  const { repoUrl, projectPath, branch } = params
  const autotestDir = path.join(projectPath, '.autotest')
  let localPath = resolveLocalPath(autotestDir, repoUrl)

  // Delete old index for this project if exists
  const existing = getRepoIndex(projectPath) as any
  if (existing) deleteIndexData(projectPath, existing.id)

  // A local source path is indexed in-place. Git URLs keep using the managed cache.
  try {
    const stat = await fs.stat(repoUrl)
    if (stat.isDirectory()) {
      localPath = path.resolve(repoUrl)
      onProgress({
        phase: 'clone',
        message: `Using local source: ${localPath}`,
        percent: 20,
      })
    } else {
      await cloneRepo({ url: repoUrl, localPath, branch }, onProgress)
    }
  } catch {
    await cloneRepo({ url: repoUrl, localPath, branch }, onProgress)
  }

  // Index
  const { stack, map } = await indexRepo(localPath, onProgress)

  // Persist to SQLite
  const indexId = randomUUID()
  upsertRepoIndex(projectPath, {
    id: indexId,
    repoUrl,
    framework: stack.framework,
    language: stack.language,
    hasOpenApi: stack.hasOpenApi,
    localPath,
  })
  saveCodeMap(projectPath, indexId, map)
  const knowledge = buildKnowledgeGraph(map)
  const memoryUpdate = saveKnowledgeGraph(
    projectPath,
    indexId,
    knowledge.nodes,
    knowledge.edges,
  )

  return { indexId, stack, map, memoryUpdate }
}

export function getCodeMap(projectPath: string) {
  const existing = getRepoIndex(projectPath) as any
  if (!existing) return null

  const stored = getStoredCodeMap(projectPath, existing.id)
  return {
    indexId: existing.id,
    repoUrl: existing.repo_url,
    framework: existing.framework,
    language: existing.language,
    indexedAt: existing.indexed_at,
    ...stored,
  }
}

export function getRelevantCodeContext(
  projectPath: string,
  query: string,
  limit = 30,
) {
  return searchKnowledge(projectPath, query, limit).map((node) => ({
    id: node.stable_key,
    type: node.kind,
    name: node.name,
    content: node.summary,
    status: node.status,
    confidence: node.confidence,
    producer: node.producer,
    sourceRefs: JSON.parse(String(node.source_refs_json ?? '[]')),
    metadata: JSON.parse(String(node.metadata_json ?? '{}')),
    lexicalScore: node.lexical_score,
    vectorScore: node.vector_score,
    graphScore: node.graph_score,
    retrievalScore: node.retrieval_score,
  }))
}

export function getCodeKnowledgeSnapshot(projectPath: string) {
  return getKnowledgeSnapshot(projectPath)
}

export function getCodeKnowledgeRelations(
  projectPath: string,
  stableKey: string,
  limit = 50,
) {
  return traverseKnowledge(projectPath, stableKey, limit)
}

export function rememberCodeKnowledge(
  projectPath: string,
  input: Parameters<typeof rememberKnowledgeNode>[1],
) {
  if (
    input.status === 'verified' &&
    (!input.sourceRefs.length || input.confidence < 0.7)
  ) {
    throw new Error('Verified knowledge requires source evidence and confidence >= 0.7')
  }
  rememberKnowledgeNode(projectPath, input)
}

export interface GenerateParams {
  projectPath: string
  targetIds: string[]
  testTypes: string[]
  query?: string
  configOverride?: { baseUrl?: string; apiKey?: string; model?: string }
}

export async function generateAndSaveTests(
  params: GenerateParams,
  onProgress: (data: { targetId: string; status: 'pending' | 'streaming' | 'done' | 'failed'; test?: unknown; chunk?: string }) => void
): Promise<void> {
  const { projectPath, targetIds, testTypes, query, configOverride } = params

  const existing = getRepoIndex(projectPath) as any
  if (!existing) throw new Error('No index found. Run index first.')

  // Build RAG context
  const stored = getStoredCodeMap(projectPath, existing.id) as any
  const contextBundle = buildContext(
    {
      pages: (stored.pages ?? []).map((p: any) => ({ route: p.route, componentFile: p.component_file, componentName: p.component_name })),
      elements: (stored.elements ?? []).map((e: any) => ({ name: e.name, tag: e.tag, type: e.type, testId: e.test_id, label: e.label, placeholder: e.placeholder, ariaLabel: e.aria_label, sourceFile: e.source_file, line: e.line })),
      endpoints: (stored.endpoints ?? []).map((e: any) => ({ method: e.method, path: e.path, summary: e.summary, requestSchema: e.request_schema_json ? JSON.parse(e.request_schema_json) : undefined, responseSchema: e.response_schema_json ? JSON.parse(e.response_schema_json) : undefined, sourceFile: e.source_file })),
      symbols: [],
      flows: [],
    },
    query ?? targetIds.join(' '),
    []
  )

  for (const targetId of targetIds) onProgress({ targetId, status: 'pending' })

  const results = await generateTestsForTargets({
    context: contextBundle,
    targetIds,
    testTypes,
    configOverride,
    onChunk: (targetId, chunk) => onProgress({ targetId, status: 'streaming', chunk }),
  })

  // Save each result to project test-cases/
  for (const result of results) {
    if (result.error) {
      onProgress({ targetId: result.targetId, status: 'failed' })
      continue
    }

    for (const test of result.tests) {
      try {
        await saveTestToProject(projectPath, test as any)
      } catch (e) {
        console.error('[autogen] save failed:', e)
      }
    }

    onProgress({ targetId: result.targetId, status: 'done', test: result.tests[0] })
  }
}

async function saveTestToProject(projectPath: string, testCase: { id: string; name: string }) {
  const testCasesDir = path.join(projectPath, 'test-cases')
  await fs.mkdir(testCasesDir, { recursive: true })

  const safeName = testCase.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  const filePath = path.join(testCasesDir, `${safeName}.test.yaml`)
  await fs.writeFile(filePath, yamlStringify(testCase), 'utf-8')
}
