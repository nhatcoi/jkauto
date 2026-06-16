import type { AuthConfig } from '../types'

interface Props {
  auth: AuthConfig
  onChange: (auth: AuthConfig) => void
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-foreground w-24 shrink-0">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:border-primary outline-none font-mono"
      />
    </div>
  )
}

export function AuthPanel({ auth, onChange }: Props) {
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground w-24 shrink-0">Auth Type</label>
        <select
          value={auth.type}
          onChange={(e) => {
            const t = e.target.value as AuthConfig['type']
            if (t === 'none') onChange({ type: 'none' })
            else if (t === 'bearer') onChange({ type: 'bearer', token: '' })
            else if (t === 'basic') onChange({ type: 'basic', username: '', password: '' })
            else if (t === 'api-key') onChange({ type: 'api-key', key: '', value: '', in: 'header' })
          }}
          className="bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:border-primary outline-none"
        >
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="api-key">API Key</option>
        </select>
      </div>

      {auth.type === 'bearer' && (
        <Field
          label="Token"
          value={auth.token}
          onChange={(v) => onChange({ ...auth, token: v })}
        />
      )}

      {auth.type === 'basic' && (
        <>
          <Field
            label="Username"
            value={auth.username}
            onChange={(v) => onChange({ ...auth, username: v })}
          />
          <Field
            label="Password"
            value={auth.password}
            onChange={(v) => onChange({ ...auth, password: v })}
            type="password"
          />
        </>
      )}

      {auth.type === 'api-key' && (
        <>
          <Field
            label="Key"
            value={auth.key}
            onChange={(v) => onChange({ ...auth, key: v })}
          />
          <Field
            label="Value"
            value={auth.value}
            onChange={(v) => onChange({ ...auth, value: v })}
          />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-24 shrink-0">Add To</label>
            <select
              value={auth.in}
              onChange={(e) => onChange({ ...auth, in: e.target.value as 'header' | 'query' })}
              className="bg-input text-foreground text-xs px-2 py-1 rounded border border-border focus:border-primary outline-none"
            >
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
        </>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-muted-foreground/60">No authentication will be sent with this request.</p>
      )}
    </div>
  )
}
