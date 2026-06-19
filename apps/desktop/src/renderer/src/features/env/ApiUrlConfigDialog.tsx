import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/store/project.store'
import { listEnvs, readProfile, writeEnv } from './api'
import { ApiProfileForm, fromApiProfileConfig, toApiProfileConfig } from './ApiProfileForm'
import type { ApiConfigState } from './ApiProfileForm'

interface Props {
  open: boolean
  onClose: () => void
}

export function ApiUrlConfigDialog({ open, onClose }: Props) {
  const { activeProject } = useProjectStore()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profilePath, setProfilePath] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('default')
  const [existingVars, setExistingVars] = useState<Record<string, string>>({})
  const [apiConfig, setApiConfig] = useState<ApiConfigState>(fromApiProfileConfig(undefined))

  useEffect(() => {
    if (!open || !activeProject) return
    setLoading(true)
    setError('')
    const activeName = activeProject.activeProfile ?? 'default'
    ;(async () => {
      try {
        const envs = await listEnvs(activeProject.path)
        const env = envs.find((e) => e.name === activeName) ?? envs[0]
        if (!env) return
        setProfilePath(env.path)
        setProfileName(env.name)
        const profile = await readProfile(env.path)
        setExistingVars(profile.variables)
        setApiConfig(fromApiProfileConfig(profile.api))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, activeProject])

  const handleSave = async () => {
    if (!profilePath) return
    setSaving(true)
    setError('')
    try {
      await writeEnv(profilePath, existingVars, toApiProfileConfig(apiConfig))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 gap-0 flex flex-col max-h-[80vh]">
        <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-sm flex items-center gap-2">
            API Config
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {profileName}
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />Loading…
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <ApiProfileForm state={apiConfig} onChange={setApiConfig} />
          </div>
        )}

        {error && (
          <div className="px-5 py-1.5 border-t border-border bg-destructive/10 text-xs text-destructive shrink-0">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-3 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="h-7 px-3 text-xs"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
