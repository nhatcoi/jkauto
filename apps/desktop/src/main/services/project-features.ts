export interface ProjectFeature {
  key: string
  name: string
}

export const PROJECT_FEATURES: readonly ProjectFeature[] = [
  { key: 'test-cases', name: 'Test Cases' },
  { key: 'test-suites', name: 'Test Suites' },
  { key: 'profiles', name: 'Profiles' },
  { key: 'api-request', name: 'API Requests' },
  { key: 'data-files', name: 'Data Files' },
  { key: 'keywords', name: 'Keywords' },
  { key: 'plugins', name: 'Plugins' },
  { key: 'reports', name: 'Reports' },
]

export const PROJECT_INTERNAL_DIRS = ['.autotest'] as const

export const PROJECT_STRUCTURE: ReadonlyArray<{ key: string; name?: string }> =
  [...PROJECT_FEATURES, ...PROJECT_INTERNAL_DIRS.map((key) => ({ key }))]
