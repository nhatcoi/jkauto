import type { Platform } from '@jkauto/core'
import type { EngineAdapter } from './types'
import { WebAdapter } from './web-adapter'
import { MobileAdapter } from './mobile-adapter'
import { DesktopAdapter } from './desktop-adapter'
import { ApiAdapter } from './api-adapter'

const factories: Record<Platform, () => EngineAdapter> = {
  web: () => new WebAdapter(),
  mobile: () => new MobileAdapter(),
  desktop: () => new DesktopAdapter(),
  api: () => new ApiAdapter(),
}

export function getAdapter(platform: Platform): EngineAdapter {
  return factories[platform]()
}

export function hasAdapter(platform: Platform): boolean {
  return Boolean(factories[platform])
}

export function supportedPlatforms(): Platform[] {
  return Object.keys(factories) as Platform[]
}
