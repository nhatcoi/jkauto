import path from 'node:path'
import fs from 'node:fs'
import { simpleGit } from 'simple-git'
import type { IndexProgress, RepoConfig } from './types'

export async function cloneRepo(
  config: RepoConfig,
  onProgress: (p: IndexProgress) => void
): Promise<void> {
  const { url, branch, localPath } = config

  if (fs.existsSync(path.join(localPath, '.git'))) {
    onProgress({ phase: 'clone', message: 'Pulling latest changes...', percent: 10 })
    const git = simpleGit(localPath)
    await git.pull()
    onProgress({ phase: 'clone', message: 'Updated', percent: 20 })
    return
  }

  fs.mkdirSync(localPath, { recursive: true })
  onProgress({ phase: 'clone', message: `Cloning ${url}...`, percent: 5 })

  const git = simpleGit()
  const cloneArgs = ['--depth', '1', '--filter=blob:none']
  if (branch) cloneArgs.push('--branch', branch)

  await git.clone(url, localPath, cloneArgs)
  onProgress({ phase: 'clone', message: 'Clone complete', percent: 20 })
}

export function resolveLocalPath(autotestDir: string, repoUrl: string): string {
  const hash = Buffer.from(repoUrl).toString('base64url').slice(0, 16)
  return path.join(autotestDir, 'repo-cache', hash)
}
