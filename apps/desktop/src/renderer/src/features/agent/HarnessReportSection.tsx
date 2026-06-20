import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  GitBranch,
  XCircle,
} from 'lucide-react'
import type { HarnessReport } from '@jkauto/core'

const STATE_LABELS: Record<string, string> = {
  discover: 'Code graph',
  plan: 'Test plan',
  execute: 'Execute',
  verify: 'Verify',
  repair: 'Repair',
  compile: 'Compile',
  validate_schema: 'Schema',
  run_generated_test: 'Runtime',
  save: 'Save',
  complete: 'Complete',
  failed: 'Failed',
}

export function HarnessReportSection({
  report,
}: {
  report: HarnessReport | null
}) {
  if (!report) return null

  const passed = report.run.status === 'passed'
  const failed = report.run.status === 'failed'
  const Icon = passed ? CheckCircle2 : failed ? XCircle : CircleDashed

  return (
    <details className="mx-auto mb-4 w-full max-w-3xl rounded-lg border border-border/70 bg-secondary/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px]">
        <Icon
          className={`h-3.5 w-3.5 ${
            passed
              ? 'text-emerald-400'
              : failed
                ? 'text-red-400'
                : 'animate-spin text-amber-400'
          }`}
        />
        <span className="font-medium">Harness report</span>
        <span className="truncate text-muted-foreground">
          {STATE_LABELS[report.run.state] ?? report.run.state}
        </span>
        <span className="ml-auto text-[9px] text-muted-foreground">
          {report.summary.passedSteps}/{report.summary.totalSteps} passed
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </summary>

      <div className="border-t border-border/60 px-3 py-2">
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
          <span>{report.summary.toolEvidenceCount} evidence</span>
          <span>{report.summary.repairCount} repairs</span>
          <span>{Math.round(report.summary.durationMs / 1000)}s</span>
          {report.run.codeIndexId ? (
            <span className="flex items-center gap-1">
              <GitBranch className="h-2.5 w-2.5" />
              indexed
            </span>
          ) : null}
        </div>

        <div className="space-y-1">
          {report.steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-2 text-[10px] text-muted-foreground"
            >
              {step.status === 'passed' ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400/80" />
              ) : step.status === 'failed' ? (
                <XCircle className="h-3 w-3 text-red-400/80" />
              ) : (
                <CircleDashed className="h-3 w-3 text-amber-400/80" />
              )}
              <span>{STATE_LABELS[step.state] ?? step.state}</span>
              {step.error ? (
                <span className="truncate text-red-300/80">{step.error}</span>
              ) : null}
            </div>
          ))}
        </div>

        {report.run.generatedTestPath ? (
          <div className="mt-2 truncate border-t border-border/50 pt-2 text-[9px] text-muted-foreground">
            {report.run.generatedTestPath}
          </div>
        ) : null}
      </div>
    </details>
  )
}
