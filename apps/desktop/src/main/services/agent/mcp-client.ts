import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from 'openai/resources/responses/responses'

export interface McpToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface McpToolResult {
  content: string
  isError?: boolean
}

export class McpClient {
  private client: Client
  private transport: StdioClientTransport | null = null
  private connected = false

  constructor(private command: string, private args: string[]) {
    this.client = new Client({ name: 'jkauto-agent', version: '1.0.0' })
  }

  async connect(): Promise<void> {
    if (this.connected) return
    this.transport = new StdioClientTransport({ command: this.command, args: this.args })
    await this.client.connect(this.transport)
    this.connected = true
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.client.close()
    this.connected = false
  }

  async listTools(): Promise<Tool[]> {
    const { tools } = await this.client.listTools()
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: (t.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
      },
    }))
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.client.callTool({ name, arguments: args })
    const content = result.content
      .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
      .join('\n')
    return { content, isError: result.isError as boolean | undefined }
  }
}

// Spawn Playwright MCP server process — use Playwright-managed Chromium, not system Chrome
export function createPlaywrightMcpClient(): McpClient {
  return new McpClient('npx', ['@playwright/mcp@latest', '--browser', 'chromium'])
}
