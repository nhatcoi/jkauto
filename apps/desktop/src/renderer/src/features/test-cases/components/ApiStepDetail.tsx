import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { KeywordMeta } from '@jkauto/core'
import type { TestStep } from '../types'

// ── helpers ────────────────────────────────────────────────────────────────────

interface ApiResponseMeta {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
}

function isApiResponseMeta(v: unknown): v is ApiResponseMeta {
  return v !== null && typeof v === 'object' && 'status' in (v as object) && 'body' in (v as object)
}

function tryPrettyJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
}

function statusColor(code: number): string {
  if (code < 300) return 'text-green-400'
  if (code < 400) return 'text-yellow-400'
  return 'text-red-400'
}

// ── field primitives ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, placeholder, onChange, mono }: {
  value: string; placeholder?: string; onChange: (v: string) => void; mono?: boolean
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full text-xs bg-input text-foreground px-2 py-1.5 rounded border border-border',
        'focus:border-primary outline-none placeholder:text-muted-foreground/40 transition-colors',
        mono && 'font-mono',
      )}
    />
  )
}

function TextArea({ value, placeholder, onChange, rows = 5 }: {
  value: string; placeholder?: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full text-xs bg-input text-foreground px-2 py-1.5 rounded border border-border font-mono',
        'focus:border-primary outline-none placeholder:text-muted-foreground/40 transition-colors resize-none',
      )}
    />
  )
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function MethodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value || 'GET'}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs bg-input text-foreground px-2 py-1.5 rounded border border-border focus:border-primary outline-none w-28 font-semibold"
    >
      {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  )
}

// ── keyword-specific forms ─────────────────────────────────────────────────────

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function HttpRequestForm({ step, onChange }: { step: TestStep; onChange: (p: Partial<TestStep>) => void }) {
  const method = (step.objectRef || 'GET').toUpperCase()
  // Body field shows for the legacy body keyword, or whenever the method can
  // carry a body. GET/HEAD hide it to avoid sending an unexpected payload.
  const showBody = step.keyword === 'http-request-body' || BODY_METHODS.has(method)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-end">
        <div className="shrink-0">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Method</label>
          <MethodSelect value={step.objectRef} onChange={(v) => onChange({ objectRef: v })} />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">URL / Path</label>
          <TextInput value={step.input} placeholder="/api/resource" onChange={(v) => onChange({ input: v })} mono />
        </div>
      </div>
      {showBody && (
        <Field label="Request Body (JSON)">
          <TextArea value={step.expected} placeholder={'{\n  "key": "value"\n}'} onChange={(v) => onChange({ expected: v })} rows={6} />
        </Field>
      )}
    </div>
  )
}

function KeyValueForm({ step, onChange, labelA, labelB, placeholderA, placeholderB, fieldA, fieldB }: {
  step: TestStep
  onChange: (p: Partial<TestStep>) => void
  labelA: string; labelB: string
  placeholderA?: string; placeholderB?: string
  fieldA: keyof TestStep; fieldB: keyof TestStep
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={labelA}>
        <TextInput value={String(step[fieldA] ?? '')} placeholder={placeholderA} onChange={(v) => onChange({ [fieldA]: v })} mono />
      </Field>
      <Field label={labelB}>
        <TextInput value={String(step[fieldB] ?? '')} placeholder={placeholderB} onChange={(v) => onChange({ [fieldB]: v })} mono />
      </Field>
    </div>
  )
}

function SingleFieldForm({ step, onChange, label, placeholder, field }: {
  step: TestStep; onChange: (p: Partial<TestStep>) => void
  label: string; placeholder?: string; field: keyof TestStep
}) {
  return (
    <Field label={label}>
      <TextInput value={String(step[field] ?? '')} placeholder={placeholder} onChange={(v) => onChange({ [field]: v })} mono />
    </Field>
  )
}

// ── save-to-profile batch form ─────────────────────────────────────────────────

interface SaveMapping { from: string; to: string }

interface BatchConfig { type: string; mappings: SaveMapping[] }

function parseBatchConfig(expected: string): BatchConfig | null {
  if (!expected?.trim().startsWith('{')) return null
  try {
    const c = JSON.parse(expected) as { type?: string; mappings?: { from: string; to?: string }[] }
    return { type: c.type ?? 'variables', mappings: (c.mappings ?? []).map((m) => ({ from: m.from, to: m.to ?? '' })) }
  } catch { return null }
}

function writeBatchConfig(type: string, mappings: SaveMapping[]): string {
  return JSON.stringify({ type, mappings: mappings.map((m) => ({ from: m.from, ...(m.to ? { to: m.to } : {}) })) })
}

const API_CONFIG_KEYS = ['baseUrl', 'auth.bearer.token', 'auth.basic.username', 'auth.basic.password', 'auth.api-key.key']

function SaveToProfileForm({ step, onChange }: { step: TestStep; onChange: (p: Partial<TestStep>) => void }) {
  const config: BatchConfig = useMemo(() => {
    const batch = parseBatchConfig(step.expected)
    if (batch) return batch
    return { type: 'variables', mappings: [{ from: step.objectRef || '', to: step.input || '' }] }
  }, [step.expected, step.objectRef, step.input])

  const { type, mappings } = config

  const update = (newType: string, newMappings: SaveMapping[]) => {
    onChange({ expected: writeBatchConfig(newType, newMappings), objectRef: '', input: '' })
  }

  const setType = (t: string) => update(t, mappings.map((m) => ({ from: m.from, to: '' })))
  const setMapping = (idx: number, field: 'from' | 'to', val: string) =>
    update(type, mappings.map((m, i) => (i === idx ? { ...m, [field]: val } : m)))
  const addMapping = () => update(type, [...mappings, { from: '', to: '' }])
  const removeMapping = (idx: number) => update(type, mappings.filter((_, i) => i !== idx))

  return (
    <div className="flex flex-col gap-3">
      <Field label="Save To">
        <div className="flex gap-1">
          {(['variables', 'api-config'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'text-xs px-2.5 py-1 rounded border transition-colors',
                type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-input text-muted-foreground border-border hover:border-primary/60',
              )}
            >
              {t === 'variables' ? 'Env Variables' : 'API Config'}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Session Variable</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {type === 'api-config' ? 'API Config Key' : 'Profile Key (optional)'}
          </span>
          <span className="w-5" />
        </div>
        {mappings.map((m, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <TextInput value={m.from} placeholder="accessToken" onChange={(v) => setMapping(idx, 'from', v)} mono />
            {type === 'api-config' ? (
              <select
                value={m.to}
                onChange={(e) => setMapping(idx, 'to', e.target.value)}
                className="text-xs bg-input text-foreground px-2 py-1.5 rounded border border-border focus:border-primary outline-none font-mono"
              >
                <option value="">— select key —</option>
                {API_CONFIG_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            ) : (
              <TextInput value={m.to} placeholder={m.from || 'same as variable name'} onChange={(v) => setMapping(idx, 'to', v)} mono />
            )}
            <button
              type="button"
              onClick={() => removeMapping(idx)}
              disabled={mappings.length === 1}
              className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors rounded disabled:opacity-30 text-sm"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addMapping}
          className="text-xs text-primary hover:text-primary/80 text-left mt-0.5 transition-colors"
        >
          + Add variable
        </button>
      </div>
    </div>
  )
}

function StepForm({ step, onChange }: { step: TestStep; onChange: (p: Partial<TestStep>) => void }) {
  const { keyword } = step
  if (keyword === 'http-request' || keyword === 'http-request-body') {
    return <HttpRequestForm step={step} onChange={onChange} />
  }
  if (keyword === 'set-base-url') {
    return <SingleFieldForm step={step} onChange={onChange} label="Base URL" placeholder="https://api.example.com" field="input" />
  }
  if (keyword === 'set-request-header') {
    return <KeyValueForm step={step} onChange={onChange} labelA="Header Name" labelB="Value" placeholderA="Content-Type" placeholderB="application/json" fieldA="objectRef" fieldB="input" />
  }
  if (keyword === 'set-auth-bearer') {
    return <SingleFieldForm step={step} onChange={onChange} label="Token" placeholder="{{accessToken}}" field="input" />
  }
  if (keyword === 'set-auth-basic') {
    return <KeyValueForm step={step} onChange={onChange} labelA="Username" labelB="Password" placeholderA="admin" placeholderB="secret" fieldA="objectRef" fieldB="input" />
  }
  if (keyword === 'assert-status-code') {
    return <SingleFieldForm step={step} onChange={onChange} label="Expected Status" placeholder="200" field="expected" />
  }
  if (keyword === 'assert-response-contains') {
    return <SingleFieldForm step={step} onChange={onChange} label="Expected Substring" placeholder="success" field="expected" />
  }
  if (keyword === 'assert-json-path') {
    return <KeyValueForm step={step} onChange={onChange} labelA="JSON Path" labelB="Expected Value" placeholderA="data.id" placeholderB="42" fieldA="objectRef" fieldB="expected" />
  }
  if (keyword === 'extract-body') {
    return <KeyValueForm step={step} onChange={onChange} labelA="JSON Path" labelB="Variable Name" placeholderA="$.data.token" placeholderB="accessToken" fieldA="objectRef" fieldB="input" />
  }
  if (keyword === 'assert-header') {
    return <KeyValueForm step={step} onChange={onChange} labelA="Header Name" labelB="Expected Value" placeholderA="content-type" placeholderB="application/json" fieldA="objectRef" fieldB="expected" />
  }
  if (keyword === 'assert-status-range') {
    return <SingleFieldForm step={step} onChange={onChange} label="Status Range (min-max)" placeholder="200-299" field="input" />
  }
  if (keyword === 'assert-response-time') {
    return <SingleFieldForm step={step} onChange={onChange} label="Max Response Time (ms)" placeholder="2000" field="expected" />
  }
  if (keyword === 'set-variable') {
    return (
      <div className="flex flex-col gap-3">
        <SingleFieldForm step={step} onChange={onChange} label="Variable Name" placeholder="accessToken" field="objectRef" />
        <KeyValueForm step={step} onChange={onChange} labelA="Literal Value" labelB="OR Extract Path (from last response)" placeholderA="value or {{other}}" placeholderB="accessToken" fieldA="input" fieldB="expected" />
      </div>
    )
  }
  if (keyword === 'save-to-profile') {
    return <SaveToProfileForm step={step} onChange={onChange} />
  }
  return (
    <p className="text-xs text-muted-foreground/50 italic">No configuration needed for this step.</p>
  )
}

// ── response viewer ────────────────────────────────────────────────────────────

function ResponseViewer({ meta }: { meta: ApiResponseMeta }) {
  const body = tryPrettyJson(meta.body)
  const contentType = meta.headers['content-type'] ?? ''
  const isJson = contentType.includes('json')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={cn('text-sm font-bold font-mono', statusColor(meta.status))}>
          {meta.status} {meta.statusText}
        </span>
        <span className="text-xs text-muted-foreground">{meta.durationMs}ms</span>
        {contentType && (
          <span className="text-[10px] text-muted-foreground/60 font-mono">{contentType}</span>
        )}
      </div>

      {meta.body && (
        <div className="relative">
          <pre className={cn(
            'text-[11px] bg-muted/30 border border-border rounded p-2 overflow-auto max-h-48 leading-relaxed',
            isJson ? 'text-green-300/80' : 'text-foreground/70',
            'font-mono',
          )}>
            {body}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── failure diff ──────────────────────────────────────────────────────────────

type DiffResult =
  | { type: 'status'; expected: string; actual: string }
  | { type: 'value'; path: string; expected: string; actual: string }
  | { type: 'missing'; path: string }
  | { type: 'contains'; needle: string; body: string }
  | { type: 'header'; header: string; expected: string; actual: string }
  | { type: 'generic'; message: string }

function parseFailureMessage(msg: string, responseMeta: ApiResponseMeta | null): DiffResult {
  let m: RegExpMatchArray | null

  m = msg.match(/^Expected status (\d+) but got (\d+)/)
  if (m) return { type: 'status', expected: m[1], actual: m[2] }

  m = msg.match(/^Expected "(.+)" at path "(.+)" but got "(.+)"$/)
  if (m) return { type: 'value', expected: m[1], path: m[2], actual: m[3] }

  m = msg.match(/^Expected a value at path "(.+)" but it was missing or empty$/)
  if (m) return { type: 'missing', path: m[1] }

  m = msg.match(/^Expected body to contain "(.+)"$/)
  if (m) return { type: 'contains', needle: m[1], body: responseMeta ? tryPrettyJson(responseMeta.body) : '' }

  m = msg.match(/^Expected header "(.+)" to contain "(.+)" but got "(.+)"$/)
  if (m) return { type: 'header', header: m[1], expected: m[2], actual: m[3] }

  return { type: 'generic', message: msg }
}

function DiffBox({ label, value, variant }: { label: string; value: string; variant: 'expected' | 'actual' | 'neutral' }) {
  const colors = {
    expected: 'border-green-500/30 bg-green-500/8 text-green-300',
    actual: 'border-red-500/30 bg-red-500/8 text-red-300',
    neutral: 'border-border bg-muted/20 text-foreground/70',
  }
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <pre className={cn('text-[11px] font-mono px-2 py-1.5 rounded border leading-relaxed whitespace-pre-wrap break-all', colors[variant])}>
        {value || <span className="italic opacity-50">empty</span>}
      </pre>
    </div>
  )
}

function HighlightedBody({ body, needle }: { body: string; needle: string }) {
  if (!body || !needle) return <pre className="text-[11px] font-mono text-foreground/70 bg-muted/20 border border-border rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-36 overflow-auto">{body || '(empty)'}</pre>
  const idx = body.indexOf(needle)
  if (idx === -1) return <pre className="text-[11px] font-mono text-foreground/70 bg-muted/20 border border-border rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-36 overflow-auto">{body}</pre>
  return (
    <pre className="text-[11px] font-mono text-foreground/70 bg-muted/20 border border-border rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-36 overflow-auto">
      {body.slice(0, idx)}
      <mark className="bg-red-500/30 text-red-300 rounded-sm not-italic">{needle}</mark>
      {body.slice(idx + needle.length)}
    </pre>
  )
}

function FailureDiff({ message, responseMeta }: { message: string; responseMeta: ApiResponseMeta | null }) {
  const diff = parseFailureMessage(message, responseMeta)

  return (
    <div className="flex flex-col gap-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2.5">
      <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Assertion Failed</span>

      {diff.type === 'status' && (
        <div className="flex gap-2">
          <DiffBox label="Expected Status" value={diff.expected} variant="expected" />
          <DiffBox label="Actual Status" value={`${diff.actual}${responseMeta ? ` ${responseMeta.statusText}` : ''}`} variant="actual" />
        </div>
      )}

      {diff.type === 'value' && (
        <>
          <span className="text-[10px] text-muted-foreground font-mono">path: <span className="text-amber-400">{diff.path}</span></span>
          <div className="flex gap-2">
            <DiffBox label="Expected" value={diff.expected} variant="expected" />
            <DiffBox label="Actual" value={diff.actual} variant="actual" />
          </div>
        </>
      )}

      {diff.type === 'missing' && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">Path <span className="font-mono text-amber-400">{diff.path}</span> was missing or empty in response</span>
          {responseMeta && (
            <pre className="text-[11px] font-mono text-red-300/80 bg-red-500/8 border border-red-500/20 rounded px-2 py-1.5 whitespace-pre-wrap break-all max-h-36 overflow-auto">
              {tryPrettyJson(responseMeta.body)}
            </pre>
          )}
        </div>
      )}

      {diff.type === 'contains' && (
        <>
          <span className="text-[10px] text-muted-foreground">Body does not contain: <span className="font-mono text-green-400">"{diff.needle}"</span></span>
          <HighlightedBody body={diff.body} needle={diff.needle} />
        </>
      )}

      {diff.type === 'header' && (
        <>
          <span className="text-[10px] text-muted-foreground font-mono">header: <span className="text-amber-400">{diff.header}</span></span>
          <div className="flex gap-2">
            <DiffBox label="Expected" value={diff.expected} variant="expected" />
            <DiffBox label="Actual" value={diff.actual} variant="actual" />
          </div>
        </>
      )}

      {diff.type === 'generic' && (
        <p className="text-[11px] font-mono text-red-400 whitespace-pre-wrap">{diff.message}</p>
      )}
    </div>
  )
}

// ── main ───────────────────────────────────────────────────────────────────────

interface Props {
  step: TestStep
  stepIndex: number
  keywords: KeywordMeta[]
  stepMessage?: string
  stepMeta?: unknown  // last available response from any prior http step
  onChange: (patch: Partial<TestStep>) => void
}

export function ApiStepDetail({ step, stepIndex, keywords, stepMessage, stepMeta, onChange }: Props) {
  const responseMeta = isApiResponseMeta(stepMeta) ? stepMeta : null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        <span className="text-[10px] text-muted-foreground shrink-0">Step {stepIndex + 1}</span>
        <select
          value={step.keyword}
          onChange={(e) => onChange({ keyword: e.target.value, objectRef: '', input: '', expected: '' })}
          className="text-xs font-mono bg-input text-foreground px-2 py-1 rounded border border-border focus:border-primary outline-none flex-1 max-w-[220px]"
        >
          {keywords.map((kw) => (
            <option key={kw.name} value={kw.name}>{kw.label}</option>
          ))}
          {/* fallback if keyword not in list */}
          {!keywords.some((k) => k.name === step.keyword) && (
            <option value={step.keyword}>{step.keyword}</option>
          )}
        </select>
      </div>

      <div className="flex-1 flex flex-col gap-5 p-4">
        {/* description */}
        <Field label="Description">
          <TextInput value={step.description} placeholder="What does this step do?" onChange={(v) => onChange({ description: v })} />
        </Field>

        {/* keyword-specific form */}
        <div className="flex flex-col gap-3">
          <StepForm step={step} onChange={onChange} />
        </div>

        {/* step options */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={step.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="w-3 h-3 accent-primary"
            />
            Enabled
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={step.continueOnFailure}
              onChange={(e) => onChange({ continueOnFailure: e.target.checked })}
              className="w-3 h-3 accent-primary"
            />
            Continue on failure
          </label>
          <label className="flex items-center gap-1.5">
            Timeout:
            <input
              type="number"
              value={step.timeout ?? ''}
              placeholder="default"
              onChange={(e) => onChange({ timeout: e.target.value ? parseInt(e.target.value, 10) : null })}
              className="w-20 bg-input text-foreground text-xs px-1.5 py-0.5 rounded border border-border focus:border-primary outline-none"
            />
            <span className="text-muted-foreground/50">ms</span>
          </label>
        </div>

        {/* failure diff / error message */}
        {stepMessage && (
          <FailureDiff message={stepMessage} responseMeta={responseMeta} />
        )}

        {/* response viewer */}
        {responseMeta && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {step.keyword === 'http-request' || step.keyword === 'http-request-body' ? 'Response' : 'Last Response'}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <ResponseViewer meta={responseMeta} />
          </div>
        )}
      </div>
    </div>
  )
}
