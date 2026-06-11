import { z } from 'zod'

export const LocatorStrategySchema = z.enum([
  'testid', 'css', 'xpath', 'text', 'role', 'label', 'placeholder',
])
export type LocatorStrategy = z.infer<typeof LocatorStrategySchema>

export const LocatorSchema = z.object({
  strategy: LocatorStrategySchema,
  value: z.string().min(1),
  priority: z.number().default(0),
})
export type Locator = z.infer<typeof LocatorSchema>

export const ObjectItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  locators: z.array(LocatorSchema).min(1),
})
export type ObjectItem = z.infer<typeof ObjectItemSchema>

export const ObjectRepositorySchema = z.object({
  schemaVersion: z.number().default(1),
  name: z.string().min(1),
  objects: z.array(ObjectItemSchema).default([]),
})
export type ObjectRepository = z.infer<typeof ObjectRepositorySchema>
