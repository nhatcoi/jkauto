import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

let db: Database.Database | null = null
let currentDbPath: string | null = null

export function getAgentDb(projectPath: string): Database.Database {
  const dbDir = path.join(projectPath, '.autotest')
  const dbPath = path.join(dbDir, 'agent.db')

  if (db && currentDbPath === dbPath) return db

  if (db) {
    try {
      db.close()
    } catch {}
    db = null
  }

  fs.mkdirSync(dbDir, { recursive: true })

  db = new Database(dbPath)
  currentDbPath = dbPath

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'active',
      summary TEXT,
      active_tab_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_artifacts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content_json TEXT NOT NULL,
      target_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_actions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload_json TEXT NOT NULL,
      result_json TEXT,
      backup_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS harness_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project_path TEXT NOT NULL,
      request TEXT NOT NULL,
      state TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      code_index_id TEXT,
      generated_test_path TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS harness_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES harness_runs(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      state TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT,
      output_json TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS harness_artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES harness_runs(id) ON DELETE CASCADE,
      step_id TEXT,
      type TEXT NOT NULL,
      content_json TEXT NOT NULL,
      source_ref TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON agent_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_artifacts_session ON agent_artifacts(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_actions_session ON agent_actions(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON agent_sessions(project_path, updated_at);
    CREATE INDEX IF NOT EXISTS idx_harness_runs_session ON harness_runs(session_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_harness_steps_run ON harness_steps(run_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_harness_artifacts_run ON harness_artifacts(run_id, created_at);
  `)

  return db
}

export function closeAgentDb(): void {
  if (db) {
    try {
      db.close()
    } catch {}
    db = null
    currentDbPath = null
  }
}
