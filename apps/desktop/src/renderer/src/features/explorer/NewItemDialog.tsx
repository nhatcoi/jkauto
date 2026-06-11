import { useState, useEffect } from 'react'
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

type NewItemType = 'folder' | 'test-case' | 'suite' | 'keyword' | 'api-request'

const LABELS: Record<NewItemType, { title: string; placeholder: string }> = {
  folder: { title: 'New Folder', placeholder: 'folder-name' },
  'test-case': { title: 'New Test Case', placeholder: 'login-success' },
  suite: { title: 'New Test Suite', placeholder: 'smoke-suite' },
  keyword: { title: 'New Keyword', placeholder: 'my-keyword' },
  'api-request': { title: 'New Web Service Request', placeholder: 'get-user' },
}

export type { NewItemType }

interface Props {
  open: boolean
  type: NewItemType
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function NewItemDialog({ open, type, onConfirm, onCancel }: Props) {
  const [name, setName] = useState('')
  const meta = LABELS[type]

  useEffect(() => {
    if (open) setName('')
  }, [open])

  const handleSubmit = () => {
    if (!name.trim()) return
    onConfirm(name.trim())
    setName('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              autoFocus
              placeholder={meta.placeholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') onCancel()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
