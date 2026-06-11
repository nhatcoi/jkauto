import { Send, Loader2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HttpMethod } from '../types'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-cyan-400',
  OPTIONS: 'text-gray-400',
}

interface Props {
  method: HttpMethod
  url: string
  sending: boolean
  saving: boolean
  onMethodChange: (method: HttpMethod) => void
  onUrlChange: (url: string) => void
  onSend: () => void
  onSave: () => void
}

export function MethodUrlBar({
  method,
  url,
  sending,
  saving,
  onMethodChange,
  onUrlChange,
  onSend,
  onSave,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-panel shrink-0">
      <select
        value={method}
        onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
        className={cn(
          'bg-input border border-border rounded text-xs px-2 py-1.5 font-semibold outline-none',
          'focus:border-primary cursor-pointer shrink-0 w-28',
          METHOD_COLORS[method],
        )}
      >
        {METHODS.map((m) => (
          <option key={m} value={m} className={METHOD_COLORS[m]}>
            {m}
          </option>
        ))}
      </select>

      <input
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
        placeholder="https://api.example.com/endpoint"
        className="flex-1 bg-input text-foreground text-xs px-3 py-1.5 rounded border border-border focus:border-primary outline-none font-mono"
      />

      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        className={cn(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium transition-colors shrink-0',
          'bg-primary hover:bg-primary/90 text-primary-foreground',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {sending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Send className="w-3.5 h-3.5" />
        }
        {sending ? 'Sending…' : 'Send'}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={cn(
          'flex items-center gap-1 text-xs px-2 py-1.5 rounded transition-colors shrink-0',
          'hover:bg-secondary text-muted-foreground hover:text-foreground',
          'disabled:opacity-50',
        )}
      >
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
