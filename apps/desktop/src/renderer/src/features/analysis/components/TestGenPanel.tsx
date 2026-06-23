import { useEffect, useState } from 'react'
import { ChevronRight, CheckCircle2, Loader2, AlertCircle, Wand2, Play, Settings2, ChevronDown } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type { CodeAnalysisArtifact, TestgenProgress, TestgenGroup } from '@jkauto/core'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, invoke } from '@/lib/utils'

interface Props {
  projectPath: string
  artifacts: CodeAnalysisArtifact[]
}

type GroupStatus = 'idle' | 'generating' | 'done' | 'error'

type UIGroup = TestgenGroup & { platform: 'web' | 'api' | 'mobile' | 'desktop' }

function buildGroups(artifacts: CodeAnalysisArtifact[]): UIGroup[] {
  const groups: UIGroup[] = []

  const routeArtifact = artifacts.find((a) => a.type === 'route-catalog')
  if (routeArtifact) {
    try {
      const data = JSON.parse(routeArtifact.contentJson) as {
        endpoints?: Array<{ method: string; path: string }>
        pages?: Array<{ route: string }>
      }
      const endpoints = data.endpoints ?? []
      const prefixMap = new Map<string, number>()
      for (const ep of endpoints) {
        const prefix = ep.path.split('/').filter(Boolean)[0] ?? 'root'
        const key = `api-${prefix}`
        prefixMap.set(key, (prefixMap.get(key) ?? 0) + 1)
      }
      for (const [key, count] of prefixMap) {
        groups.push({ id: key, label: `/${key.slice(4)} API`, type: 'endpoints', count, platform: 'api' })
      }

      const pages = data.pages ?? []
      if (pages.length > 0) {
        groups.push({ id: 'ui-pages', label: `UI Pages (${pages.length})`, type: 'endpoints', count: pages.length, platform: 'web' })
      }
    } catch { /* ok */ }
  }

  const entityArtifact = artifacts.find((a) => a.type === 'entity-catalog')
  if (entityArtifact) {
    try {
      const entities = JSON.parse(entityArtifact.contentJson) as Array<{ name: string }>
      for (const e of entities) {
        groups.push({ id: `entity-${e.name.toLowerCase()}`, label: `${e.name} CRUD`, type: 'entity', count: 5, platform: 'api' })
      }
    } catch { /* ok */ }
  }

  return groups
}

export function TestGenPanel({ projectPath, artifacts }: Props) {
  const groups = buildGroups(artifacts)
  const [statuses, setStatuses] = useState<Record<string, GroupStatus>>({})
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [generatingAll, setGeneratingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [vars, setVars] = useState<Record<string, string>>({ baseUrl: '', authToken: '' })

  // Load profile vars on mount
  useEffect(() => {
    invoke<Record<string, string>>(IpcChannels.TESTGEN_GET_PROFILE_VARS, { projectPath })
      .then((v) => setVars((prev) => ({ authToken: '', ...v, ...prev.authToken ? { authToken: prev.authToken } : {} })))
      .catch(() => {/* ok */})
  }, [projectPath])

  function activeVars(): Record<string, string> {
    const out: Record<string, string> = {}
    if (vars.baseUrl) out.baseUrl = vars.baseUrl
    if (vars.authToken) out.authToken = vars.authToken
    return out
  }

  function updateStatus(groupId: string, status: GroupStatus, msg?: string) {
    setStatuses((s) => ({ ...s, [groupId]: status }))
    if (msg) setMessages((m) => ({ ...m, [groupId]: msg }))
  }

  function listenProgress() {
    return window.api.on(IpcChannels.TESTGEN_PROGRESS, (raw: unknown) => {
      const p = raw as TestgenProgress
      if (p.status === 'done') updateStatus(p.groupId, 'done', p.message)
      else if (p.status === 'error') updateStatus(p.groupId, 'error', p.message)
      else updateStatus(p.groupId, 'generating')
    })
  }

  async function generateGroup(groupId: string) {
    updateStatus(groupId, 'generating')
    setError(null)
    const unlisten = listenProgress()
    try {
      await invoke(IpcChannels.TESTGEN_GENERATE, { projectPath, groupIds: [groupId], vars: activeVars() })
    } catch (e) {
      updateStatus(groupId, 'error', e instanceof Error ? e.message : String(e))
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      unlisten()
    }
  }

  async function generateAll() {
    if (groups.length === 0) return
    setGeneratingAll(true)
    setError(null)
    groups.forEach((g) => updateStatus(g.id, 'generating'))
    const unlisten = listenProgress()
    try {
      await invoke(IpcChannels.TESTGEN_GENERATE, { projectPath, vars: activeVars() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGeneratingAll(false)
      unlisten()
    }
  }

  const anyGenerating = generatingAll || Object.values(statuses).some((s) => s === 'generating')

  if (groups.length === 0) return null

  return (
    <div className="border-t border-border px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Generate Tests
          </span>
          <Badge variant="outline" className="px-1.5 py-0 text-[9px]">{groups.length} groups</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setConfigOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors',
              configOpen
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                : 'border-border/60 text-muted-foreground hover:border-violet-500/30 hover:text-violet-400',
            )}
          >
            <Settings2 className="h-3 w-3" />
            Config
            <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', configOpen && 'rotate-180')} />
          </button>
          <Button size="sm" variant="outline" disabled={anyGenerating} onClick={generateAll} className="h-7 gap-1.5 text-[11px]">
            {anyGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Generate All
          </Button>
        </div>
      </div>

      {/* Config panel */}
      {configOpen && (
        <div className="mb-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
          <p className="text-[10px] font-medium text-violet-400 uppercase tracking-wide">Test config — overrides profile defaults</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Base URL</label>
              <input
                value={vars.baseUrl ?? ''}
                onChange={(e) => setVars((v) => ({ ...v, baseUrl: e.target.value }))}
                placeholder="http://localhost:3000"
                className="rounded border border-border bg-muted/40 px-2 py-1 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-violet-500/60 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Auth Token (Bearer)</label>
              <input
                value={vars.authToken ?? ''}
                onChange={(e) => setVars((v) => ({ ...v, authToken: e.target.value }))}
                placeholder="eyJhbGc... (optional)"
                className="rounded border border-border bg-muted/40 px-2 py-1 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-violet-500/60 focus:outline-none"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            These values are injected into the AI prompt — use correct server URL and a valid token to generate realistic tests.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </div>
      )}

      <div className="space-y-1.5">
        {groups.map((group) => {
          const status = statuses[group.id] ?? 'idle'
          const msg = messages[group.id]
          const isGenerating = status === 'generating'

          return (
            <div
              key={group.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border bg-card/40 px-3 py-2',
                status === 'done' && 'border-emerald-500/30 bg-emerald-500/5',
                status === 'error' && 'border-destructive/30 bg-destructive/5',
                status === 'idle' && 'border-border/60',
                isGenerating && 'border-violet-500/30 bg-violet-500/5',
              )}
            >
              {/* platform badge */}
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 px-1.5 py-0 text-[9px] font-mono',
                  (group as UIGroup).platform === 'api' && 'border-blue-500/40 text-blue-400',
                  (group as UIGroup).platform === 'web' && 'border-violet-500/40 text-violet-400',
                  (group as UIGroup).platform === 'mobile' && 'border-amber-500/40 text-amber-400',
                  (group as UIGroup).platform === 'desktop' && 'border-cyan-500/40 text-cyan-400',
                )}
              >
                {(group as UIGroup).platform}
              </Badge>

              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{group.label}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{group.count} items</span>

              {/* status */}
              {status === 'done' && (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              )}
              {status === 'error' && (
                <span title={msg}><AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" /></span>
              )}
              {isGenerating && (
                <div className="flex items-center gap-1 text-[10px] text-violet-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="hidden sm:inline">generating…</span>
                </div>
              )}

              {status !== 'generating' && (
                <button
                  type="button"
                  disabled={anyGenerating}
                  onClick={() => generateGroup(group.id)}
                  className={cn(
                    'flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors',
                    'border-border/60 text-muted-foreground hover:border-violet-500/40 hover:text-violet-400',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    status === 'done' && 'border-emerald-500/30 text-emerald-400 hover:border-emerald-400',
                  )}
                >
                  {status === 'done' ? (
                    <><CheckCircle2 className="h-3 w-3" /> Regen</>
                  ) : (
                    <><ChevronRight className="h-3 w-3" /> Generate</>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-2.5 text-[10px] text-muted-foreground">
        Saves both <code className="text-violet-400">.spec.ts</code> (Playwright) and{' '}
        <code className="text-emerald-400">.test.yaml</code> (JKAuto) in{' '}
        <code>test-cases/generated/</code>
      </p>
    </div>
  )
}
