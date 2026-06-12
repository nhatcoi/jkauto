import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type { AgentChatPayload } from '@jkauto/core'
import { chatWithAgent, getAgentContext } from '../services/agent/agent.service'
import { getSettings } from '../services/settings.service'

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
}
