import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAutogenStore } from '../store'

interface Props {
  onStart: () => void
  loading: boolean
}

export function RepoSetupForm({ onStart, loading }: Props) {
  const { repoUrl, setRepoUrl } = useAutogenStore()
  const [url, setUrl] = useState(repoUrl)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setRepoUrl(url.trim())
    onStart()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="repo-url">GitHub Repository URL</Label>
        <Input
          id="repo-url"
          placeholder="https://github.com/org/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Repo will be shallow-cloned for analysis. No deps installed.
        </p>
      </div>
      <Button type="submit" disabled={!url.trim() || loading}>
        {loading ? 'Indexing...' : 'Analyze & Index'}
      </Button>
    </form>
  )
}
