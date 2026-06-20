import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as yamlParse } from 'yaml'
import { TestCaseSchema } from '@jkauto/core'
import type {
  HarnessArtifact,
  HarnessReport,
  HarnessRun,
  HarnessState,
  HarnessStep,
  HarnessStepStatus,
} from '@jkauto/core'
import { getAgentDb } from './agent-db'
import {
  getCodeMap,
  getRelevantCodeContext,
  startIndex,
} from '../autogen/autogen.service'

interface TestPlan {
  target: { type: 'page' | 'api' | 'flow'; id: string }
  preconditions: string[]
  scenarios: Array<{
    id: string
    goal: string
    priority: 'critical' | 'normal' | 'edge'
    actions: string[]
    assertions: string[]
    evidenceRequired: string[]
  }>
  sourceRefs: Array<{ file: string; line?: number; symbol?: string }>
}

const HARNESS_CONTROL_TOOLS = new Set([
  'record_test_plan',
  'record_verification',
  'validate_test_case',
  'run_generated_test',
  'save_test_case_steps',
])

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}

function rowToRun(row: Record<string, unknown>): HarnessRun {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    projectPath: String(row.project_path),
    request: String(row.request),
    state: row.state as HarnessState,
    status: row.status as HarnessRun['status'],
    codeIndexId: row.code_index_id ? String(row.code_index_id) : undefined,
    generatedTestPath: row.generated_test_path
      ? String(row.generated_test_path)
      : undefined,
    error: row.error ? String(row.error) : undefined,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  }
}

function rowToStep(row: Record<string, unknown>): HarnessStep {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    sequence: Number(row.sequence),
    state: row.state as HarnessState,
    status: row.status as HarnessStepStatus,
    inputJson: row.input_json ? String(row.input_json) : undefined,
    outputJson: row.output_json ? String(row.output_json) : undefined,
    error: row.error ? String(row.error) : undefined,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  }
}

function rowToArtifact(row: Record<string, unknown>): HarnessArtifact {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    stepId: row.step_id ? String(row.step_id) : undefined,
    type: row.type as HarnessArtifact['type'],
    contentJson: String(row.content_json),
    sourceRef: row.source_ref ? String(row.source_ref) : undefined,
    createdAt: String(row.created_at),
  }
}

function nextSequence(projectPath: string, runId: string): number {
  const row = getAgentDb(projectPath)
    .prepare(
      'SELECT COALESCE(MAX(sequence), 0) AS value FROM harness_steps WHERE run_id = ?',
    )
    .get(runId) as { value: number }
  return row.value + 1
}

export function getActiveHarnessRun(
  projectPath: string,
  sessionId: string,
): HarnessRun | null {
  const row = getAgentDb(projectPath)
    .prepare(
      `SELECT * FROM harness_runs
       WHERE session_id = ? AND status = 'running'
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(sessionId) as Record<string, unknown> | undefined
  return row ? rowToRun(row) : null
}

export function listHarnessRuns(
  projectPath: string,
  sessionId?: string,
): HarnessRun[] {
  const db = getAgentDb(projectPath)
  const rows = (sessionId
    ? db
        .prepare(
          'SELECT * FROM harness_runs WHERE session_id = ? ORDER BY started_at DESC',
        )
        .all(sessionId)
    : db
        .prepare(
          'SELECT * FROM harness_runs WHERE project_path = ? ORDER BY started_at DESC LIMIT 100',
        )
        .all(projectPath)) as Record<string, unknown>[]
  return rows.map(rowToRun)
}

export function startHarnessRun(
  projectPath: string,
  sessionId: string,
  request: string,
): HarnessRun {
  const db = getAgentDb(projectPath)
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO harness_runs(
      id, session_id, project_path, request, state, status, started_at
    ) VALUES (?, ?, ?, ?, 'discover', 'running', ?)`,
  ).run(id, sessionId, projectPath, request, now)
  return rowToRun(
    db.prepare('SELECT * FROM harness_runs WHERE id = ?').get(id) as Record<
      string,
      unknown
    >,
  )
}

export function recordHarnessStep(
  projectPath: string,
  runId: string,
  state: HarnessState,
  status: HarnessStepStatus,
  input?: unknown,
  output?: unknown,
  error?: string,
): HarnessStep {
  const db = getAgentDb(projectPath)
  const id = randomUUID()
  const now = new Date().toISOString()
  const completedAt =
    status === 'passed' || status === 'failed' ? now : undefined
  db.prepare(
    `INSERT INTO harness_steps(
      id, run_id, sequence, state, status, input_json, output_json, error,
      started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    runId,
    nextSequence(projectPath, runId),
    state,
    status,
    input === undefined ? null : JSON.stringify(input),
    output === undefined ? null : JSON.stringify(output),
    error ?? null,
    now,
    completedAt ?? null,
  )
  db.prepare('UPDATE harness_runs SET state = ? WHERE id = ?').run(state, runId)
  return rowToStep(
    db.prepare('SELECT * FROM harness_steps WHERE id = ?').get(id) as Record<
      string,
      unknown
    >,
  )
}

export function saveHarnessArtifact(
  projectPath: string,
  runId: string,
  type: HarnessArtifact['type'],
  content: unknown,
  stepId?: string,
  sourceRef?: string,
): HarnessArtifact {
  const db = getAgentDb(projectPath)
  const artifact: HarnessArtifact = {
    id: randomUUID(),
    runId,
    stepId,
    type,
    contentJson: JSON.stringify(content),
    sourceRef,
    createdAt: new Date().toISOString(),
  }
  db.prepare(
    `INSERT INTO harness_artifacts(
      id, run_id, step_id, type, content_json, source_ref, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    artifact.id,
    artifact.runId,
    artifact.stepId ?? null,
    artifact.type,
    artifact.contentJson,
    artifact.sourceRef ?? null,
    artifact.createdAt,
  )
  return artifact
}

function buildFallbackPlan(request: string, codeGraph: ReturnType<typeof getCodeMap>): TestPlan {
  const lower = request.toLowerCase()
  const isApi = /\b(api|endpoint|http|rest|curl)\b/.test(lower)
  const firstEndpoint = codeGraph?.endpoints?.[0] as
    | { method?: string; path?: string; source_file?: string }
    | undefined
  const firstPage = codeGraph?.pages?.[0] as
    | { route?: string; component_file?: string }
    | undefined
  const targetId = isApi
    ? `${firstEndpoint?.method ?? 'API'} ${firstEndpoint?.path ?? request}`
    : (firstPage?.route ?? request)

  return {
    target: { type: isApi ? 'api' : 'flow', id: targetId },
    preconditions: ['Project profile and target application are available'],
    scenarios: [
      {
        id: 'primary',
        goal: request,
        priority: 'critical',
        actions: isApi
          ? ['Call the target endpoint with representative input']
          : ['Open the target application', 'Perform the requested user flow'],
        assertions: isApi
          ? ['Assert HTTP status and relevant response fields']
          : ['Assert the requested visible outcome and final browser state'],
        evidenceRequired: isApi
          ? ['Request/response evidence', 'Generated test runtime result']
          : ['Observed DOM/selector evidence', 'Generated test runtime result'],
      },
    ],
    sourceRefs: [
      ...(firstEndpoint?.source_file
        ? [{ file: firstEndpoint.source_file }]
        : []),
      ...(firstPage?.component_file
        ? [{ file: firstPage.component_file }]
        : []),
    ],
  }
}

export async function discoverAndPlanHarness(
  projectPath: string,
  runId: string,
  request: string,
): Promise<{ codeGraphSummary: unknown; plan: TestPlan }> {
  let codeGraph = getCodeMap(projectPath)
  const indexProgress: unknown[] = []
  if (!codeGraph) {
    try {
      const project = JSON.parse(
        await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8'),
      ) as { repoUrl?: string }
      if (project.repoUrl?.trim()) {
        await startIndex(
          { repoUrl: project.repoUrl.trim(), projectPath },
          (progress) => indexProgress.push(progress),
        )
        codeGraph = getCodeMap(projectPath)
      }
    } catch (error) {
      indexProgress.push({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  const relevantNodes = getRelevantCodeContext(projectPath, request)
  const codeGraphSummary = codeGraph
    ? {
        indexId: codeGraph.indexId,
        repoUrl: codeGraph.repoUrl,
        framework: codeGraph.framework,
        language: codeGraph.language,
        pages: codeGraph.pages?.slice(0, 50) ?? [],
        elements: codeGraph.elements?.slice(0, 100) ?? [],
        endpoints: codeGraph.endpoints?.slice(0, 50) ?? [],
        relevantNodes,
        indexProgress,
      }
    : {
        indexed: false,
        message:
          'No repository index is available. Configure project.repoUrl to enable automatic indexing.',
        indexProgress,
      }

  const discover = recordHarnessStep(
    projectPath,
    runId,
    'discover',
    'passed',
    { request },
    codeGraphSummary,
  )
  saveHarnessArtifact(
    projectPath,
    runId,
    'codegraph',
    codeGraphSummary,
    discover.id,
    codeGraph?.indexId,
  )
  if (codeGraph?.indexId) {
    getAgentDb(projectPath)
      .prepare('UPDATE harness_runs SET code_index_id = ? WHERE id = ?')
      .run(codeGraph.indexId, runId)
  }

  const plan = buildFallbackPlan(request, codeGraph)
  const planStep = recordHarnessStep(
    projectPath,
    runId,
    'plan',
    'passed',
    { request },
    plan,
  )
  saveHarnessArtifact(projectPath, runId, 'testplan', plan, planStep.id)
  return { codeGraphSummary, plan }
}

export function recordToolEvidence(
  projectPath: string,
  sessionId: string,
  name: string,
  args?: Record<string, unknown>,
  result?: string,
): void {
  const run = getActiveHarnessRun(projectPath, sessionId)
  if (!run) return
  if (HARNESS_CONTROL_TOOLS.has(name)) return
  const isFailure = Boolean(result && /(^|\s)(error|failed|failure):?/i.test(result))
  const state: HarnessState = isFailure ? 'repair' : 'execute'
  const step = recordHarnessStep(
    projectPath,
    run.id,
    state,
    isFailure ? 'failed' : 'passed',
    { tool: name, args },
    { result },
    isFailure ? result : undefined,
  )
  saveHarnessArtifact(
    projectPath,
    run.id,
    'tool-evidence',
    { tool: name, args, result, failed: isFailure },
    step.id,
  )
}

export function recordVerification(
  projectPath: string,
  sessionId: string,
  payload: {
    passed: boolean
    assertion: string
    evidence: string
    generatedTestPath?: string
  },
): void {
  const run = getActiveHarnessRun(projectPath, sessionId)
  if (!run) throw new Error('No active harness run')
  const state: HarnessState = payload.passed ? 'verify' : 'repair'
  const step = recordHarnessStep(
    projectPath,
    run.id,
    state,
    payload.passed ? 'passed' : 'failed',
    { assertion: payload.assertion },
    { evidence: payload.evidence },
    payload.passed ? undefined : payload.evidence,
  )
  saveHarnessArtifact(projectPath, run.id, 'verification', payload, step.id)
  if (payload.generatedTestPath) {
    getAgentDb(projectPath)
      .prepare('UPDATE harness_runs SET generated_test_path = ? WHERE id = ?')
      .run(payload.generatedTestPath, run.id)
  }
}

export async function validateGeneratedTest(
  projectPath: string,
  sessionId: string,
  filePath: string,
): Promise<{ valid: boolean; errors: string[]; testName?: string }> {
  const run = getActiveHarnessRun(projectPath, sessionId)
  if (!run) throw new Error('No active harness run')
  const resolved = path.resolve(filePath)
  const allowedRoot = path.resolve(projectPath, 'test-cases')
  if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error('Generated test must be under the project test-cases directory')
  }

  let parsed: unknown
  try {
    parsed = yamlParse(await fs.readFile(resolved, 'utf-8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    recordHarnessStep(
      projectPath,
      run.id,
      'validate_schema',
      'failed',
      { filePath: resolved },
      undefined,
      message,
    )
    return { valid: false, errors: [message] }
  }

  const validation = TestCaseSchema.safeParse(parsed)
  const errors = validation.success
    ? [
        ...(validation.data.steps.length === 0
          ? ['steps: generated test must contain at least one step']
          : []),
        ...(!validation.data.steps.some((step) =>
          step.keyword.startsWith('assert-'),
        )
          ? ['steps: generated test must contain at least one assertion']
          : []),
        ...(!validation.data.platform
          ? ['platform: generated test must declare its target platform']
          : []),
      ]
    : validation.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
  const valid = validation.success && errors.length === 0
  const step = recordHarnessStep(
    projectPath,
    run.id,
    'validate_schema',
    valid ? 'passed' : 'failed',
    { filePath: resolved },
    valid ? { testName: validation.data.name } : { errors },
    valid ? undefined : errors.join('; '),
  )
  saveHarnessArtifact(
    projectPath,
    run.id,
    'validation',
    { filePath: resolved, valid, errors },
    step.id,
    resolved,
  )
  if (valid && validation.success) {
    getAgentDb(projectPath)
      .prepare('UPDATE harness_runs SET generated_test_path = ? WHERE id = ?')
      .run(resolved, run.id)
    saveHarnessArtifact(
      projectPath,
      run.id,
      'generated-test',
      validation.data,
      step.id,
      resolved,
    )
  }
  return {
    valid,
    errors,
    testName: validation.success ? validation.data.name : undefined,
  }
}

export function recordRuntimeResult(
  projectPath: string,
  sessionId: string,
  result: { passed: boolean; filePath: string; details: unknown },
): void {
  const run = getActiveHarnessRun(projectPath, sessionId)
  if (!run) throw new Error('No active harness run')
  const step = recordHarnessStep(
    projectPath,
    run.id,
    'run_generated_test',
    result.passed ? 'passed' : 'failed',
    { filePath: result.filePath },
    result.details,
    result.passed ? undefined : JSON.stringify(result.details),
  )
  saveHarnessArtifact(projectPath, run.id, 'runtime-result', result, step.id)
}

export function finalizeHarnessRun(
  projectPath: string,
  runId: string,
): HarnessReport {
  const db = getAgentDb(projectPath)
  const steps = (
    db
      .prepare('SELECT * FROM harness_steps WHERE run_id = ? ORDER BY sequence')
      .all(runId) as Record<string, unknown>[]
  ).map(rowToStep)
  const required: HarnessState[] = [
    'discover',
    'plan',
    'verify',
    'compile',
    'validate_schema',
    'run_generated_test',
    'save',
  ]
  const missing = required.filter(
    (state) => !steps.some((step) => step.state === state && step.status === 'passed'),
  )
  const planRow = db
    .prepare(
      `SELECT content_json FROM harness_artifacts
       WHERE run_id = ? AND type = 'testplan'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(runId) as { content_json: string } | undefined
  const plan = planRow
    ? parseJson<TestPlan | null>(planRow.content_json, null)
    : null
  const expectedVerifications = Math.max(
    1,
    plan?.scenarios.reduce(
      (count, scenario) => count + scenario.assertions.length,
      0,
    ) ?? 1,
  )
  const passedVerifications = steps.filter(
    (step) => step.state === 'verify' && step.status === 'passed',
  ).length
  if (
    passedVerifications < expectedVerifications &&
    !missing.includes('verify')
  ) {
    missing.push('verify')
  }
  const latestGateStatus = (state: HarnessState) =>
    [...steps].reverse().find((step) => step.state === state)?.status
  const failed = ['validate_schema', 'run_generated_test'].some(
    (state) => latestGateStatus(state as HarnessState) !== 'passed',
  )
  const now = new Date().toISOString()
  if (missing.length > 0 || failed) {
    const error =
      missing.length > 0
        ? `Harness gates not satisfied: ${missing.join(', ')}${
            missing.includes('verify')
              ? ` (${passedVerifications}/${expectedVerifications} assertions verified)`
              : ''
          }`
        : 'A hard validation gate failed'
    db.prepare(
      `UPDATE harness_runs
       SET state = 'failed', status = 'failed', error = ?, completed_at = ?
       WHERE id = ?`,
    ).run(error, now, runId)
    recordHarnessStep(projectPath, runId, 'failed', 'failed', { missing }, undefined, error)
  } else {
    recordHarnessStep(projectPath, runId, 'complete', 'passed')
    db.prepare(
      `UPDATE harness_runs
       SET state = 'complete', status = 'passed', completed_at = ?
       WHERE id = ?`,
    ).run(now, runId)
  }
  const report = getHarnessReport(projectPath, runId)
  saveHarnessArtifact(projectPath, runId, 'report', {
    run: report.run,
    summary: report.summary,
    timeline: report.steps.map((step) => ({
      sequence: step.sequence,
      state: step.state,
      status: step.status,
      error: step.error,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    })),
  })
  return getHarnessReport(projectPath, runId)
}

export function markCompileAndSave(
  projectPath: string,
  sessionId: string,
  filePath: string,
): void {
  const run = getActiveHarnessRun(projectPath, sessionId)
  if (!run) throw new Error('No active harness run')
  recordHarnessStep(projectPath, run.id, 'compile', 'passed', undefined, {
    filePath,
  })
  recordHarnessStep(projectPath, run.id, 'save', 'passed', undefined, {
    filePath,
  })
  getAgentDb(projectPath)
    .prepare('UPDATE harness_runs SET generated_test_path = ? WHERE id = ?')
    .run(filePath, run.id)
}

export function failHarnessRun(
  projectPath: string,
  runId: string,
  error: string,
): void {
  const now = new Date().toISOString()
  recordHarnessStep(projectPath, runId, 'failed', 'failed', undefined, undefined, error)
  getAgentDb(projectPath)
    .prepare(
      `UPDATE harness_runs
       SET state = 'failed', status = 'failed', error = ?, completed_at = ?
       WHERE id = ?`,
    )
    .run(error, now, runId)
  const report = getHarnessReport(projectPath, runId)
  saveHarnessArtifact(projectPath, runId, 'report', {
    run: report.run,
    summary: report.summary,
    error,
    timeline: report.steps.map((step) => ({
      sequence: step.sequence,
      state: step.state,
      status: step.status,
      error: step.error,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    })),
  })
}

export function getHarnessReport(
  projectPath: string,
  runId: string,
): HarnessReport {
  const db = getAgentDb(projectPath)
  const runRow = db
    .prepare('SELECT * FROM harness_runs WHERE id = ?')
    .get(runId) as Record<string, unknown> | undefined
  if (!runRow) throw new Error(`Harness run not found: ${runId}`)
  const run = rowToRun(runRow)
  const steps = (
    db
      .prepare('SELECT * FROM harness_steps WHERE run_id = ? ORDER BY sequence')
      .all(runId) as Record<string, unknown>[]
  ).map(rowToStep)
  const artifacts = (
    db
      .prepare(
        'SELECT * FROM harness_artifacts WHERE run_id = ? ORDER BY created_at',
      )
      .all(runId) as Record<string, unknown>[]
  ).map(rowToArtifact)
  const durationMs =
    new Date(run.completedAt ?? new Date().toISOString()).getTime() -
    new Date(run.startedAt).getTime()
  return {
    run,
    steps,
    artifacts,
    summary: {
      totalSteps: steps.length,
      passedSteps: steps.filter((step) => step.status === 'passed').length,
      failedSteps: steps.filter((step) => step.status === 'failed').length,
      repairCount: steps.filter((step) => step.state === 'repair').length,
      toolEvidenceCount: artifacts.filter(
        (artifact) => artifact.type === 'tool-evidence',
      ).length,
      durationMs,
    },
  }
}

export function getTestPlanForSession(
  projectPath: string,
  sessionId: string,
): TestPlan | null {
  const run = getActiveHarnessRun(projectPath, sessionId)
  if (!run) return null
  const row = getAgentDb(projectPath)
    .prepare(
      `SELECT content_json FROM harness_artifacts
       WHERE run_id = ? AND type = 'testplan'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(run.id) as { content_json: string } | undefined
  return row ? parseJson<TestPlan>(row.content_json, null as never) : null
}

export function recordTestPlan(
  projectPath: string,
  sessionId: string,
  plan: TestPlan,
): void {
  const run = getActiveHarnessRun(projectPath, sessionId)
  if (!run) throw new Error('No active harness run')
  if (!plan.target?.id || !Array.isArray(plan.scenarios) || plan.scenarios.length === 0) {
    throw new Error('Test plan requires a target and at least one scenario')
  }
  const step = recordHarnessStep(
    projectPath,
    run.id,
    'plan',
    'passed',
    { source: 'agent-refinement' },
    plan,
  )
  saveHarnessArtifact(projectPath, run.id, 'testplan', plan, step.id)
}
