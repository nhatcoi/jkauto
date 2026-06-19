import { useEffect, useState } from 'react'
import { History, RotateCcw, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { IpcChannels } from '@jkauto/core'
import type { FileVersionEntry } from '@jkauto/core'
import { invoke } from '@/lib/utils'

interface Props {
  open: boolean
  filePath: string
  onClose: () => void
  onRestored: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return iso
  }
}

export function FileHistoryDialog({ open, filePath, onClose, onRestored }: Props) {
  const [versions, setVersions] = useState<FileVersionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    invoke<FileVersionEntry[]>(IpcChannels.FILE_HISTORY_LIST, filePath)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [open, filePath])

  const handleRestore = async (entry: FileVersionEntry) => {
    setRestoring(entry.backupPath)
    try {
      await invoke(IpcChannels.FILE_HISTORY_RESTORE, { filePath, backupPath: entry.backupPath })
      onRestored()
      onClose()
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <History className="w-4 h-4" />
            File History
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-muted-foreground font-mono truncate -mt-1">
          {filePath}
        </p>

        <div className="mt-1 max-h-[360px] overflow-y-auto rounded border border-border">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : versions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              No saved versions yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {versions.map((v, i) => (
                <div
                  key={v.backupPath}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">
                      {formatTs(v.timestamp)}
                      {i === 0 && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary/80 border border-primary/20">
                          latest
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {formatSize(v.sizeBytes)}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={restoring !== null}
                    onClick={() => handleRestore(v)}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded
                      text-muted-foreground hover:text-foreground hover:bg-secondary
                      disabled:opacity-40 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {restoring === v.backupPath ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Restoring saves current version as backup first.
        </p>
      </DialogContent>
    </Dialog>
  )
}
