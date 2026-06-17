import { useState } from 'react'
import { Bot, CheckCircle2, FileJson, Loader2, Save, User } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AgentMessage } from '../agent/types'

type MessagePart =
  | { type: 'text'; value: string }
  | { type: 'save-file'; filename: string; lang: string; content: string }

// Parses:  ## File: `some/path.json`\n```lang\n...\n```
function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = []
  const regex = /##\s+File:\s+`([^`]+)`\s*\n```(\w*)\n([\s\S]*?)\n```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    parts.push({
      type: 'save-file',
      filename: match[1],
      lang: match[2] || 'text',
      content: match[3],
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return parts
}

interface SaveFileCardProps {
  filename: string
  lang: string
  content: string
  projectPath: string | undefined
}

function SaveFileCard({ filename, lang, content, projectPath }: SaveFileCardProps) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const basename = filename.split('/').pop() ?? filename
  const preview = content.split('\n').slice(0, 5).join('\n')
  const lineCount = content.split('\n').length

  async function handleSave() {
    if (!projectPath || state === 'saving' || state === 'saved') return
    setState('saving')

    const savePath = `${projectPath}/agent-test/generated-cases/${basename}`
    try {
      await invoke(IpcChannels.FS_CREATE_DIR, `${projectPath}/agent-test/generated-cases`)
      await invoke(IpcChannels.FS_WRITE_FILE, savePath, content)
      setState('saved')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-secondary/30">
        <FileJson className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {basename}
        </span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">{lang} · {lineCount} lines</span>
      </div>

      <pre className="px-3 py-2 text-[10px] font-mono text-muted-foreground/70 leading-relaxed overflow-x-auto whitespace-pre">
        {preview}
        {lineCount > 5 && <span className="text-muted-foreground/40">{'\n'}…</span>}
      </pre>

      <div className="px-3 py-2 border-t border-border/40 flex items-center gap-2">
        {state === 'saved' ? (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved to agent-test/generated-cases/
          </div>
        ) : state === 'error' ? (
          <div className="text-xs text-red-400 truncate">{errorMsg}</div>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={!projectPath || state === 'saving'}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              projectPath && state !== 'saving'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed opacity-50',
            )}
          >
            {state === 'saving' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {state === 'saving' ? 'Saving…' : 'Save to project'}
          </button>
        )}
        {projectPath && state === 'idle' && (
          <span className="text-[10px] text-muted-foreground/40 truncate">
            → agent-test/generated-cases/{basename}
          </span>
        )}
      </div>
    </div>
  )
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface AgentMessageListProps {
  messages: AgentMessage[]
  projectPath: string | undefined
}

export function AgentMessageList({ messages, projectPath }: AgentMessageListProps) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const Icon = isUser ? User : Bot
        const parts = isUser ? null : parseMessageParts(message.content)
        const hasFileBlock = parts?.some((p) => p.type === 'save-file')

        return (
          <div key={message.id} className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
            <div
              className={cn(
                'w-6 h-6 rounded-md flex items-center justify-center shrink-0 border',
                isUser
                  ? 'bg-primary text-primary-foreground border-primary/80'
                  : 'bg-secondary text-foreground/80 border-border',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>

            <div className={cn('min-w-0 flex-1', isUser && 'text-right')}>
              <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground">
                <span className={cn('font-medium', isUser && 'ml-auto')}>
                  {isUser ? 'You' : 'Agent'}
                </span>
                <span>{formatTime(message.createdAt)}</span>
              </div>

              {isUser || !parts ? (
                <div
                  className={cn(
                    'inline-block max-w-full rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-left',
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-foreground/85 border border-border/60',
                  )}
                >
                  {message.content}
                </div>
              ) : (
                <div
                  className={cn(
                    'max-w-full rounded-md px-3 py-2 text-xs leading-relaxed text-left',
                    'bg-secondary/50 text-foreground/85 border border-border/60',
                    hasFileBlock && 'pb-0',
                  )}
                >
                  {parts.map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <span key={i} className="whitespace-pre-wrap">
                          {part.value}
                        </span>
                      )
                    }
                    return (
                      <SaveFileCard
                        key={i}
                        filename={part.filename}
                        lang={part.lang}
                        content={part.content}
                        projectPath={projectPath}
                      />
                    )
                  })}
                  {hasFileBlock && <div className="pb-2" />}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
