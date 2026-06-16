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
import { cn } from '@/lib/utils'

type NewItemType = 'folder' | 'test-case' | 'suite' | 'keyword' | 'api-request'
type DialogPlatform = 'web' | 'mobile' | 'desktop' | 'api'

const LABELS: Record<NewItemType, { title: string; placeholder: string }> = {
  folder: { title: 'New Folder', placeholder: 'folder-name' },
  'test-case': { title: 'New Test Case', placeholder: 'login-success' },
  suite: { title: 'New Test Suite', placeholder: 'smoke-suite' },
  keyword: { title: 'New Keyword', placeholder: 'my-keyword' },
  'api-request': { title: 'New Web Service Request', placeholder: 'get-user' },
}

const PLATFORM_OPTIONS: Array<{ value: DialogPlatform; label: string }> = [
  { value: 'web', label: 'Web' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'api', label: 'API' },
]

export type { NewItemType }

interface Props {
  open: boolean
  type: NewItemType
  onConfirm: (name: string, platform?: string) => void
  onCancel: () => void
}

export function NewItemDialog({ open, type, onConfirm, onCancel }: Props) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<DialogPlatform>('web')
  const meta = LABELS[type]
  const isTestCase = type === 'test-case'

  useEffect(() => {
    if (open) {
      setName('')
      setPlatform('web')
    }
  }, [open])

  const handleSubmit = () => {
    if (!name.trim()) return
    const pl = isTestCase && platform !== 'web' ? platform : undefined
    onConfirm(name.trim(), pl)
    setName('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Name */}
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

          {/* Platform picker — test-case only */}
          {isTestCase && (
            <div className="grid gap-2">
              <Label>Platform</Label>
              <div className="flex gap-1.5">
                {PLATFORM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlatform(opt.value)}
                    className={cn(
                      'flex-1 py-1 rounded text-xs border transition-colors',
                      platform === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
