import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { McpToolDefinition, McpToolResult } from './mcp-client'
import { createJkautoMcpClient } from './jkauto-mcp'

export interface McpServerConfig {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled?: boolean
}

export type McpEditMode = 'ask' | 'auto' | 'auto-with-rollback'

const FILESYSTEM_WRITE_TOOLS = new Set([
  'write_file',
  'edit_file',
  'create_directory',
  'move_file',
  'delete_file',
])

interface ManagedClient {
  name: string
  client: Client
  transport?: StdioClientTransport
}

export class McpManager {
  private clients: ManagedClient[] = []
  private toolOwner = new Map<string, string>()
  private editMode: McpEditMode = 'ask'
  private projectPath = ''
  private sessionId = ''

  async setup(
    projectPath: string,
    userServers: McpServerConfig[],
    editMode: McpEditMode = 'ask',
    sessionId = '',
  ): Promise<void> {
    this.editMode = editMode
    this.projectPath = projectPath
    this.sessionId = sessionId

    const results = await Promise.allSettled([
      this.addInProcess('jkauto', () => createJkautoMcpClient(projectPath)),
      this.addStdio('filesystem', 'npx', [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        projectPath,
      ]),
      ...userServers
        .filter((s) => s.enabled !== false)
        .map((s) => this.addStdio(s.name, s.command, s.args, s.env)),
    ])

    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn('[mcp-manager] server failed to connect:', r.reason)
      }
    }

    await this.buildToolOwnerMap()
  }

  private async addInProcess(name: string, factory: () => Promise<Client>): Promise<void> {
    const client = await factory()
    this.clients.push({ name, client })
  }

  private async addStdio(
    name: string,
    command: string,
    args: string[],
    env?: Record<string, string>,
  ): Promise<void> {
    const transport = new StdioClientTransport({
      command,
      args,
      env: { PATH: process.env.PATH ?? '', ...env },
    })
    const client = new Client({ name: `jkauto-${name}`, version: '1.0.0' })
    await client.connect(transport, { timeout: 10000 })
    this.clients.push({ name, client, transport })
  }

  private async buildToolOwnerMap(): Promise<void> {
    for (const managed of this.clients) {
      try {
        const { tools } = await managed.client.listTools()
        for (const t of tools) {
          if (!this.toolOwner.has(t.name)) {
            this.toolOwner.set(t.name, managed.name)
          }
        }
      } catch (err) {
        console.warn(`[mcp-manager] listTools failed for ${managed.name}:`, err)
      }
    }
  }

  async listAllTools(): Promise<McpToolDefinition[]> {
    const all: McpToolDefinition[] = []
    for (const managed of this.clients) {
      try {
        const { tools } = await managed.client.listTools()
        for (const t of tools) {
          if (
            this.editMode === 'ask' &&
            managed.name === 'filesystem' &&
            FILESYSTEM_WRITE_TOOLS.has(t.name)
          ) {
            continue
          }
          all.push({
            name: t.name,
            description: t.description ?? '',
            inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
              type: 'object',
              properties: {},
            },
          })
        }
      } catch {}
    }
    return all
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const ownerName = this.toolOwner.get(name)
    const managed = this.clients.find((c) => c.name === ownerName)
    if (!managed) throw new Error(`MCP tool not found: ${name}`)

    if (
      this.editMode === 'auto-with-rollback' &&
      managed.name === 'filesystem' &&
      FILESYSTEM_WRITE_TOOLS.has(name)
    ) {
      await this.backupBeforeWrite(name, args)
    }

    const result = await managed.client.callTool({ name, arguments: args })
    const contentItems = result.content as Array<{ type: string; text?: string }>
    const content = contentItems
      .map((c) => (c.type === 'text' ? (c.text ?? '') : JSON.stringify(c)))
      .join('\n')
    return { content, isError: result.isError as boolean | undefined }
  }

  private async backupBeforeWrite(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<void> {
    const targetPath = args.path as string | undefined
    if (!targetPath) return
    try {
      const original = await fs.readFile(targetPath, 'utf-8')
      const backupDir = path.join(this.projectPath, '.autotest', 'agent-backups', this.sessionId)
      await fs.mkdir(backupDir, { recursive: true })
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(backupDir, `${ts}-${path.basename(targetPath)}`)
      await fs.writeFile(backupPath, original, 'utf-8')
      console.log(`[mcp-manager] backup before ${toolName}: ${backupPath}`)
    } catch {
      // file might not exist yet (new write) — ok
    }
  }

  async dispose(): Promise<void> {
    await Promise.allSettled(
      this.clients.map(async (managed) => {
        try {
          await managed.client.close()
        } catch {}
      }),
    )
    this.clients = []
    this.toolOwner.clear()
  }
}
