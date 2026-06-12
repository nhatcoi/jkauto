import type { Profile, Step } from '@jkauto/core'
import { getKeyword } from '../keywords/registry'
import type { EngineAdapter, ExecutionHelpers, AdapterStartOptions } from './types'
import type { AppiumDriver } from '../keywords/types'

export class AppiumAdapter implements EngineAdapter<AppiumDriver> {
  readonly platform = 'appium' as const

  async start(profile: Profile, options: AdapterStartOptions): Promise<AppiumDriver> {
    // Lazy-load webdriverio — only pulled in when appium platform is actually used.
    const { remote } = await import('webdriverio')

    const host = profile.variables['APPIUM_HOST'] ?? 'localhost'
    const port = parseInt(profile.variables['APPIUM_PORT'] ?? '4723', 10)
    const appPath = options.appPath ?? profile.variables['APP_PATH']
    const deviceName = options.device ?? profile.variables['APPIUM_DEVICE']
    const isAndroid = deviceName?.toLowerCase().includes('android') ?? false

    return remote({
      hostname: host,
      port,
      logLevel: 'warn',
      capabilities: {
        platformName: isAndroid ? 'Android' : 'iOS',
        'appium:automationName': isAndroid ? 'UiAutomator2' : 'XCUITest',
        ...(appPath ? { 'appium:app': appPath } : {}),
        ...(deviceName ? { 'appium:deviceName': deviceName } : {}),
      },
    }) as Promise<AppiumDriver>
  }

  async execute(session: AppiumDriver, step: Step, helpers: ExecutionHelpers): Promise<void> {
    const keyword = getKeyword(step.keyword)
    if (!keyword) throw new Error(`Unknown keyword: ${step.keyword}`)
    const executor = keyword.executors.appium
    if (!executor) throw new Error(`Keyword "${step.keyword}" not supported on appium`)
    await executor({
      driver: session,
      objectRef: step.objectRef ?? '',
      input: step.input ?? '',
      expected: step.expected ?? '',
      resolveLocator: helpers.resolveLocator,
      interpolate: helpers.interpolate,
    })
  }

  async stop(session: AppiumDriver): Promise<void> {
    await session.deleteSession()
  }
}
