import { z } from 'zod'

export const AppSettingsSchema = z.object({
  agent: z
    .object({
      baseUrl: z.string().default('http://127.0.0.1:3000/v1'),
      apiKey: z.string().default(''),
      model: z.string().default('v1'),
    })
    .default({}),
  execution: z
    .object({
      headless: z.boolean().default(false),
      browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
      defaultTimeoutMs: z.number().int().min(0).default(30000),
      stepDelayMs: z.number().int().min(0).default(200),
      screenshotOnFail: z.boolean().default(true),
    })
    .default({}),
  appearance: z
    .object({
      theme: z.enum(['dark', 'light', 'system']).default('dark'),
      tableDensity: z.enum(['compact', 'normal', 'relaxed']).default('normal'),
    })
    .default({}),
  explorer: z
    .object({
      featureOrder: z.array(z.string()).default([
        'test-cases',
        'test-suites',
        'object-repository',
        'profiles',
      ]),
      featureAliases: z.record(z.string()).default({
        'test-cases': 'Test Cases',
        'test-suites': 'Test Suites',
        'object-repository': 'API Requests',
        profiles: 'Profiles',
      }),
      fileDisplayName: z.enum(['metadataName', 'fileName']).default('metadataName'),
      openApiImportNameSource: z.enum(['summary', 'operationId', 'methodPath']).default('summary'),
    })
    .default({}),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>
