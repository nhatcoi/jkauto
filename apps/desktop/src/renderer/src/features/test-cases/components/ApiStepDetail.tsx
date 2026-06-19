import { cn } from '@/lib/utils'
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

function HttpRequestForm({ step, onChange }: { step: TestStep; onChange: (p: Partial<TestStep>) => void }) {
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
      {step.keyword === 'http-request-body' && (
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
    return <KeyValueForm step={step} onChange={onChange} labelA="Variable Name" labelB="Value" placeholderA="myVar" placeholderB="value or {{other}}" fieldA="objectRef" fieldB="input" />
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

// ── main ───────────────────────────────────────────────────────────────────────

interface Props {
  step: TestStep
  stepIndex: number
  stepMessage?: string
  stepMeta?: unknown
  onChange: (patch: Partial<TestStep>) => void
}

export function ApiStepDetail({ step, stepIndex, stepMessage, stepMeta, onChange }: Props) {
  const responseMeta = isApiResponseMeta(stepMeta) ? stepMeta : null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        <span className="text-[10px] text-muted-foreground">Step {stepIndex + 1}</span>
        <span className="text-xs font-mono text-foreground/70">{step.keyword}</span>
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

        {/* error message */}
        {stepMessage && (
          <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30">
            <p className="text-[11px] font-mono text-red-400">{stepMessage}</p>
          </div>
        )}

        {/* response viewer */}
        {responseMeta && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Response</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <ResponseViewer meta={responseMeta} />
          </div>
        )}
      </div>
    </div>
  )
}
