import { useState, useEffect } from 'react'
import { FileText, FolderOpen, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import type { FsEntry } from '@jkauto/core'

type ImportTarget = 'params' | 'headers' | 'body-json'

export interface DataImportResult {
  target: ImportTarget
  rows: { key: string; value: string }[]
}

interface Props {
  open: boolean
  onClose: () => void
  onImport: (result: DataImportResult) => void
}

function splitCsv(line: string): string[] {
  return line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
}

function parseContent(content: string, ext: string): { key: string; value: string }[] {
  if (ext === 'csv') {
    const lines = content.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return []
    const headers = splitCsv(lines[0])
    const values = splitCsv(lines[1])
    return headers.map((key, i) => ({ key, value: values[i] ?? '' }))
  }
  try {
    const parsed = JSON.parse(content)
    const obj = Array.isArray(parsed) ? parsed[0] : parsed
    if (!obj || typeof obj !== 'object') return []
    return Object.entries(obj).map(([key, val]) => ({
      key,
      value: typeof val === 'string' ? val : JSON.stringify(val),
    }))
  } catch {
    return []
  }
}

const TARGETS: { value: ImportTarget; label: string }[] = [
  { value: 'params', label: 'Params' },
  { value: 'headers', label: 'Headers' },
  { value: 'body-json', label: 'Body JSON' },
]

export function ImportDataDialog({ open, onClose, onImport }: Props) {
  const { activeProject } = useProjectStore()
  const [files, setFiles] = useState<FsEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [rows, setRows] = useState<{ key: string; value: string }[]>([])
  const [target, setTarget] = useState<ImportTarget>('params')
  const [loading, setLoading] = useState(false)
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    if (!open || !activeProject) return
    invoke<FsEntry[]>(IpcChannels.FS_LIST_DIR, `${activeProject.path}/data-files`)
      .then((entries) =>
        setFiles(
          entries.filter(
            (e) => e.type === 'file' && (e.name.endsWith('.json') || e.name.endsWith('.csv')),
          ),
        ),
      )
      .catch(() => setFiles([]))
  }, [open, activeProject])

  const loadFile = async (filePath: string) => {
    setSelectedFile(filePath)
    setParseError('')
    setRows([])
    setLoading(true)
    try {
      const content = await invoke<string>(IpcChannels.FS_READ_FILE, filePath)
      const ext = filePath.endsWith('.csv') ? 'csv' : 'json'
      const parsed = parseContent(content, ext)
      if (parsed.length === 0) {
        setParseError('No key-value pairs found in file')
      } else {
        setRows(parsed)
      }
    } catch {
      setParseError('Failed to read file')
    } finally {
      setLoading(false)
    }
  }

  const handleBrowse = async () => {
    const picked = await invoke<string[] | null>(IpcChannels.DIALOG_OPEN_FILE, [
      { name: 'Data Files', extensions: ['json', 'csv'] },
    ])
    if (picked?.[0]) loadFile(picked[0])
  }

  const handleImport = () => {
    onImport({ target, rows })
    handleClose()
  }

  const handleClose = () => {
    setSelectedFile(null)
    setRows([])
    setParseError('')
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Data Files
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1"
                onClick={handleBrowse}
              >
                <FolderOpen className="w-3 h-3" />
                Browse
              </Button>
            </div>
            {files.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 px-1">
                No .json/.csv files in data-files/
              </p>
            ) : (
              <div className="flex flex-col gap-0.5 max-h-36 overflow-auto rounded border border-border p-1">
                {files.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => loadFile(f.path)}
                    className={`flex items-center gap-2 text-xs px-2 py-1 rounded text-left transition-colors ${
                      selectedFile === f.path
                        ? 'bg-primary/15 text-primary'
                        : 'hover:bg-secondary/60 text-foreground'
                    }`}
                  >
                    <FileText className="w-3 h-3 shrink-0 opacity-60" />
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Reading file…
            </div>
          )}

          {parseError && <p className="text-xs text-destructive">{parseError}</p>}

          {rows.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Preview
              </span>
              <div className="rounded border border-border overflow-auto max-h-40">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-2 py-1 font-medium text-muted-foreground w-1/2">
                        Key
                      </th>
                      <th className="text-left px-2 py-1 font-medium text-muted-foreground w-1/2">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-2 py-1 font-mono">{row.key}</td>
                        <td className="px-2 py-1 font-mono text-foreground/70 truncate max-w-[140px]">
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Import into
              </span>
              <div className="flex gap-1">
                {TARGETS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTarget(value)}
                    className={`text-xs px-3 py-1 rounded border transition-colors ${
                      target === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleImport} disabled={rows.length === 0}>
            {rows.length > 0
              ? `Import ${rows.length} row${rows.length !== 1 ? 's' : ''}`
              : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
