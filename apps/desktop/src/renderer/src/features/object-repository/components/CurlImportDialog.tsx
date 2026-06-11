import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { parseCurl } from '../utils/curl'
import type { ApiRequest } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (partial: Partial<ApiRequest>) => void
}

export function CurlImportDialog({ open, onClose, onImport }: Props) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')

  const handleImport = () => {
    const parsed = parseCurl(raw.trim())
    if (!parsed.url) {
      setError('Could not parse URL. Make sure the input starts with "curl".')
      return
    }
    onImport(parsed)
    setRaw('')
    setError('')
    onClose()
  }

  const handleClose = () => {
    setRaw('')
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Import from cURL</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-1">
          <Textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setError('') }}
            placeholder={`curl -X POST 'https://api.example.com/endpoint' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"key": "value"}'`}
            className="font-mono text-xs h-44 resize-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleImport()
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!raw.trim()}>
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
