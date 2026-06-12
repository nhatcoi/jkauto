import { useState } from 'react'
import { FileSearch, Link, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { importOpenApi } from './api'
import { useAppSettingsStore } from '@/store/app-settings.store'

interface Props {
  open: boolean
  targetDir: string
  onClose: () => void
  onImported: () => void
}

type SourceMode = 'file' | 'url'

export function ImportOpenApiDialog({ open, targetDir, onClose, onImported }: Props) {
  const nameSource = useAppSettingsStore((state) => state.settings?.explorer.openApiImportNameSource ?? 'summary')
  const [mode, setMode] = useState<SourceMode>('file')
  const [filePath, setFilePath] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<string[] | null>(null)

  const reset = () => {
    setFilePath('')
    setUrl('')
    setError('')
    setResult(null)
    setLoading(false)
  }

  const handleBrowse = async () => {
    const picked = await invoke<string[] | null>(
      IpcChannels.DIALOG_OPEN_FILE,
      [{ name: 'OpenAPI', extensions: ['yaml', 'yml', 'json'] }],
    )
    if (picked?.[0]) setFilePath(picked[0])
  }

  const handleImport = async () => {
    const source = mode === 'file' ? filePath : url
    if (!source.trim()) {
      setError('Provide a file or URL')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await importOpenApi(source.trim(), targetDir, nameSource)
      setResult(res.created)
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from OpenAPI</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs text-muted-foreground">
              Created <strong>{result.length}</strong> request{result.length !== 1 ? 's' : ''} in object-repository.
            </p>
            <div className="max-h-48 overflow-auto rounded border border-border p-2 flex flex-col gap-0.5">
              {result.map((p) => {
                const parts = p.split('/')
                const label = parts.slice(-2).join('/')
                return (
                  <span key={p} className="text-[10px] font-mono text-foreground/70">
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            {/* mode toggle */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMode('file')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                  mode === 'file'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileSearch className="w-3.5 h-3.5" />
                Local File
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                  mode === 'url'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                URL
              </button>
            </div>

            {mode === 'file' && (
              <div className="flex flex-col gap-1.5">
                <Label>OpenAPI File (.yaml / .json)</Label>
                <div className="flex gap-2">
                  <Input
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="/path/to/openapi.yaml"
                    className="flex-1 font-mono text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={handleBrowse}>
                    Browse
                  </Button>
                </div>
              </div>
            )}

            {mode === 'url' && (
              <div className="flex flex-col gap-1.5">
                <Label>OpenAPI URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                  className="font-mono text-xs"
                />
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Imports all endpoints as <code>.request.json</code> files into{' '}
              <code className="text-foreground/70">{targetDir.split('/').pop()}/</code>. Request names use{' '}
              <code className="text-foreground/70">{nameSource}</code> from app settings.
            </p>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={loading}>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {loading ? 'Importing…' : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
