import { useState } from 'react'
import { ArrowRight, Check, X, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { readEnv, writeEnv } from '@/features/env/api'
import type { HttpResponse } from '../types'
import type { RequestHistoryRecord } from '@jkauto/core'

interface Props {
  response: HttpResponse | null
  sendError: string
  sending: boolean
  history: RequestHistoryRecord[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

function statusVariant(status: number): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'warning'
  if (status >= 400) return 'destructive'
  return 'secondary'
}

function tryFormatJson(raw: string): { formatted: string; isJson: boolean } {
  try {
    return { formatted: JSON.stringify(JSON.parse(raw), null, 2), isJson: true }
  } catch {
    return { formatted: raw, isJson: false }
  }
}

function extractJsonPath(body: string, dotPath: string): string {
  try {
    const parsed = JSON.parse(body)
    const parts = dotPath.replace(/^\$\.?/, '').split('.').filter(Boolean)
    let val: unknown = parsed
    for (const part of parts) {
      if (val == null || typeof val !== 'object') return ''
      val = (val as Record<string, unknown>)[part]
    }
    return val === undefined || val === null ? '' : String(val)
  } catch {
    return ''
  }
}

function SaveToEnvPanel({ body }: { body: string }) {
  const { activeProject } = useProjectStore()
  const [jsonPath, setJsonPath] = useState('')
  const [varName, setVarName] = useState('')
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const extracted = jsonPath.trim() ? extractJsonPath(body, jsonPath.trim()) : ''

  const handleSave = async () => {
    if (!activeProject || !varName.trim() || !extracted) return
    setErr('')
    try {
      const profilePath = `${activeProject.path}/profiles/${activeProject.activeProfile}.env.json`
      const vars = await readEnv(profilePath).catch(() => ({} as Record<string, string>))
      await writeEnv(profilePath, { ...vars, [varName.trim()]: extracted })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <div className="border-t border-border bg-muted/10 px-3 py-2 flex flex-col gap-1.5 shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">Path</span>
          <input
            value={jsonPath}
            onChange={(e) => { setJsonPath(e.target.value); setSaved(false) }}
            placeholder="data.token"
            className="flex-1 bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:border-primary outline-none font-mono min-w-0"
          />
        </div>
        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">Var</span>
          <input
            value={varName}
            onChange={(e) => { setVarName(e.target.value); setSaved(false) }}
            placeholder="authToken"
            className="flex-1 bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:border-primary outline-none font-mono min-w-0"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!extracted || !varName.trim() || !activeProject}
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors shrink-0',
            saved
              ? 'bg-green-500/20 text-green-400'
              : 'bg-primary/90 hover:bg-primary text-primary-foreground disabled:opacity-40',
          )}
        >
          {saved ? <Check className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {extracted && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">Preview:</span>
          <span className="font-mono text-foreground/80 truncate max-w-xs">{extracted}</span>
        </div>
      )}
      {err && <p className="text-[11px] text-destructive">{err}</p>}
    </div>
  )
}

function ResponseBodyView({ response }: { response: HttpResponse }) {
  const [showEnv, setShowEnv] = useState(false)
  const [copied, setCopied] = useState(false)
  const { formatted, isJson } = tryFormatJson(response.body)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-1 border-b border-border shrink-0">
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {isJson && (
          <button
            type="button"
            onClick={() => setShowEnv((v) => !v)}
            className={cn(
              'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors',
              showEnv
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            {showEnv ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            {showEnv ? 'Close' : '→ ENV'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <pre className={cn(
          'text-xs leading-5 p-3 whitespace-pre-wrap break-words',
          isJson ? 'text-foreground/90 font-mono' : 'text-foreground/80 font-mono',
        )}>
          {formatted || <span className="text-muted-foreground/50">(empty body)</span>}
        </pre>
      </div>
      {showEnv && isJson && <SaveToEnvPanel body={response.body} />}
    </div>
  )
}

function HistoryTab({ history }: { history: RequestHistoryRecord[] }) {
  const [selected, setSelected] = useState<RequestHistoryRecord | null>(null)

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
        No history yet — send a request to record it
      </div>
    )
  }

  if (selected) {
    const { formatted, isJson } = tryFormatJson(selected.body)
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← History
          </button>
          <Badge variant={statusVariant(selected.status)} className="text-[10px]">
            {selected.status} {selected.statusText}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{selected.durationMs}ms</span>
          <span className="text-[10px] text-muted-foreground truncate flex-1">{formatTime(selected.requestedAt)}</span>
        </div>
        <div className="flex-1 overflow-auto">
          <pre className="text-xs leading-5 p-3 whitespace-pre-wrap break-words font-mono text-foreground/90">
            {formatted || <span className="text-muted-foreground/50">(empty body)</span>}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full">
      {history.map((rec) => (
        <button
          key={rec.id}
          type="button"
          onClick={() => setSelected(rec)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/40 border-b border-border/30 transition-colors"
        >
          <Badge variant={statusVariant(rec.status)} className="text-[10px] shrink-0 w-14 justify-center">
            {rec.status}
          </Badge>
          <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-10">{rec.method}</span>
          <span className="text-[11px] text-muted-foreground flex-1 truncate">{formatTime(rec.requestedAt)}</span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0">{rec.durationMs}ms</span>
        </button>
      ))}
    </div>
  )
}

export function ResponsePanel({ response, sendError, sending, history }: Props) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'history'>('body')

  if (sending) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Sending request…
      </div>
    )
  }

  if (sendError) {
    return (
      <div className="p-4 text-xs text-destructive font-mono">
        <span className="font-semibold">Error: </span>{sendError}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* status bar — only when response exists */}
      {response && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border shrink-0 bg-muted/20">
          <Badge variant={statusVariant(response.status)}>
            {response.status} {response.statusText}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{response.durationMs}ms</span>
          <span className="text-[10px] text-muted-foreground">{formatSize(response.size)}</span>
        </div>
      )}

      {/* tab bar */}
      <div className="flex gap-0 border-b border-border shrink-0">
        {(['body', 'headers', 'history'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 h-7 text-xs transition-colors capitalize',
              activeTab === tab
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
            {tab === 'headers' && response && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                ({Object.keys(response.headers).length})
              </span>
            )}
            {tab === 'history' && history.length > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">({history.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          response
            ? <ResponseBodyView response={response} />
            : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
                Send a request to see the response
              </div>
            )
        )}

        {activeTab === 'headers' && (
          response
            ? (
              <div className="overflow-auto h-full p-3 flex flex-col gap-1">
                {Object.entries(response.headers).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[200px_1fr] gap-2 text-xs">
                    <span className="text-muted-foreground truncate font-medium">{k}</span>
                    <span className="text-foreground/80 font-mono break-all">{v}</span>
                  </div>
                ))}
              </div>
            )
            : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
                Send a request to see headers
              </div>
            )
        )}

        {activeTab === 'history' && <HistoryTab history={history} />}
      </div>
    </div>
  )
}
