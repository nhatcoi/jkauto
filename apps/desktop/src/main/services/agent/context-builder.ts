import fs from 'node:fs/promises'
import path from 'node:path'
import type { AgentContextResult, AgentContextSnapshot } from '@jkauto/core'

const MAX_FILE_CHARS = 18000

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function looksLikeTestCase(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase()
  return base.endsWith('.test.yaml') || base.endsWith('.test.yml')
}

async function readActiveFileContext(snapshot?: AgentContextSnapshot): Promise<string | null> {
  const activePath = snapshot?.activeTab?.path
  if (!activePath || !looksLikeTestCase(activePath)) return null

  try {
    const raw = await fs.readFile(activePath, 'utf-8')
    const truncated =
      raw.length > MAX_FILE_CHARS
        ? `${raw.slice(0, MAX_FILE_CHARS)}\n... truncated ${raw.length - MAX_FILE_CHARS} chars`
        : raw
    return `Active test case file (${activePath}):\n${truncated}`
  } catch (err) {
    return `Active file could not be read (${activePath}): ${
      err instanceof Error ? err.message : String(err)
    }`
  }
}

export async function buildAgentContext(
  snapshot?: AgentContextSnapshot,
): Promise<AgentContextResult> {
  const parts: string[] = []

  if (!snapshot) {
    return { summary: 'No app context was provided.' }
  }

  parts.push(`Renderer app context:\n${compactJson(snapshot)}`)

  const activeFile = await readActiveFileContext(snapshot)
  if (activeFile) parts.push(activeFile)

  return { summary: parts.join('\n\n') }
}
