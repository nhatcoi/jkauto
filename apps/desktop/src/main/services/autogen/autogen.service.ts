import { randomUUID } from 'node:crypto'
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
  queryChunks,
  getStoredCodeMap,
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

  return { indexId, stack, map }
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
  const existing = getRepoIndex(projectPath) as any
  if (!existing) return []
  const ftsQuery = query
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter(Boolean)
    .join(' OR ')
  if (!ftsQuery) return []
  return queryChunks(projectPath, existing.id, ftsQuery, limit).map((chunk) => ({
    type: chunk.chunk_type,
    name: chunk.name,
    content: chunk.content,
    metadata: JSON.parse(chunk.metadata_json),
  }))
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
  const relevantChunks = query
    ? queryChunks(projectPath, existing.id, query.split(' ').filter(Boolean).join(' OR '), 30)
    : []

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
