import { DatabaseSync } from 'node:sqlite'
import { initDb } from './schema'

export function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath)
  initDb(db)
  return db
}

export { initDb } from './schema'
