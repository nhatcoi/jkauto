import { z } from 'zod'

export const DataFileSchema = z.object({
  schemaVersion: z.number().default(1),
  name: z.string().min(1),
  columns: z.array(z.string()).default([]),
  rows: z.array(z.array(z.string())).default([]),
})
export type DataFile = z.infer<typeof DataFileSchema>
