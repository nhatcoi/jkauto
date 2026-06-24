import type { IpcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import { parse as yamlParse } from 'yaml'
import { IpcChannels } from '@jkauto/core'
import type {
  TestRunAutoStartPayload,
  TestRunAutoProgress,
  TestRunAutoReport,
  TestRunAutoGroupResult,
  TestRunAutoTestResult,
  TestCase,
  Profile,
} from '@jkauto/core'
import { runTestCase } from '@jkauto/engine'
import { getAnalysisRun, getAnalysisArtifacts } from '../services/autogen/autogen-db'
import {
  buildGroupsFromArtifacts,
  generateGroup,
} from '../services/autogen/playwright-generator'
import { getSettings } from '../services/settings.service'

async function readTestCase(filePath: string): Promise<TestCase | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return yamlParse(raw) as TestCase
  } catch {
    return null
  }
}

export function registerTestRunAutoHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IpcChannels.TESTRUN_AUTO_START,
    async (event, payload: TestRunAutoStartPayload): Promise<TestRunAutoReport> => {
      const { projectPath, config } = payload
      const runId = randomUUID()
      const startedAt = new Date().toISOString()

      const send = (p: TestRunAutoProgress) => {
        if (!event.sender.isDestroyed()) event.sender.send(IpcChannels.TESTRUN_AUTO_PROGRESS, p)
      }

      // Load analysis
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
        sourceRefs: [] as string[],
        createdAt: r.created_at as string,
      })) as import('@jkauto/core').CodeAnalysisArtifact[]

      // Agent LLM config
      const settings = await getSettings()
      const llmConfig = settings.agent
        ? { baseUrl: settings.agent.baseUrl, apiKey: settings.agent.apiKey, model: settings.agent.model }
        : undefined

      // Seed data
      const seedArtifact = artifacts.find((a) => a.type === 'seed-catalog')
      let seeds: unknown[] = []
      try { seeds = JSON.parse(seedArtifact?.contentJson ?? '[]') } catch { /* ok */ }
      if (!Array.isArray(seeds)) seeds = []

      const groups = buildGroupsFromArtifacts(artifacts)
      const allGroupResults: TestRunAutoGroupResult[] = []
      const total = groups.length || 1

      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi]
        const basePercent = Math.round((gi / total) * 90)

        // Resolve baseUrl per platform
        const vars: Record<string, string> = {
          baseUrl: group.platform === 'web' ? config.frontendUrl : config.apiUrl,
        }
        if (config.authToken) vars['authToken'] = config.authToken

        // ── 1. Generate test files ──
        send({
          phase: 'generating',
          groupId: group.id,
          groupLabel: group.label,
          message: `Generating ${group.label}...`,
          percent: basePercent,
        })

        let savedResult: import('@jkauto/core').TestgenSavedResult
        try {
          savedResult = await generateGroup(projectPath, group, seeds, llmConfig, vars)
        } catch (e) {
          allGroupResults.push({
            groupId: group.id,
            label: group.label,
            platform: group.platform,
            tests: [{ name: group.label, status: 'failed', durationMs: 0, error: String(e) }],
            generatedFiles: [],
          })
          continue
        }

        // ── 2. Run each generated .test.yaml ──
        const testResults: TestRunAutoTestResult[] = []
        const yamlPaths = savedResult.savedPaths.jkauto

        const screenshotDir = path.join(projectPath, '.autotest', 'screenshots', group.id)
        const profile: Profile = {
          schemaVersion: 1,
          name: 'autorun',
          variables: { baseUrl: vars['baseUrl'] ?? '', ...vars },
        }

        for (const yamlPath of yamlPaths) {
          const tcName = path.basename(yamlPath, path.extname(yamlPath))

          send({
            phase: 'running',
            groupId: group.id,
            groupLabel: group.label,
            testName: tcName,
            status: 'running',
            percent: basePercent + 5,
            message: `Running ${tcName}...`,
          })

          const tc = await readTestCase(yamlPath)
          if (!tc) {
            testResults.push({ name: tcName, status: 'failed', durationMs: 0, error: 'Could not parse test file' })
            continue
          }

          let finalStatus: 'passed' | 'failed' = 'passed'
          let finalDuration = 0
          let finalScreenshotPath: string | undefined
          const tcRunId = randomUUID()

          await new Promise<void>((resolve) => {
            runTestCase(
              tc,
              profile,
              tcRunId,
              () => { /* step events not needed here */ },
              (complete) => {
                finalStatus = complete.status === 'passed' ? 'passed' : 'failed'
                finalDuration = complete.durationMs
                finalScreenshotPath = complete.finalScreenshotPath
                resolve()
              },
              undefined,
              {
                headless: config.headless ?? true,
                screenshotDir,
                screenshotMode: 'final',
              },
            )
          })

          send({
            phase: 'running',
            groupId: group.id,
            groupLabel: group.label,
            testName: tcName,
            status: finalStatus,
            screenshotPath: finalScreenshotPath,
            durationMs: finalDuration,
            percent: basePercent + 8,
          })

          testResults.push({
            name: tcName,
            status: finalStatus,
            durationMs: finalDuration,
            screenshotPath: finalScreenshotPath,
          })
        }

        allGroupResults.push({
          groupId: group.id,
          label: group.label,
          platform: group.platform,
          tests: testResults,
          generatedFiles: savedResult.savedPaths.jkauto,
        })
      }

      const completedAt = new Date().toISOString()
      const allTests = allGroupResults.flatMap((g) => g.tests)

      const report: TestRunAutoReport = {
        runId,
        projectPath,
        config,
        startedAt,
        completedAt,
        groups: allGroupResults,
        summary: {
          totalGroups: allGroupResults.length,
          totalTests: allTests.length,
          passed: allTests.filter((t) => t.status === 'passed').length,
          failed: allTests.filter((t) => t.status === 'failed').length,
          durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        },
      }

      send({ phase: 'done', message: 'Auto test run complete', percent: 100 })
      return report
    },
  )
}
