import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type {
  AgentChatPayload,
  AgentSessionListPayload,
  AgentSessionCreatePayload,
  AgentSessionUpdatePayload,
  AgentSessionDeletePayload,
  AgentSessionDataPayload,
} from '@jkauto/core'
import {
  chatWithAgent,
  getAgentContext,
  listAgentSessions,
  createAgentSession,
  updateAgentSession,
} from '../services/agent/agent.service'
import {
  getSessionMessages,
  getSessionArtifacts,
  getSessionActions,
  updateSession,
} from '../services/agent/session.service'
import { getSettings } from '../services/settings.service'

export function registerAgentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.AGENT_CHAT, async (event, payload: AgentChatPayload) => {
    const settings = await getSettings()
    return chatWithAgent(payload, settings.agent, (chunk) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IpcChannels.AGENT_STREAM_CHUNK, chunk)
      }
    })
  })

  ipcMain.handle(IpcChannels.AGENT_GET_CONTEXT, async (_, payload: AgentChatPayload) => {
    return getAgentContext(payload)
  })

  ipcMain.handle(IpcChannels.AGENT_CANCEL, async () => {
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.AGENT_SESSION_LIST, async (_, payload: AgentSessionListPayload) => {
    return listAgentSessions(payload.projectPath)
  })

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_CREATE,
    async (_, payload: AgentSessionCreatePayload) => {
      return createAgentSession(payload.projectPath, payload.mode, payload.title)
    },
  )

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_UPDATE,
    async (_, payload: AgentSessionUpdatePayload) => {
      await updateAgentSession(payload.projectPath, payload.id, payload.patch)
      return { ok: true }
    },
  )

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_DELETE,
    async (_, payload: AgentSessionDeletePayload) => {
      updateSession(payload.projectPath, payload.id, { status: 'archived' })
      return { ok: true }
    },
  )

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_MESSAGES,
    async (_, payload: AgentSessionDataPayload) => {
      return getSessionMessages(payload.projectPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_ARTIFACTS,
    async (_, payload: AgentSessionDataPayload) => {
      return getSessionArtifacts(payload.projectPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_ACTIONS,
    async (_, payload: AgentSessionDataPayload) => {
      return getSessionActions(payload.projectPath, payload.sessionId)
    },
  )
}
