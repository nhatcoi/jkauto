import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type { TestgenGeneratePayload } from '@jkauto/core'
import { getSettings } from '../services/settings.service'
import { getAnalysisRun, getAnalysisArtifacts } from '../services/autogen/autogen-db'
import { buildGroupsFromArtifacts, generateGroup, readProjectVars } from '../services/autogen/playwright-generator'

export function registerTestgenHandlers(ipcMain: IpcMain): void {
  // Let renderer pre-fill config form with profile vars
  ipcMain.handle(
    IpcChannels.TESTGEN_GET_PROFILE_VARS,
    async (_, { projectPath }: { projectPath: string }) => readProjectVars(projectPath),
  )

  ipcMain.handle(
    IpcChannels.TESTGEN_GENERATE,
    async (event, payload: TestgenGeneratePayload) => {
      const { projectPath, groupIds, vars: varsOverride } = payload

      const settings = await getSettings()
      const configOverride = settings.agent
        ? { baseUrl: settings.agent.baseUrl, apiKey: settings.agent.apiKey, model: settings.agent.model }
        : undefined

      const run = getAnalysisRun(projectPath)
      if (!run) throw new Error('No analysis found. Click Analyze first.')

      const rawArtifacts = getAnalysisArtifacts(projectPath, run.id as string)
      const artifacts = rawArtifacts.map((r) => ({
        id: r.id as string,
        runId: r.run_id as string,
        type: r.artifact_type as string,
        title: r.title as string,
        summary: r.summary as string,
        contentJson: r.content_json as string,
        itemCount: r.item_count as number,
        confidence: r.confidence as number,
        sourceRefs: [],
        createdAt: r.created_at as string,
      })) as import('@jkauto/core').CodeAnalysisArtifact[]

      const allGroups = buildGroupsFromArtifacts(artifacts)
      const groups = groupIds?.length
        ? allGroups.filter((g) => groupIds.includes(g.id))
        : allGroups

      const seedArtifact = artifacts.find((a) => a.type === 'seed-catalog')
      let seeds: unknown[] = []
      try { seeds = JSON.parse(seedArtifact?.contentJson ?? '[]') } catch { /* ok */ }
      if (!Array.isArray(seeds)) seeds = []

      const results = []
      for (const group of groups) {
        const result = await generateGroup(
          projectPath,
          group,
          seeds,
          configOverride,
          varsOverride,
          (progress) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IpcChannels.TESTGEN_PROGRESS, progress)
            }
          },
        )
        results.push(result)
      }

      return { ok: true, results }
    },
  )
}
