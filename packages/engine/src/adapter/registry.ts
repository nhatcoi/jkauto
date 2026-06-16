import type { EngineAdapter } from './types'
import { WebAdapter } from './web-adapter'
import { DesktopAdapter } from './desktop-adapter'
import { ApiAdapter } from './api-adapter'
import { AppiumAdapter } from './appium-adapter'
import { MaestroAdapter } from './maestro-adapter'

// Internal adapter keys — 'mobile' resolves to maestro|appium via TestCase.mobileEngine.
type AdapterKey = 'web' | 'desktop' | 'api' | 'appium' | 'maestro'

const factories: Record<AdapterKey, () => EngineAdapter> = {
  web: () => new WebAdapter(),
  desktop: () => new DesktopAdapter(),
  api: () => new ApiAdapter(),
  appium: () => new AppiumAdapter(),
  maestro: () => new MaestroAdapter(),
}

export function getAdapter(key: AdapterKey): EngineAdapter {
  const factory = factories[key]
  if (!factory) throw new Error(`No adapter registered for: ${key}`)
  return factory()
}

export function hasAdapter(key: AdapterKey): boolean {
  return Boolean(factories[key])
}

export function supportedPlatforms(): AdapterKey[] {
  return Object.keys(factories) as AdapterKey[]
}
