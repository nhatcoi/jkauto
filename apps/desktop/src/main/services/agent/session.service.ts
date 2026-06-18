import { randomUUID } from 'node:crypto'
import { getAgentDb } from './agent-db'
import type {
  AgentSession,
  AgentSessionMode,
  AgentMessage,
  AgentArtifact,
  AgentAction,
} from '@jkauto/core'

function rowToSession(r: Record<string, unknown>): AgentSession {
  const storedMode = r.mode as string
  const mode: AgentSessionMode =
    storedMode === 'directly' ? 'directly' : 'normal'

  return {
    id: r.id as string,
    projectPath: r.project_path as string,
    title: r.title as string,
    mode,
    status: r.status as AgentSession['status'],
    summary: (r.summary as string) || undefined,
    activeTabPath: (r.active_tab_path as string) || undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export function listSessions(projectPath: string): AgentSession[] {
  const db = getAgentDb(projectPath)
  const rows = db
    .prepare(
      `SELECT * FROM agent_sessions WHERE project_path = ? AND status != 'deleted'
       ORDER BY updated_at DESC LIMIT 50`,
    )
    .all(projectPath) as Record<string, unknown>[]
  return rows.map(rowToSession)
}

export function createSession(
  projectPath: string,
  mode: AgentSessionMode = 'normal',
  title?: string,
): AgentSession {
  const db = getAgentDb(projectPath)
  const now = new Date().toISOString()
  const id = randomUUID()
  const sessionTitle = title ?? `New chat · ${new Date().toLocaleTimeString()}`
  db.prepare(
    `INSERT INTO agent_sessions(id, project_path, title, mode, status, created_at, updated_at)
     VALUES(?, ?, ?, ?, 'active', ?, ?)`,
  ).run(id, projectPath, sessionTitle, mode, now, now)
  return rowToSession(
    db.prepare(`SELECT * FROM agent_sessions WHERE id = ?`).get(id) as Record<
      string,
      unknown
    >,
  )
}

export function getSession(
  projectPath: string,
  id: string,
): AgentSession | null {
  const db = getAgentDb(projectPath)
  const row = db
    .prepare(`SELECT * FROM agent_sessions WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  return row ? rowToSession(row) : null
}

export function updateSession(
  projectPath: string,
  id: string,
  patch: Partial<
    Pick<
      AgentSession,
      'title' | 'mode' | 'status' | 'summary' | 'activeTabPath'
    >
  >,
): void {
  const db = getAgentDb(projectPath)
  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]
  if (patch.title !== undefined) {
    fields.push('title = ?')
    values.push(patch.title)
  }
  if (patch.mode !== undefined) {
    fields.push('mode = ?')
    values.push(patch.mode)
  }
  if (patch.status !== undefined) {
    fields.push('status = ?')
    values.push(patch.status)
  }
  if (patch.summary !== undefined) {
    fields.push('summary = ?')
    values.push(patch.summary)
  }
  if (patch.activeTabPath !== undefined) {
    fields.push('active_tab_path = ?')
    values.push(patch.activeTabPath)
  }
  values.push(id)
  db.prepare(`UPDATE agent_sessions SET ${fields.join(', ')} WHERE id = ?`).run(
    ...values,
  )
}

export function getSessionMessages(
  projectPath: string,
  sessionId: string,
): AgentMessage[] {
  const db = getAgentDb(projectPath)
  const rows = db
    .prepare(
      `SELECT * FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC`,
    )
    .all(sessionId) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    sessionId: r.session_id as string,
    role: r.role as AgentMessage['role'],
    content: r.content as string,
    createdAt: r.created_at as string,
    metadata: r.metadata_json
      ? (JSON.parse(r.metadata_json as string) as AgentMessage['metadata'])
      : undefined,
  }))
}

export function saveMessage(projectPath: string, msg: AgentMessage): void {
  const db = getAgentDb(projectPath)
  db.prepare(
    `INSERT OR REPLACE INTO agent_messages(id, session_id, role, content, metadata_json, created_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
  ).run(
    msg.id,
    msg.sessionId ?? null,
    msg.role,
    msg.content,
    msg.metadata ? JSON.stringify(msg.metadata) : null,
    msg.createdAt,
  )
}

export function saveArtifact(
  projectPath: string,
  artifact: AgentArtifact,
): void {
  const db = getAgentDb(projectPath)
  db.prepare(
    `INSERT OR REPLACE INTO agent_artifacts(id, session_id, type, content_json, target_path, created_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
  ).run(
    artifact.id,
    artifact.sessionId,
    artifact.type,
    artifact.contentJson,
    artifact.targetPath ?? null,
    artifact.createdAt,
  )
}

export function getSessionArtifacts(
  projectPath: string,
  sessionId: string,
): AgentArtifact[] {
  const db = getAgentDb(projectPath)
  const rows = db
    .prepare(
      `SELECT * FROM agent_artifacts WHERE session_id = ? ORDER BY created_at DESC`,
    )
    .all(sessionId) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    sessionId: r.session_id as string,
    type: r.type as AgentArtifact['type'],
    contentJson: r.content_json as string,
    targetPath: (r.target_path as string) || undefined,
    createdAt: r.created_at as string,
  }))
}

export function saveAction(projectPath: string, action: AgentAction): void {
  const db = getAgentDb(projectPath)
  db.prepare(
    `INSERT OR REPLACE INTO agent_actions(id, session_id, type, status, payload_json, result_json, backup_path, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    action.id,
    action.sessionId,
    action.type,
    action.status,
    action.payloadJson,
    action.resultJson ?? null,
    action.backupPath ?? null,
    action.createdAt,
  )
}

export function updateAction(
  projectPath: string,
  id: string,
  patch: { status: AgentAction['status']; resultJson?: string },
): void {
  const db = getAgentDb(projectPath)
  db.prepare(
    `UPDATE agent_actions SET status = ?, result_json = ? WHERE id = ?`,
  ).run(patch.status, patch.resultJson ?? null, id)
}

export function getSessionActions(
  projectPath: string,
  sessionId: string,
): AgentAction[] {
  const db = getAgentDb(projectPath)
  const rows = db
    .prepare(
      `SELECT * FROM agent_actions WHERE session_id = ? ORDER BY created_at DESC`,
    )
    .all(sessionId) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    sessionId: r.session_id as string,
    type: r.type as AgentAction['type'],
    status: r.status as AgentAction['status'],
    payloadJson: r.payload_json as string,
    resultJson: (r.result_json as string) || undefined,
    backupPath: (r.backup_path as string) || undefined,
    createdAt: r.created_at as string,
  }))
}
