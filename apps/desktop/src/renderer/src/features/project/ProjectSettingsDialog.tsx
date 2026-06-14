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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IpcChannels } from '@jkauto/core'
import type { Project, UpdateProjectPayload } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore, selectProject } from '@/store/project.store'
import { cn } from '@/lib/utils'
import { Trash2, AlertTriangle } from 'lucide-react'
import { PROJECT_ICON_OPTIONS } from '@/features/project/NewProjectDialog'

const TYPE_DEFAULT_ICONS: Record<string, string> = {
  web: 'Globe',
  mobile: 'Smartphone',
  desktop: 'Monitor',
  api: 'Zap',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectPath?: string
}

export function ProjectSettingsDialog({ open, onOpenChange, projectPath: propPath }: Props) {
  const activeProjectPath = useProjectStore((s) => s.activeProjectPath)
  const resolvedPath = propPath ?? activeProjectPath ?? ''
  const entry = useProjectStore(selectProject(resolvedPath))
  const updateProject = useProjectStore((s) => s.updateProject)
  const removeProject = useProjectStore((s) => s.removeProject)

  const [form, setForm] = useState({
    name: '',
    type: 'web' as 'web' | 'mobile' | 'desktop' | 'api',
    icon: '',
    description: '',
    repoUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open && entry) {
      setForm({
        name: entry.project.name ?? '',
        type: entry.project.type ?? 'web',
        icon: entry.project.icon ?? '',
        description: entry.project.description ?? '',
        repoUrl: entry.project.repoUrl ?? '',
      })
      setError('')
      setShowDeleteConfirm(false)
    }
  }, [open, entry])

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Project name is required')
    if (!resolvedPath) return
    setError('')
    setSaving(true)
    try {
      const payload: UpdateProjectPayload = {
        projectPath: resolvedPath,
        name: form.name.trim(),
        type: form.type,
        icon: form.icon,
        description: form.description.trim(),
        repoUrl: form.repoUrl.trim(),
      }
      const updated = await invoke<Project>(IpcChannels.PROJECT_UPDATE, payload)
      updateProject(resolvedPath, updated)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!resolvedPath) return
    setDeleting(true)
    try {
      await invoke(IpcChannels.PROJECT_DELETE, resolvedPath)
      removeProject(resolvedPath)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  const effectiveIcon = form.icon || TYPE_DEFAULT_ICONS[form.type] || 'Globe'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ps-name">Project Name *</Label>
            <Input
              id="ps-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_ICON_OPTIONS.map(({ name, component: Icon }) => {
                const selected = effectiveIcon === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => set('icon', name)}
                    className={cn(
                      'w-8 h-8 flex items-center justify-center rounded border transition-colors',
                      selected
                        ? 'border-violet-500 bg-violet-500/15 text-violet-400'
                        : 'border-border/50 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                    title={name}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ps-desc">Description</Label>
            <Input
              id="ps-desc"
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ps-repo">Repository URL</Label>
            <Input
              id="ps-repo"
              placeholder="https://github.com/org/repo"
              value={form.repoUrl}
              onChange={(e) => set('repoUrl', e.target.value)}
            />
          </div>

          {resolvedPath && (
            <div className="grid gap-1.5">
              <Label className="text-muted-foreground">Location</Label>
              <div className="text-xs text-muted-foreground/70 bg-muted/30 rounded px-2 py-1.5 break-all font-mono">
                {resolvedPath}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Danger zone */}
          <div className="border border-destructive/30 rounded-md p-3 mt-1">
            <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Danger Zone
            </div>

            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive gap-1.5 text-xs h-7"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Project
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  This will permanently delete the project folder and all its files. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className={cn(
                      'text-xs h-7 bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5',
                    )}
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
