export type {
  ApiRequest,
  HttpMethod,
  KeyValueItem,
  AuthConfig,
  BodyConfig,
  Assertion,
  ObjectRepository,
  ObjectItem,
  Locator,
  LocatorStrategy,
} from '@jkauto/core'

export type {
  HttpResponse,
} from '@jkauto/core'

export interface AssertionResult {
  id: string
  passed: boolean
  message: string
}
