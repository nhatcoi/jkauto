import { useEffect, useState } from 'react'
import { Table2, FileCode2, AlertCircle, Loader2 } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import { invoke, cn } from '@/lib/utils'

type ViewMode = 'visual' | 'raw'

function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return { columns: [], rows: [] }
  const columns = lines[0]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"')),
  )
  return { columns, rows }
}

function CsvVisualView({ content }: { content: string }) {
  const { columns, rows } = parseCsv(content)

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/40 text-xs">
        Empty file
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="text-xs w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr>
            <th className="w-8 border-b border-r border-border text-muted-foreground/50 font-normal text-center py-1.5 px-2">
              #
            </th>
            {columns.map((col, ci) => (
              <th
                key={ci}
                className="border-b border-r border-border font-medium text-left px-2 py-1.5 text-foreground/70 font-mono text-[11px] min-w-[120px] whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-secondary/20 group">
              <td className="border-b border-r border-border text-center text-muted-foreground/40 py-1 font-mono text-[10px]">
                {ri + 1}
              </td>
              {columns.map((_, ci) => {
                const val = row[ci] ?? ''
                const isEmpty = val === ''
                const isNumber = !isEmpty && !isNaN(Number(val))
                return (
                  <td
                    key={ci}
                    className={cn(
                      'border-b border-r border-border px-2 py-1 font-mono text-[11px]',
                      isEmpty && 'text-muted-foreground/30 italic',
                      isNumber && 'text-blue-400',
                      !isEmpty && !isNumber && 'text-foreground/90',
                    )}
                  >
                    {isEmpty ? '—' : val}
                  </td>
                )
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="text-center py-8 text-muted-foreground/40 text-xs"
              >
                No data rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function JsonVisualView({ content }: { content: string }) {
  let parsed: unknown = null
  let parseError = ''
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'Invalid JSON'
  }

  if (parseError) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive text-xs">
        <AlertCircle className="w-4 h-4 shrink-0" />
        JSON parse error: {parseError}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <pre className="text-xs font-mono leading-5 text-foreground/85 whitespace-pre-wrap break-words">
        {JSON.stringify(parsed, null, 2)
          .split('\n')
          .map((line, i) => {
            // basic syntax coloring via spans
            const keyMatch = line.match(/^(\s*)("[\w-]+")\s*:/)
            if (keyMatch) {
              const rest = line.slice(keyMatch[0].length)
              return (
                <span key={i}>
                  {keyMatch[1]}
                  <span className="text-blue-400">{keyMatch[2]}</span>
                  {': '}
                  <JsonValue text={rest.trimStart()} />
                  {'\n'}
                </span>
              )
            }
            return <span key={i}>{line}{'\n'}</span>
          })}
      </pre>
    </div>
  )
}

function JsonValue({ text }: { text: string }) {
  const trimmed = text.trim().replace(/,$/, '')
  if (trimmed === 'null') return <span className="text-muted-foreground/60">null</span>
  if (trimmed === 'true' || trimmed === 'false')
    return <span className="text-orange-400">{trimmed}</span>
  if (!isNaN(Number(trimmed)) && trimmed !== '')
    return <span className="text-green-400">{text}</span>
  if (trimmed.startsWith('"'))
    return <span className="text-yellow-300/90">{text}</span>
  return <span>{text}</span>
}

function RawView({ content }: { content: string }) {
  return (
    <div className="flex-1 overflow-auto">
      <pre className="text-xs text-foreground/80 font-mono leading-5 whitespace-pre-wrap break-words p-4">
        {content}
      </pre>
    </div>
  )
}

interface Props {
  filePath: string
}

export function RawDataFileViewer({ filePath }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('visual')

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const isCsv = ext === 'csv'
  const isJson = ext === 'json'
  const fileName = filePath.split('/').pop() ?? filePath

  useEffect(() => {
    setContent(null)
    setError(null)
    invoke<string>(IpcChannels.FS_READ_FILE, filePath)
      .then(setContent)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to read file'))
  }, [filePath])

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive text-xs">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    )
  }

  if (content === null) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading…
      </div>
    )
  }

  const canVisual = isCsv || isJson

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 bg-panel">
        <span className="text-xs font-medium text-foreground/80 font-mono">{fileName}</span>
        <div className="flex-1" />
        {canVisual && (
          <div className="flex items-center rounded border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 transition-colors',
                viewMode === 'visual'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground/70',
              )}
              title="Visual view"
            >
              <Table2 className="w-3.5 h-3.5" />
              Visual
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 transition-colors border-l border-border',
                viewMode === 'raw'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground/70',
              )}
              title="Raw file"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              Raw
            </button>
          </div>
        )}
        {isCsv && viewMode === 'visual' && (
          <span className="text-[10px] text-muted-foreground/50 font-mono ml-1">
            {parseCsv(content).rows.length} rows
          </span>
        )}
      </div>

      {/* content */}
      {viewMode === 'raw' || !canVisual ? (
        <RawView content={content} />
      ) : isCsv ? (
        <CsvVisualView content={content} />
      ) : (
        <JsonVisualView content={content} />
      )}
    </div>
  )
}
