import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Boxes,
  Braces,
  CheckCircle2,
  Code2,
  GitBranch,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Route,
} from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type {
  CodeAnalysisArtifact,
  CodeAnalysisArtifactType,
  CodeAnalysisProgress,
  CodeAnalysisReport,
} from '@jkauto/core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn, invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'

const ARTIFACT_ICONS: Record<CodeAnalysisArtifactType, typeof Code2> = {
  'project-summary': Network,
  'route-catalog': Route,
  'ui-catalog': Boxes,
  'symbol-catalog': Braces,
  'runtime-requirements': Play,
  documentation: BookOpen,
}

function formatDate(value?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function AnalysisView({ projectPath }: { projectPath: string }) {
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.path === projectPath),
  )
  const [sourceRef, setSourceRef] = useState(project?.project.repoUrl ?? '')
  const [report, setReport] = useState<CodeAnalysisReport | null>(null)
  const [selectedType, setSelectedType] =
    useState<CodeAnalysisArtifactType>('project-summary')
  const [progress, setProgress] = useState<CodeAnalysisProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    invoke<CodeAnalysisReport | null>(IpcChannels.CODE_ANALYSIS_REPORT, {
      projectPath,
    }).then((nextReport) => {
      if (active) setReport(nextReport)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => {
      active = false
    }
  }, [projectPath])

  useEffect(() => {
    return window.api.on(
      IpcChannels.CODE_ANALYSIS_PROGRESS,
      (value: unknown) => setProgress(value as CodeAnalysisProgress),
    )
  }, [])

  const selectedArtifact = useMemo(
    () =>
      report?.artifacts.find((artifact) => artifact.type === selectedType) ??
      report?.artifacts[0] ??
      null,
    [report, selectedType],
  )

  async function runAnalysis() {
    setRunning(true)
    setError(null)
    setProgress({
      phase: 'source',
      message: 'Preparing analysis...',
      percent: 1,
    })
    try {
      const nextReport = await invoke<CodeAnalysisReport>(
        IpcChannels.CODE_ANALYSIS_START,
        {
          projectPath,
          sourceRef: sourceRef.trim() || undefined,
        },
      )
      setReport(nextReport)
      setSelectedType('project-summary')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <Network className="h-4 w-4 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold">Code Analysis</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            Deterministic AST/code-map artifacts persisted for Agent retrieval.
          </p>
        </div>
        {report ? (
          <Badge
            variant="outline"
            className={cn(
              'gap-1 text-[10px]',
              report.run.status === 'completed' && 'border-emerald-500/40 text-emerald-400',
              report.run.status === 'failed' && 'border-destructive/40 text-destructive',
            )}
          >
            {report.run.status === 'completed' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {report.run.status}
          </Badge>
        ) : null}
      </header>

      <section className="shrink-0 border-b border-border bg-panel/40 px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={sourceRef}
            disabled={running}
            onChange={(event) => setSourceRef(event.target.value)}
            placeholder="Git repository URL or local source path"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            disabled={running || sourceRef.trim().length === 0}
            onClick={runAnalysis}
            className="h-8 shrink-0 text-xs"
          >
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : report ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {report ? 'Refresh' : 'Analyze'}
          </Button>
        </div>
        {running && progress ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{progress.message}</span>
              <span>{progress.percent}%</span>
            </div>
            <Progress value={progress.percent} className="h-1" />
          </div>
        ) : null}
        {error ? (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            {error}
          </div>
        ) : null}
      </section>

      {!report && !running ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Network className="h-10 w-10 text-muted-foreground/25" />
          <div>
            <p className="text-sm font-medium">No analysis artifacts yet</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              Analyze a repository or local source directory to build reusable project context.
              You can also run <code>/analysis refresh</code> from Agent Chat.
            </p>
          </div>
        </div>
      ) : null}

      {report ? (
        <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-r border-border p-2">
            <div className="mb-2 rounded-lg border border-border bg-card/40 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                {report.run.framework ?? 'unknown'}
                <span className="text-muted-foreground">/</span>
                {report.run.language ?? 'unknown'}
              </div>
              <p className="mt-1 truncate text-[10px] text-muted-foreground" title={report.run.sourceRef}>
                {report.run.sourceRef}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Updated {formatDate(report.run.completedAt)}
              </p>
            </div>
            <div className="space-y-1">
              {report.artifacts.map((artifact) => {
                const Icon = ARTIFACT_ICONS[artifact.type]
                return (
                  <button
                    key={artifact.id}
                    type="button"
                    onClick={() => setSelectedType(artifact.type)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
                      selectedArtifact?.id === artifact.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium">
                        {artifact.title}
                      </span>
                      <span className="block text-[9px]">
                        {artifact.itemCount} items · {Math.round(artifact.confidence * 100)}%
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto">
            {selectedArtifact ? (
              <ArtifactDetail artifact={selectedArtifact} />
            ) : null}
          </main>
        </div>
      ) : null}
    </div>
  )
}

function ArtifactDetail({ artifact }: { artifact: CodeAnalysisArtifact }) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{artifact.title}</h2>
          <Badge variant="secondary" className="text-[9px]">
            {artifact.type}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {artifact.summary}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Items" value={artifact.itemCount} />
        <Metric label="Confidence" value={`${Math.round(artifact.confidence * 100)}%`} />
        <Metric label="Sources" value={artifact.sourceRefs.length} />
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Artifact data
        </h3>
        <pre className="overflow-auto rounded-lg border border-border bg-card/50 p-4 text-[11px] leading-5 text-foreground/85">
          {prettyJson(artifact.contentJson)}
        </pre>
      </section>

      {artifact.sourceRefs.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Source references
          </h3>
          <div className="rounded-lg border border-border bg-card/30">
            {artifact.sourceRefs.slice(0, 100).map((source) => (
              <div
                key={source}
                className="border-b border-border/60 px-3 py-1.5 font-mono text-[10px] text-muted-foreground last:border-b-0"
              >
                {source}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}
