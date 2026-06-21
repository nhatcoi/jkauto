import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

let db: Database.Database | null = null
let currentProjectPath: string | null = null
const EMBEDDING_DIMENSIONS = 128

function localEmbedding(text: string): number[] {
  const vector = Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  const tokens = text.toLocaleLowerCase().match(/[\p{L}\p{N}_./:-]+/gu) ?? []
  for (const token of tokens) {
    let hash = 2166136261
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    vector[(hash >>> 0) % EMBEDDING_DIMENSIONS] += 1
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return magnitude ? vector.map((value) => value / magnitude) : vector
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length)
  let score = 0
  for (let index = 0; index < length; index += 1) score += left[index] * right[index]
  return score
}

export function getAutogenDb(projectPath: string): Database.Database {
  const dbDir = path.join(projectPath, '.autotest')
  const dbPath = path.join(dbDir, 'autogen.db')

  if (db && currentProjectPath === projectPath) return db

  if (db) {
    try { db.close() } catch {}
    db = null
  }

  fs.mkdirSync(dbDir, { recursive: true })
  db = new Database(dbPath)
  currentProjectPath = projectPath

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    DROP TABLE IF EXISTS code_chunks;

    CREATE TABLE IF NOT EXISTS repo_index (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      framework TEXT NOT NULL DEFAULT 'unknown',
      language TEXT NOT NULL DEFAULT 'unknown',
      has_openapi INTEGER NOT NULL DEFAULT 0,
      local_path TEXT NOT NULL,
      indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS code_pages (
      id TEXT PRIMARY KEY,
      index_id TEXT NOT NULL REFERENCES repo_index(id) ON DELETE CASCADE,
      route TEXT NOT NULL,
      component_file TEXT,
      component_name TEXT
    );

    CREATE TABLE IF NOT EXISTS code_elements (
      id TEXT PRIMARY KEY,
      index_id TEXT NOT NULL REFERENCES repo_index(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tag TEXT,
      type TEXT,
      test_id TEXT,
      label TEXT,
      placeholder TEXT,
      aria_label TEXT,
      source_file TEXT,
      line INTEGER
    );

    CREATE TABLE IF NOT EXISTS code_endpoints (
      id TEXT PRIMARY KEY,
      index_id TEXT NOT NULL REFERENCES repo_index(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      summary TEXT,
      parameters_json TEXT,
      request_schema_json TEXT,
      response_schema_json TEXT,
      source_file TEXT
    );

    CREATE TABLE IF NOT EXISTS code_symbols (
      id TEXT PRIMARY KEY,
      index_id TEXT NOT NULL REFERENCES repo_index(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      file TEXT NOT NULL,
      line INTEGER,
      exported INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      source_type TEXT NOT NULL,
      status TEXT NOT NULL,
      index_id TEXT,
      framework TEXT,
      language TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS analysis_artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      artifact_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content_json TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 1,
      source_refs_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      stable_key TEXT NOT NULL,
      index_id TEXT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'verified',
      confidence REAL NOT NULL DEFAULT 1,
      producer TEXT NOT NULL DEFAULT 'static',
      module_id TEXT,
      content_hash TEXT,
      source_refs_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      embedding_json TEXT,
      analyzed_at TEXT NOT NULL,
      UNIQUE(project_path, stable_key)
    );

    CREATE TABLE IF NOT EXISTS knowledge_edges (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      index_id TEXT,
      source_key TEXT NOT NULL,
      target_key TEXT NOT NULL,
      relation TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1,
      source_ref_json TEXT,
      UNIQUE(project_path, source_key, target_key, relation)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      node_id UNINDEXED,
      project_path UNINDEXED,
      kind UNINDEXED,
      name,
      summary,
      metadata,
      tokenize = 'unicode61'
    );

    CREATE INDEX IF NOT EXISTS idx_pages_index ON code_pages(index_id);
    CREATE INDEX IF NOT EXISTS idx_elements_index ON code_elements(index_id);
    CREATE INDEX IF NOT EXISTS idx_endpoints_index ON code_endpoints(index_id);
    CREATE INDEX IF NOT EXISTS idx_repo_project ON repo_index(project_path);
    CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_runs(project_path, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analysis_artifacts_run ON analysis_artifacts(run_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_nodes(project_path, status, kind);
    CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges(project_path, source_key);
    CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON knowledge_edges(project_path, target_key);
  `)

  // Migration: add columns to pre-existing tables (CREATE IF NOT EXISTS won't).
  try {
    db.exec('ALTER TABLE code_endpoints ADD COLUMN parameters_json TEXT')
  } catch {
    // column already exists — ignore
  }

  return db
}

export function upsertRepoIndex(
  projectPath: string,
  data: {
    id: string
    repoUrl: string
    framework: string
    language: string
    hasOpenApi: boolean
    localPath: string
  }
): void {
  const db = getAutogenDb(projectPath)
  db.prepare(`
    INSERT OR REPLACE INTO repo_index (id, project_path, repo_url, framework, language, has_openapi, local_path, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.id, projectPath, data.repoUrl, data.framework, data.language, data.hasOpenApi ? 1 : 0, data.localPath, new Date().toISOString())
}

export function deleteIndexData(projectPath: string, indexId: string): void {
  const db = getAutogenDb(projectPath)
  db.prepare('DELETE FROM code_pages WHERE index_id = ?').run(indexId)
  db.prepare('DELETE FROM code_elements WHERE index_id = ?').run(indexId)
  db.prepare('DELETE FROM code_endpoints WHERE index_id = ?').run(indexId)
  db.prepare('DELETE FROM code_symbols WHERE index_id = ?').run(indexId)
  db.prepare('DELETE FROM repo_index WHERE id = ?').run(indexId)
}

export function getRepoIndex(projectPath: string) {
  const db = getAutogenDb(projectPath)
  return db.prepare('SELECT * FROM repo_index WHERE project_path = ? ORDER BY indexed_at DESC LIMIT 1').get(projectPath) as Record<string, unknown> | undefined
}

export function saveCodeMap(
  projectPath: string,
  indexId: string,
  map: {
    pages: Array<{ route: string; componentFile?: string; componentName?: string }>
    elements: Array<{ name: string; tag?: string; type?: string; testId?: string; label?: string; placeholder?: string; ariaLabel?: string; sourceFile?: string; line?: number }>
    endpoints: Array<{ method: string; path: string; summary?: string; parameters?: unknown; requestSchema?: unknown; responseSchema?: unknown; sourceFile?: string }>
    symbols: Array<{ kind: string; name: string; file: string; line?: number; exported?: boolean }>
  }
): void {
  const db = getAutogenDb(projectPath)
  const insertPage = db.prepare('INSERT INTO code_pages (id, index_id, route, component_file, component_name) VALUES (?, ?, ?, ?, ?)')
  const insertElement = db.prepare('INSERT INTO code_elements (id, index_id, name, tag, type, test_id, label, placeholder, aria_label, source_file, line) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertEndpoint = db.prepare('INSERT INTO code_endpoints (id, index_id, method, path, summary, parameters_json, request_schema_json, response_schema_json, source_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertSymbol = db.prepare('INSERT INTO code_symbols (id, index_id, kind, name, file, line, exported) VALUES (?, ?, ?, ?, ?, ?, ?)')

  const tx = db.transaction(() => {
    for (const p of map.pages) {
      insertPage.run(randomUUID(), indexId, p.route, p.componentFile ?? '', p.componentName ?? '')
    }

    for (const e of map.elements) {
      insertElement.run(randomUUID(), indexId, e.name, e.tag ?? '', e.type ?? null, e.testId ?? null, e.label ?? null, e.placeholder ?? null, e.ariaLabel ?? null, e.sourceFile ?? '', e.line ?? 0)
    }

    for (const ep of map.endpoints) {
      insertEndpoint.run(randomUUID(), indexId, ep.method, ep.path, ep.summary ?? null, ep.parameters ? JSON.stringify(ep.parameters) : null, ep.requestSchema ? JSON.stringify(ep.requestSchema) : null, ep.responseSchema ? JSON.stringify(ep.responseSchema) : null, ep.sourceFile ?? '')
    }

    for (const s of map.symbols) {
      insertSymbol.run(randomUUID(), indexId, s.kind, s.name, s.file, s.line ?? 0, s.exported ? 1 : 0)
    }
  })

  tx()
}

type KnowledgeNodeInput = {
  stableKey: string
  kind: string
  name: string
  summary?: string
  status?: 'verified' | 'inferred' | 'unknown' | 'stale'
  confidence?: number
  producer?: 'static' | 'agent' | 'runtime' | 'user'
  moduleId?: string
  contentHash?: string
  sourceRefs?: Array<{ file: string; line?: number; symbol?: string }>
  metadata?: Record<string, unknown>
}

type KnowledgeEdgeInput = {
  sourceKey: string
  targetKey: string
  relation: string
  confidence?: number
  sourceRef?: { file: string; line?: number; symbol?: string }
}

export function saveKnowledgeGraph(
  projectPath: string,
  indexId: string,
  nodes: KnowledgeNodeInput[],
  edges: KnowledgeEdgeInput[],
): { created: number; updated: number; unchanged: number; stale: number } {
  const db = getAutogenDb(projectPath)
  const existingRows = db.prepare(
    'SELECT stable_key, content_hash, status, producer FROM knowledge_nodes WHERE project_path = ?',
  ).all(projectPath) as Array<{
    stable_key: string
    content_hash: string | null
    status: string
    producer: string
  }>
  const existing = new Map(existingRows.map((row) => [row.stable_key, row]))
  const incoming = new Set(nodes.map((node) => node.stableKey))
  const changedSourceFiles = new Set(
    nodes
      .filter((node) =>
        node.kind === 'file' &&
        existing.has(node.stableKey) &&
        existing.get(node.stableKey)?.content_hash !== (node.contentHash ?? null),
      )
      .flatMap((node) => node.sourceRefs?.map((ref) => ref.file) ?? []),
  )
  const now = new Date().toISOString()
  let created = 0
  let updated = 0
  let unchanged = 0

  const upsertNode = db.prepare(`
    INSERT INTO knowledge_nodes (
      id, project_path, stable_key, index_id, kind, name, summary, status,
      confidence, producer, module_id, content_hash, source_refs_json,
      metadata_json, analyzed_at
      , embedding_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_path, stable_key) DO UPDATE SET
      index_id = excluded.index_id,
      kind = excluded.kind,
      name = excluded.name,
      summary = excluded.summary,
      status = excluded.status,
      confidence = excluded.confidence,
      producer = excluded.producer,
      module_id = excluded.module_id,
      content_hash = excluded.content_hash,
      source_refs_json = excluded.source_refs_json,
      metadata_json = excluded.metadata_json,
      embedding_json = excluded.embedding_json,
      analyzed_at = excluded.analyzed_at
  `)
  const lookupId = db.prepare(
    'SELECT id FROM knowledge_nodes WHERE project_path = ? AND stable_key = ?',
  )
  const insertFts = db.prepare(
    'INSERT INTO knowledge_fts (node_id, project_path, kind, name, summary, metadata) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const insertEdge = db.prepare(`
    INSERT OR REPLACE INTO knowledge_edges (
      id, project_path, index_id, source_key, target_key, relation,
      confidence, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE knowledge_nodes SET status = 'stale'
       WHERE project_path = ? AND producer = 'static'`,
    ).run(projectPath)
    if (changedSourceFiles.size > 0) {
      const agentRows = db.prepare(`
        SELECT id, source_refs_json FROM knowledge_nodes
        WHERE project_path = ? AND producer = 'agent' AND status != 'stale'
      `).all(projectPath) as Array<{ id: string; source_refs_json: string }>
      const markStale = db.prepare(
        `UPDATE knowledge_nodes SET status = 'stale' WHERE id = ?`,
      )
      for (const row of agentRows) {
        let refs: Array<{ file?: string }> = []
        try { refs = JSON.parse(row.source_refs_json) as Array<{ file?: string }> } catch {}
        if (refs.some((ref) => ref.file && changedSourceFiles.has(ref.file))) {
          markStale.run(row.id)
        }
      }
    }
    db.prepare('DELETE FROM knowledge_edges WHERE project_path = ?').run(projectPath)
    db.prepare('DELETE FROM knowledge_fts WHERE project_path = ?').run(projectPath)

    for (const node of nodes) {
      const previous = existing.get(node.stableKey)
      if (!previous) created += 1
      else if (previous.content_hash === (node.contentHash ?? null) && previous.status !== 'stale') unchanged += 1
      else updated += 1
      const id = (lookupId.get(projectPath, node.stableKey) as { id: string } | undefined)?.id ?? randomUUID()
      const metadataJson = JSON.stringify(node.metadata ?? {})
      upsertNode.run(
        id,
        projectPath,
        node.stableKey,
        indexId,
        node.kind,
        node.name,
        node.summary ?? '',
        node.status ?? 'verified',
        node.confidence ?? 1,
        node.producer ?? 'static',
        node.moduleId ?? null,
        node.contentHash ?? null,
        JSON.stringify(node.sourceRefs ?? []),
        metadataJson,
        now,
        JSON.stringify(localEmbedding(`${node.name} ${node.summary ?? ''} ${metadataJson}`)),
      )
      insertFts.run(
        id,
        projectPath,
        node.kind,
        node.name,
        node.summary ?? '',
        metadataJson,
      )
    }
    // Drop static nodes from prior indexes that are gone from the codebase.
    // Agent/runtime/user knowledge is retained even when marked stale.
    db.prepare(
      `DELETE FROM knowledge_nodes
       WHERE project_path = ? AND producer = 'static' AND status = 'stale'`,
    ).run(projectPath)
    for (const edge of edges) {
      insertEdge.run(
        randomUUID(),
        projectPath,
        indexId,
        edge.sourceKey,
        edge.targetKey,
        edge.relation,
        edge.confidence ?? 1,
        edge.sourceRef ? JSON.stringify(edge.sourceRef) : null,
      )
    }
    const retainedNodes = db.prepare(`
      SELECT id, kind, name, summary, metadata_json
      FROM knowledge_nodes
      WHERE project_path = ? AND producer != 'static' AND status != 'stale'
    `).all(projectPath) as Array<{
      id: string
      kind: string
      name: string
      summary: string
      metadata_json: string
    }>
    for (const node of retainedNodes) {
      insertFts.run(
        node.id,
        projectPath,
        node.kind,
        node.name,
        node.summary,
        node.metadata_json,
      )
    }
  })
  tx()
  const stale = existingRows.filter(
    (row) => row.producer === 'static' && !incoming.has(row.stable_key),
  ).length
  return { created, updated, unchanged, stale }
}

export function searchKnowledge(
  projectPath: string,
  query: string,
  limit = 30,
): Array<Record<string, unknown>> {
  const db = getAutogenDb(projectPath)
  const normalized = query
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}_./:-]/gu, ''))
    .filter(Boolean)
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(' OR ')
  if (!normalized) return []
  const lexicalRows = (() => {
    try {
      return db.prepare(`
      SELECT n.*, bm25(knowledge_fts) AS lexical_score
      FROM knowledge_fts
      JOIN knowledge_nodes n ON n.id = knowledge_fts.node_id
      WHERE knowledge_fts.project_path = ?
        AND knowledge_fts MATCH ?
        AND n.status != 'stale'
      ORDER BY lexical_score, n.confidence DESC
      LIMIT ?
    `).all(projectPath, normalized, Math.max(limit * 4, 50)) as Array<Record<string, unknown>>
    } catch {
      return [] as Array<Record<string, unknown>>
    }
  })()
  const candidates = db.prepare(`
      SELECT *, NULL AS lexical_score FROM knowledge_nodes
      WHERE project_path = ? AND status != 'stale'
      ORDER BY confidence DESC, analyzed_at DESC
      LIMIT 1000
    `).all(projectPath) as Array<Record<string, unknown>>
  const byId = new Map<string, Record<string, unknown>>()
  for (const row of [...lexicalRows, ...candidates]) byId.set(String(row.id), row)
  const queryVector = localEmbedding(query)
  const lexicalRank = new Map(
    lexicalRows.map((row, index) => [String(row.id), 1 - index / Math.max(1, lexicalRows.length)]),
  )
  const seedKeys = lexicalRows.slice(0, 10).map((row) => String(row.stable_key))
  const graphRelated = new Set<string>()
  if (seedKeys.length > 0) {
    const placeholders = seedKeys.map(() => '?').join(',')
    const relatedRows = db.prepare(`
      SELECT source_key, target_key FROM knowledge_edges
      WHERE project_path = ?
        AND (source_key IN (${placeholders}) OR target_key IN (${placeholders}))
      LIMIT 500
    `).all(projectPath, ...seedKeys, ...seedKeys) as Array<{
      source_key: string
      target_key: string
    }>
    for (const edge of relatedRows) {
      graphRelated.add(edge.source_key)
      graphRelated.add(edge.target_key)
    }
  }
  return Array.from(byId.values())
    .map((row) => {
      let embedding: number[] = []
      try { embedding = JSON.parse(String(row.embedding_json ?? '[]')) as number[] } catch {}
      const vectorScore = cosineSimilarity(queryVector, embedding)
      const lexicalScore = lexicalRank.get(String(row.id)) ?? 0
      const graphScore = graphRelated.has(String(row.stable_key)) ? 1 : 0
      const confidence = Number(row.confidence ?? 0)
      return {
        ...row,
        lexical_score: lexicalScore,
        vector_score: vectorScore,
        graph_score: graphScore,
        retrieval_score:
          lexicalScore * 0.45 +
          vectorScore * 0.3 +
          graphScore * 0.15 +
          confidence * 0.1,
      }
    })
    .sort((left, right) => right.retrieval_score - left.retrieval_score)
    .slice(0, limit)
}

export function getKnowledgeSnapshot(projectPath: string) {
  const db = getAutogenDb(projectPath)
  const counts = db.prepare(`
    SELECT kind, status, COUNT(*) AS count
    FROM knowledge_nodes WHERE project_path = ?
    GROUP BY kind, status
  `).all(projectPath)
  const modules = db.prepare(`
    SELECT * FROM knowledge_nodes
    WHERE project_path = ? AND kind = 'module' AND status != 'stale'
    ORDER BY name
  `).all(projectPath)
  const gaps = db.prepare(`
    SELECT * FROM knowledge_nodes
    WHERE project_path = ? AND kind = 'gap' AND status != 'stale'
    ORDER BY confidence, name
  `).all(projectPath)
  const edgeCount = (
    db.prepare('SELECT COUNT(*) AS count FROM knowledge_edges WHERE project_path = ?')
      .get(projectPath) as { count: number }
  ).count
  return { counts, modules, gaps, edgeCount }
}

export function traverseKnowledge(
  projectPath: string,
  stableKey: string,
  limit = 50,
) {
  return getAutogenDb(projectPath).prepare(`
    SELECT e.*, target.kind, target.name, target.summary, target.status,
           target.confidence, target.source_refs_json, target.metadata_json
    FROM knowledge_edges e
    LEFT JOIN knowledge_nodes target
      ON target.project_path = e.project_path AND target.stable_key = e.target_key
    WHERE e.project_path = ? AND e.source_key = ?
    LIMIT ?
  `).all(projectPath, stableKey, limit)
}

export function rememberKnowledgeNode(
  projectPath: string,
  input: {
    stableKey: string
    kind: string
    name: string
    summary: string
    status: 'verified' | 'inferred' | 'unknown'
    confidence: number
    sourceRefs: Array<{ file: string; line?: number; symbol?: string }>
    metadata?: Record<string, unknown>
    resolvesGapKey?: string
  },
): void {
  const db = getAutogenDb(projectPath)
  const existing = db.prepare(
    'SELECT id FROM knowledge_nodes WHERE project_path = ? AND stable_key = ?',
  ).get(projectPath, input.stableKey) as { id: string } | undefined
  const id = existing?.id ?? randomUUID()
  const metadataJson = JSON.stringify(input.metadata ?? {})
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO knowledge_nodes (
        id, project_path, stable_key, kind, name, summary, status, confidence,
        producer, source_refs_json, metadata_json, embedding_json, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?, ?, ?, ?)
      ON CONFLICT(project_path, stable_key) DO UPDATE SET
        kind = excluded.kind,
        name = excluded.name,
        summary = excluded.summary,
        status = excluded.status,
        confidence = excluded.confidence,
        producer = 'agent',
        source_refs_json = excluded.source_refs_json,
        metadata_json = excluded.metadata_json,
        embedding_json = excluded.embedding_json,
        analyzed_at = excluded.analyzed_at
    `).run(
      id,
      projectPath,
      input.stableKey,
      input.kind,
      input.name,
      input.summary,
      input.status,
      input.confidence,
      JSON.stringify(input.sourceRefs),
      metadataJson,
      JSON.stringify(localEmbedding(`${input.name} ${input.summary} ${metadataJson}`)),
      now,
    )
    db.prepare('DELETE FROM knowledge_fts WHERE node_id = ?').run(id)
    db.prepare(`
      INSERT INTO knowledge_fts (node_id, project_path, kind, name, summary, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectPath, input.kind, input.name, input.summary, metadataJson)
    if (input.resolvesGapKey) {
      db.prepare(`
        UPDATE knowledge_nodes SET status = 'stale'
        WHERE project_path = ? AND stable_key = ? AND kind = 'gap'
      `).run(projectPath, input.resolvesGapKey)
    }
  })
  tx()
}

export function getStoredCodeMap(projectPath: string, indexId: string) {
  const db = getAutogenDb(projectPath)
  const pages = db.prepare('SELECT * FROM code_pages WHERE index_id = ?').all(indexId)
  const elements = db.prepare('SELECT * FROM code_elements WHERE index_id = ?').all(indexId)
  const symbols = db.prepare('SELECT * FROM code_symbols WHERE index_id = ?').all(indexId)
  const endpointRows = db
    .prepare('SELECT * FROM code_endpoints WHERE index_id = ?')
    .all(indexId) as Array<Record<string, unknown>>
  // Re-hydrate validation schemas into ApiEndpoint shape (requestSchema/
  // responseSchema) while keeping the raw *_json columns for other consumers.
  const parse = (value: unknown): unknown => {
    if (typeof value !== 'string' || !value) return undefined
    try { return JSON.parse(value) } catch { return undefined }
  }
  const endpoints = endpointRows.map((row) => ({
    ...row,
    sourceFile: row.source_file,
    parameters: parse(row.parameters_json),
    requestSchema: parse(row.request_schema_json),
    responseSchema: parse(row.response_schema_json),
  }))
  return { pages, elements, endpoints, symbols }
}

export function createAnalysisRun(
  projectPath: string,
  data: {
    id: string
    sourceRef: string
    sourceType: 'git' | 'local'
    startedAt: string
  },
): void {
  getAutogenDb(projectPath).prepare(`
    INSERT INTO analysis_runs (
      id, project_path, source_ref, source_type, status, started_at
    ) VALUES (?, ?, ?, ?, 'running', ?)
  `).run(data.id, projectPath, data.sourceRef, data.sourceType, data.startedAt)
}

export function completeAnalysisRun(
  projectPath: string,
  runId: string,
  data: {
    indexId: string
    framework: string
    language: string
    completedAt: string
  },
): void {
  getAutogenDb(projectPath).prepare(`
    UPDATE analysis_runs
    SET status = 'completed', index_id = ?, framework = ?, language = ?,
        completed_at = ?, error = NULL
    WHERE id = ?
  `).run(
    data.indexId,
    data.framework,
    data.language,
    data.completedAt,
    runId,
  )
}

export function failAnalysisRun(
  projectPath: string,
  runId: string,
  error: string,
): void {
  getAutogenDb(projectPath).prepare(`
    UPDATE analysis_runs
    SET status = 'failed', error = ?, completed_at = ?
    WHERE id = ?
  `).run(error, new Date().toISOString(), runId)
}

export function saveAnalysisArtifact(
  projectPath: string,
  data: {
    id: string
    runId: string
    type: string
    title: string
    summary: string
    contentJson: string
    itemCount: number
    confidence: number
    sourceRefs: string[]
    createdAt: string
  },
): void {
  getAutogenDb(projectPath).prepare(`
    INSERT INTO analysis_artifacts (
      id, run_id, artifact_type, title, summary, content_json,
      item_count, confidence, source_refs_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.runId,
    data.type,
    data.title,
    data.summary,
    data.contentJson,
    data.itemCount,
    data.confidence,
    JSON.stringify(data.sourceRefs),
    data.createdAt,
  )
}

export function getAnalysisRun(projectPath: string, runId?: string) {
  const db = getAutogenDb(projectPath)
  if (runId) {
    return db.prepare(`
      SELECT * FROM analysis_runs WHERE project_path = ? AND id = ?
    `).get(projectPath, runId) as Record<string, unknown> | undefined
  }
  return db.prepare(`
    SELECT * FROM analysis_runs
    WHERE project_path = ?
    ORDER BY started_at DESC
    LIMIT 1
  `).get(projectPath) as Record<string, unknown> | undefined
}

export function getAnalysisArtifacts(projectPath: string, runId: string) {
  return getAutogenDb(projectPath).prepare(`
    SELECT * FROM analysis_artifacts
    WHERE run_id = ?
    ORDER BY created_at, artifact_type
  `).all(runId) as Array<Record<string, unknown>>
}
