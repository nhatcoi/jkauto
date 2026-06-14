import { useState } from 'react'
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
import {
  FolderOpen,
  Globe,
  Smartphone,
  Monitor,
  Zap,
  Rocket,
  Shield,
  Bug,
  TestTube2,
  FlaskConical,
  Code2,
  Database,
  Cloud,
  Server,
  Cpu,
  Target,
  Layers,
  Box,
  Braces,
  Activity,
} from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type { CreateProjectPayload, Project } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PROJECT_ICON_OPTIONS: Array<{ name: string; component: React.ElementType }> = [
  { name: 'Globe', component: Globe },
  { name: 'Smartphone', component: Smartphone },
  { name: 'Monitor', component: Monitor },
  { name: 'Zap', component: Zap },
  { name: 'Rocket', component: Rocket },
  { name: 'Shield', component: Shield },
  { name: 'Bug', component: Bug },
  { name: 'TestTube2', component: TestTube2 },
  { name: 'FlaskConical', component: FlaskConical },
  { name: 'Code2', component: Code2 },
  { name: 'Database', component: Database },
  { name: 'Cloud', component: Cloud },
  { name: 'Server', component: Server },
  { name: 'Cpu', component: Cpu },
  { name: 'Target', component: Target },
  { name: 'Layers', component: Layers },
  { name: 'Box', component: Box },
  { name: 'Braces', component: Braces },
  { name: 'Activity', component: Activity },
]

const TYPE_DEFAULT_ICONS: Record<string, string> = {
  web: 'Globe',
  mobile: 'Smartphone',
  desktop: 'Monitor',
  api: 'Zap',
}

const INITIAL: CreateProjectPayload = {
  name: '',
  type: 'web',
  icon: '',
  description: '',
  repoUrl: '',
  location: '',
  format: 'json',
}

export function NewProjectDialog({ open, onOpenChange }: Props) {
  const [form, setForm] = useState<CreateProjectPayload>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setProject = useProjectStore((s) => s.setProject)

  const set = (k: keyof CreateProjectPayload, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleBrowse = async () => {
    const result = await invoke<string[] | null>(IpcChannels.DIALOG_OPEN_FOLDER)
    if (result?.[0]) set('location', result[0])
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return setError('Project name is required')
    if (!form.location.trim()) return setError('Location is required')
    setError('')
    setLoading(true)
    try {
      const result = await invoke<{ success: boolean; projectPath: string; project: Project }>(
        IpcChannels.PROJECT_CREATE,
        form,
      )
      setProject(result.projectPath, result.project)
      onOpenChange(false)
      setForm(INITIAL)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const effectiveIcon = form.icon || TYPE_DEFAULT_ICONS[form.type] || 'Globe'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="MyAutoTestProject"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type *</Label>
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
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(v) => set('format', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="yaml">YAML</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                    onClick={() => set('icon', name === TYPE_DEFAULT_ICONS[form.type] && form.icon === '' ? '' : name)}
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
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="repo">Repository URL</Label>
            <Input
              id="repo"
              placeholder="https://github.com/org/repo"
              value={form.repoUrl}
              onChange={(e) => set('repoUrl', e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="loc">Location *</Label>
            <div className="flex gap-2">
              <Input
                id="loc"
                placeholder="/home/user/projects"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleBrowse} className="shrink-0">
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
