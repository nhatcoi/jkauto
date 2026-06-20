import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

let db: Database.Database | null = null
let currentProjectPath: string | null = null

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

    -- FTS5 for RAG-style retrieval (BM25 ranking built-in)
    CREATE VIRTUAL TABLE IF NOT EXISTS code_chunks USING fts5(
      index_id UNINDEXED,
      chunk_type UNINDEXED,
      name,
      content,
      metadata_json UNINDEXED,
      tokenize = 'unicode61'
    );

    CREATE INDEX IF NOT EXISTS idx_pages_index ON code_pages(index_id);
    CREATE INDEX IF NOT EXISTS idx_elements_index ON code_elements(index_id);
    CREATE INDEX IF NOT EXISTS idx_endpoints_index ON code_endpoints(index_id);
    CREATE INDEX IF NOT EXISTS idx_repo_project ON repo_index(project_path);
    CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_runs(project_path, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analysis_artifacts_run ON analysis_artifacts(run_id);
  `)

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
  db.prepare('DELETE FROM code_chunks WHERE index_id = ?').run(indexId)
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
    endpoints: Array<{ method: string; path: string; summary?: string; requestSchema?: unknown; responseSchema?: unknown; sourceFile?: string }>
    symbols: Array<{ kind: string; name: string; file: string; line?: number; exported?: boolean }>
  }
): void {
  const db = getAutogenDb(projectPath)
  const insertPage = db.prepare('INSERT INTO code_pages (id, index_id, route, component_file, component_name) VALUES (?, ?, ?, ?, ?)')
  const insertElement = db.prepare('INSERT INTO code_elements (id, index_id, name, tag, type, test_id, label, placeholder, aria_label, source_file, line) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertEndpoint = db.prepare('INSERT INTO code_endpoints (id, index_id, method, path, summary, request_schema_json, response_schema_json, source_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const insertSymbol = db.prepare('INSERT INTO code_symbols (id, index_id, kind, name, file, line, exported) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertChunk = db.prepare('INSERT INTO code_chunks (index_id, chunk_type, name, content, metadata_json) VALUES (?, ?, ?, ?, ?)')

  const tx = db.transaction(() => {
    for (const p of map.pages) {
      insertPage.run(randomUUID(), indexId, p.route, p.componentFile ?? '', p.componentName ?? '')
      insertChunk.run(indexId, 'route', p.route, `Page: ${p.route} Component: ${p.componentName ?? ''}`, JSON.stringify(p))
    }

    for (const e of map.elements) {
      insertElement.run(randomUUID(), indexId, e.name, e.tag ?? '', e.type ?? null, e.testId ?? null, e.label ?? null, e.placeholder ?? null, e.ariaLabel ?? null, e.sourceFile ?? '', e.line ?? 0)
      const text = [e.name, e.tag, e.type, e.testId, e.label, e.placeholder, e.ariaLabel].filter(Boolean).join(' ')
      insertChunk.run(indexId, 'element', e.name, text, JSON.stringify(e))
    }

    for (const ep of map.endpoints) {
      insertEndpoint.run(randomUUID(), indexId, ep.method, ep.path, ep.summary ?? null, ep.requestSchema ? JSON.stringify(ep.requestSchema) : null, ep.responseSchema ? JSON.stringify(ep.responseSchema) : null, ep.sourceFile ?? '')
      insertChunk.run(indexId, 'endpoint', `${ep.method} ${ep.path}`, `${ep.method} ${ep.path} ${ep.summary ?? ''}`, JSON.stringify(ep))
    }

    for (const s of map.symbols) {
      insertSymbol.run(randomUUID(), indexId, s.kind, s.name, s.file, s.line ?? 0, s.exported ? 1 : 0)
    }
  })

  tx()
}

export function queryChunks(
  projectPath: string,
  indexId: string,
  query: string,
  limit = 20
): Array<{ chunk_type: string; name: string; content: string; metadata_json: string }> {
  const db = getAutogenDb(projectPath)
  try {
    return db.prepare(`
      SELECT chunk_type, name, content, metadata_json
      FROM code_chunks
      WHERE index_id = ? AND code_chunks MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(indexId, query, limit) as any[]
  } catch {
    // FTS query syntax error fallback
    return db.prepare(`
      SELECT chunk_type, name, content, metadata_json
      FROM code_chunks
      WHERE index_id = ?
      LIMIT ?
    `).all(indexId, limit) as any[]
  }
}

export function getStoredCodeMap(projectPath: string, indexId: string) {
  const db = getAutogenDb(projectPath)
  const pages = db.prepare('SELECT * FROM code_pages WHERE index_id = ?').all(indexId)
  const elements = db.prepare('SELECT * FROM code_elements WHERE index_id = ?').all(indexId)
  const endpoints = db.prepare('SELECT * FROM code_endpoints WHERE index_id = ?').all(indexId)
  const symbols = db.prepare('SELECT * FROM code_symbols WHERE index_id = ?').all(indexId)
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
