import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type { AgentChatPayload } from '@jkauto/core'
import { chatWithAgent, getAgentContext } from '../services/agent/agent.service'
import { getSettings } from '../services/settings.service'

const execAsync = promisify(exec)

async function installPlaywrightSkill(projectPath: string): Promise<void> {
  const tmpDir = `/tmp/playwright-skill-temp-${Date.now()}`
  const skillTarget = `${projectPath}/.claude/skills`

  try {
    await execAsync(`git clone https://github.com/lackeyjb/playwright-skill.git "${tmpDir}"`)
    await execAsync(`mkdir -p "${skillTarget}"`)
    await execAsync(`cp -r "${tmpDir}/skills/playwright-skill" "${skillTarget}/"`)
    await execAsync(`cd "${skillTarget}/playwright-skill" && npm run setup`, { cwd: skillTarget })
  } finally {
    await execAsync(`rm -rf "${tmpDir}"`).catch(() => {})
  }
}

export function registerAgentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.AGENT_CHAT, async (_, payload: AgentChatPayload) => {
    const settings = await getSettings()
    return chatWithAgent(payload, settings.agent)
  })

  ipcMain.handle(IpcChannels.AGENT_GET_CONTEXT, async (_, payload: AgentChatPayload) => {
    return getAgentContext(payload)
  })

  ipcMain.handle(IpcChannels.AGENT_CANCEL, async () => {
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.AGENT_INSTALL_SKILL, async (_, projectPath: string) => {
    await installPlaywrightSkill(projectPath)
  })

  ipcMain.handle(IpcChannels.AGENT_INSTALL_BROWSERS, async () => {
    await execAsync('npx playwright install chromium --with-deps')
  })
}
