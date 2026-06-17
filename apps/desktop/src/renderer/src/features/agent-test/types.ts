export type ModelProvider = 'claude' | 'codex' | 'gemini' | 'local'

export interface AgentTestConfig {
  modelProvider: ModelProvider
  modelId: string
  mcpPlaywright: boolean
  skills: {
    browser: boolean
    playwright: boolean
  }
  systemMd: string
  agentsMd: string
}

export interface RunInput {
  url: string
  feature: string
  testData: string
  accountInfo: string
  additionalInstructions: string
}
