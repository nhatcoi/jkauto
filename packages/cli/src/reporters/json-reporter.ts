import type { RunReport } from './types.js'

export function toJsonReport(report: RunReport): string {
  return JSON.stringify(report, null, 2)
}
