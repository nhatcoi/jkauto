import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { join } from 'path';
import { mkdirSync } from 'fs';

const dataDir = join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'ecm.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

const adminExists = db.prepare('SELECT id FROM users WHERE id = ?').get('usr_admin');
if (!adminExists) {
  const insert = db.prepare(
    'INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const now = '2025-01-01T00:00:00.000Z';
  for (const [id, username, email, pwd, role] of [
    ['usr_admin',  'admin',  'admin@ecm.local',  'Admin@123',  'admin'],
    ['usr_editor', 'editor', 'editor@ecm.local', 'Editor@123', 'editor'],
    ['usr_viewer', 'viewer', 'viewer@ecm.local', 'Viewer@123', 'viewer'],
  ]) {
    insert.run(id, username, email, bcrypt.hashSync(pwd, 10), role, now, now);
  }
}

export default db;
