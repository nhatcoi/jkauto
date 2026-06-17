import { create } from 'zustand'
import type { AgentMessage } from '../agent/types'
import type { AgentTestConfig, RunInput } from './types'

export const DEFAULT_BROWSER_SKILL = `# Browser Skill

Use this skill to interact with web browsers via Playwright MCP.

## Core Actions
- Navigate to URLs
- Click elements by testid, css, or text
- Fill form inputs
- Take screenshots to verify state
- Extract visible text content
- Wait for elements to appear

## Best Practices
- Always screenshot after significant actions
- Prefer data-testid selectors, fall back to CSS, then XPath
- Verify page state before interacting with elements`

export const DEFAULT_PLAYWRIGHT_SKILL = `# Playwright Skill

Use this skill to generate JKAuto-compatible test automation.

## Step Keywords
- navigate-to: Navigate to a URL
- click: Click an element
- type-text: Type text into an input
- assert-text: Assert element text matches expected value
- assert-visible: Assert element is visible on page
- wait-for: Wait for element or condition
- take-screenshot: Capture a screenshot

## Test Generation Rules
1. Use data-testid locators first, fall back to CSS selectors
2. Add assertions after every significant user action
3. Include both happy path and edge cases
4. Use descriptive step names that explain user intent
5. Format object refs as: PageName.elementName`

const DEFAULT_SYSTEM_MD = `You are an AI test automation agent for JKAuto.

When given a URL and feature to test:
1. Open the browser and navigate to the URL
2. Explore the UI and understand the feature thoroughly
3. Trace all user actions and capture element selectors
4. Test both happy path and edge cases
5. Generate complete test cases in JKAuto format
6. Save results to the agent-tests/ directory`

const DEFAULT_AGENTS_MD = `# AgentTest

AI-powered test generation agent.

## Capabilities
- Autonomous browser exploration via Playwright MCP
- UI element discovery and locator capture
- Test case generation from natural language intent
- Object repository building`

const DEFAULT_CONFIG: AgentTestConfig = {
  modelProvider: 'claude',
  modelId: 'claude-opus-4-8',
  mcpPlaywright: true,
  skills: { browser: true, playwright: true },
  systemMd: DEFAULT_SYSTEM_MD,
  agentsMd: DEFAULT_AGENTS_MD,
}

interface AgentTestStore {
  config: AgentTestConfig
  runInput: RunInput
  messages: AgentMessage[]
  sendState: 'idle' | 'sending' | 'error'
  error: string | null

  setConfig: (updates: Partial<AgentTestConfig>) => void
  setRunInput: (updates: Partial<RunInput>) => void
  addMessage: (msg: AgentMessage) => void
  clearMessages: () => void
  setSendState: (s: 'idle' | 'sending' | 'error') => void
  setError: (e: string | null) => void
}

export const useAgentTestStore = create<AgentTestStore>((set) => ({
  config: DEFAULT_CONFIG,
  runInput: { url: '', feature: '', testData: '', accountInfo: '', additionalInstructions: '' },
  messages: [],
  sendState: 'idle',
  error: null,

  setConfig: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        ...updates,
        skills: updates.skills
          ? { ...state.config.skills, ...updates.skills }
          : state.config.skills,
      },
    })),

  setRunInput: (updates) =>
    set((state) => ({ runInput: { ...state.runInput, ...updates } })),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  clearMessages: () =>
    set({ messages: [], sendState: 'idle', error: null }),

  setSendState: (sendState) => set({ sendState }),

  setError: (error) => set({ error, sendState: error ? 'error' : 'idle' }),
}))
