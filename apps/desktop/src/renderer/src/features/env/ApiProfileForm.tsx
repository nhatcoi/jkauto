import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { ApiProfileConfig, ApiAuth } from '@jkauto/core'

interface HeaderRow { id: string; key: string; value: string }

export interface ApiConfigState {
  baseUrl: string
  headers: HeaderRow[]
  auth: ApiAuth
}

export function toApiProfileConfig(s: ApiConfigState): ApiProfileConfig {
  const defaultHeaders: Record<string, string> = {}
  for (const r of s.headers) {
    if (r.key.trim()) defaultHeaders[r.key.trim()] = r.value
  }
  return { baseUrl: s.baseUrl, defaultHeaders, auth: s.auth }
}

export function fromApiProfileConfig(cfg: ApiProfileConfig | undefined): ApiConfigState {
  return {
    baseUrl: cfg?.baseUrl ?? '',
    headers: Object.entries(cfg?.defaultHeaders ?? {}).map(([key, value]) => ({
      id: crypto.randomUUID(), key, value,
    })),
    auth: cfg?.auth ?? { type: 'none' },
  }
}

const AUTH_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api-key', label: 'API Key' },
] as const

interface Props {
  state: ApiConfigState
  onChange: (s: ApiConfigState) => void
}

export function ApiProfileForm({ state, onChange }: Props) {
  const set = (patch: Partial<ApiConfigState>) => onChange({ ...state, ...patch })

  const addHeader = () =>
    set({ headers: [...state.headers, { id: crypto.randomUUID(), key: '', value: '' }] })

  const updateHeader = (id: string, field: 'key' | 'value', val: string) =>
    set({ headers: state.headers.map((r) => r.id === id ? { ...r, [field]: val } : r) })

  const removeHeader = (id: string) =>
    set({ headers: state.headers.filter((r) => r.id !== id) })

  const setAuthType = (type: ApiAuth['type']) => {
    if (type === 'none') set({ auth: { type: 'none' } })
    else if (type === 'bearer') set({ auth: { type: 'bearer', token: (state.auth as any).token ?? '' } })
    else if (type === 'basic') set({ auth: { type: 'basic', username: (state.auth as any).username ?? '', password: (state.auth as any).password ?? '' } })
    else if (type === 'api-key') set({ auth: { type: 'api-key', key: (state.auth as any).key ?? '', value: (state.auth as any).value ?? '', in: 'header' } })
  }

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto flex-1">
      {/* Base URL */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Base URL
        </label>
        <Input
          value={state.baseUrl}
          onChange={(e) => set({ baseUrl: e.target.value })}
          placeholder="https://api.example.com"
          className="h-7 text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground/50">
          Prepended to relative paths in HTTP Request steps. Overrides SET BASE URL step.
        </p>
      </div>

      {/* Auth */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Default Auth
        </label>
        <select
          value={state.auth.type}
          onChange={(e) => setAuthType(e.target.value as ApiAuth['type'])}
          className="h-7 text-xs bg-input text-foreground border border-border rounded px-2 focus:border-primary outline-none"
        >
          {AUTH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {state.auth.type === 'bearer' && (
          <Input
            value={state.auth.token}
            onChange={(e) => set({ auth: { type: 'bearer', token: e.target.value } })}
            placeholder="{{accessToken}} or raw token"
            className="h-7 text-xs font-mono"
          />
        )}
        {state.auth.type === 'basic' && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={state.auth.username}
              onChange={(e) => set({ auth: { ...state.auth as any, username: e.target.value } })}
              placeholder="Username"
              className="h-7 text-xs"
            />
            <Input
              type="password"
              value={state.auth.password}
              onChange={(e) => set({ auth: { ...state.auth as any, password: e.target.value } })}
              placeholder="Password"
              className="h-7 text-xs"
            />
          </div>
        )}
        {state.auth.type === 'api-key' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={(state.auth as any).key}
                onChange={(e) => set({ auth: { ...state.auth as any, key: e.target.value } })}
                placeholder="Header name (e.g. X-API-Key)"
                className="h-7 text-xs font-mono"
              />
              <Input
                value={(state.auth as any).value}
                onChange={(e) => set({ auth: { ...state.auth as any, value: e.target.value } })}
                placeholder="{{apiKey}} or raw value"
                className="h-7 text-xs font-mono"
              />
            </div>
            <select
              value={(state.auth as any).in ?? 'header'}
              onChange={(e) => set({ auth: { ...state.auth as any, in: e.target.value } })}
              className="h-7 text-xs bg-input text-foreground border border-border rounded px-2 focus:border-primary outline-none w-32"
            >
              <option value="header">In: Header</option>
              <option value="query">In: Query</option>
            </select>
          </div>
        )}
      </div>

      {/* Default Headers */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Default Headers
          </label>
          <button
            type="button"
            onClick={addHeader}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        {state.headers.length === 0 && (
          <p className="text-[10px] text-muted-foreground/40 italic">No default headers.</p>
        )}
        {state.headers.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_20px] gap-2 items-center">
            <Input
              value={row.key}
              onChange={(e) => updateHeader(row.id, 'key', e.target.value)}
              placeholder="Content-Type"
              className="h-7 text-xs font-mono"
            />
            <Input
              value={row.value}
              onChange={(e) => updateHeader(row.id, 'value', e.target.value)}
              placeholder="application/json"
              className="h-7 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => removeHeader(row.id)}
              className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
