import { useState } from 'react'
import { Check, Copy, Terminal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RuntimeData {
  framework?: string
  language?: string
  suggestedCommands?: string[]
  hasOpenApi?: boolean
  openApiPath?: string
  testFramework?: string
  requiresRuntimeValidation?: boolean
  note?: string
}

export function RuntimeRequirementsView({ contentJson }: { contentJson: string }) {
  let data: RuntimeData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const commands = data.suggestedCommands ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <InfoCard label="Framework" value={data.framework ?? '—'} />
        <InfoCard label="Language" value={data.language ?? '—'} />
        <InfoCard label="Test framework" value={data.testFramework ?? '—'} />
        <InfoCard label="OpenAPI" value={data.hasOpenApi ? 'Detected' : 'Not found'} />
        {data.openApiPath && (
          <InfoCard label="Spec path" value={data.openApiPath} mono />
        )}
        <InfoCard
          label="Runtime validation"
          value={data.requiresRuntimeValidation ? 'Required' : 'Not required'}
        />
      </div>

      {commands.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Suggested run commands
          </h3>
          <div className="space-y-1.5">
            {commands.map((cmd, i) => (
              <CopyableCommand key={i} index={i + 1} command={cmd} />
            ))}
          </div>
        </div>
      )}

      {data.note && (
        <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <Badge variant="outline" className="shrink-0 border-amber-500/30 text-amber-400">
            Note
          </Badge>
          <p className="text-[11px] text-muted-foreground">{data.note}</p>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-[11px] font-medium ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
  )
}

function CopyableCommand({ index, command }: { index: number; command: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/30 px-3 py-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-secondary text-[8px] text-muted-foreground">
        {index}
      </span>
      <div className="flex items-center gap-1.5">
        <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
      </div>
      <code className="flex-1 truncate font-mono text-[11px]">{command}</code>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        title="Copy command"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  )
}
