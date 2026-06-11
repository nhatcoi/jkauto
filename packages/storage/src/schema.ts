// Uses Node.js 22+ built-in sqlite (node:sqlite)
import { DatabaseSync } from 'node:sqlite'

export function initDb(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      test_case_id TEXT,
      suite_id TEXT,
      profile TEXT NOT NULL DEFAULT 'default',
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS step_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES test_runs(id),
      step_index INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      screenshot_path TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS file_index (
      path TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      mtime TEXT NOT NULL
    );
  `)
}
