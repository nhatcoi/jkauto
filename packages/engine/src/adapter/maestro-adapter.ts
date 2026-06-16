import type { Profile, Step } from '@jkauto/core'
import type { EngineAdapter, ExecutionHelpers, AdapterStartOptions } from './types'

// Maestro is a YAML-flow CLI tool — it doesn't use step-by-step WebDriver sessions.
// Full integration: generate a .yaml flow from steps and spawn `maestro test <flow.yaml>`.
// This stub satisfies the EngineAdapter contract so the platform is registered.
export interface MaestroSession {
  appId: string
}

export class MaestroAdapter implements EngineAdapter<MaestroSession> {
  readonly platform = 'maestro' as const

  async start(_profile: Profile, options: AdapterStartOptions): Promise<MaestroSession> {
    const appId = options.appPath ?? _profile.variables['APP_ID'] ?? ''
    return { appId }
  }

  async execute(_session: MaestroSession, step: Step, _helpers: ExecutionHelpers): Promise<void> {
    // Maestro executes whole YAML flows, not individual steps.
    // Future: accumulate steps → write temp .yaml → spawn `maestro test`.
    throw new Error(
      `Maestro adapter: keyword "${step.keyword}" cannot run step-by-step. ` +
      'Use the Maestro CLI panel or export to a Maestro flow YAML.',
    )
  }

  async stop(_session: MaestroSession): Promise<void> {
    // No persistent session to close.
  }
}
