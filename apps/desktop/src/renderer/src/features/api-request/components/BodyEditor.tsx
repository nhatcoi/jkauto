import { Textarea } from '@/components/ui/textarea'
import { KeyValueTable } from './KeyValueTable'
import type { BodyConfig } from '../types'

interface Props {
  body: BodyConfig
  onChange: (body: BodyConfig) => void
}

const BODY_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'raw-json', label: 'JSON' },
  { value: 'raw-text', label: 'Text' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'form-urlencoded', label: 'URL Encoded' },
] as const

export function BodyEditor({ body, onChange }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground">Type:</span>
        <div className="flex gap-1">
          {BODY_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (value === 'none') onChange({ type: 'none' })
                else if (value === 'raw-json') onChange({ type: 'raw-json', content: body.type === 'raw-json' ? body.content : '' })
                else if (value === 'raw-text') onChange({ type: 'raw-text', content: body.type === 'raw-text' ? body.content : '' })
                else if (value === 'form-data') onChange({ type: 'form-data', items: body.type === 'form-data' ? body.items : [] })
                else if (value === 'form-urlencoded') onChange({ type: 'form-urlencoded', items: body.type === 'form-urlencoded' ? body.items : [] })
              }}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                body.type === value
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {body.type === 'none' && (
          <p className="text-xs text-muted-foreground/60">No body will be sent with this request.</p>
        )}

        {(body.type === 'raw-json' || body.type === 'raw-text') && (
          <Textarea
            className="h-full min-h-[120px] font-mono text-xs"
            placeholder={body.type === 'raw-json' ? '{\n  "key": "value"\n}' : 'Plain text body'}
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
          />
        )}

        {(body.type === 'form-data' || body.type === 'form-urlencoded') && (
          <KeyValueTable
            items={body.items}
            onChange={(items) => onChange({ ...body, items } as BodyConfig)}
            keyPlaceholder="field"
            valuePlaceholder="value"
          />
        )}
      </div>
    </div>
  )
}
