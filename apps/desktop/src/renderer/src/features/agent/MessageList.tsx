import { useState } from 'react'
import { Bot, CheckCircle2, Loader2, User, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentMessage } from './types'
import { ThinkingSection } from './ThinkingSection'

interface MessageListProps {
  messages: AgentMessage[]
  applyTargetPath?: string | null
  onApplySteps?: (steps: unknown[]) => Promise<void>
}

type MessagePart =
  | { type: 'text'; value: string }
  | { type: 'apply-steps'; steps: unknown[] }

function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = []
  const regex = /```apply-steps\n([\s\S]*?)\n```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    try {
      const parsed = JSON.parse(match[1]) as unknown
      if (Array.isArray(parsed)) {
        parts.push({ type: 'apply-steps', steps: parsed })
      } else {
        parts.push({ type: 'text', value: match[0] })
      }
    } catch {
      parts.push({ type: 'text', value: match[0] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return parts
}

interface ApplyStepsCardProps {
  steps: unknown[]
  targetPath: string | null | undefined
  onApply: (steps: unknown[]) => Promise<void>
}

function ApplyStepsCard({ steps, targetPath, onApply }: ApplyStepsCardProps) {
  const [state, setState] = useState<'idle' | 'applying' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const fileName = targetPath ? targetPath.split('/').pop() : null
  const preview = (steps as Array<Record<string, unknown>>).slice(0, 4)

  async function handleApply() {
    if (!targetPath || state === 'applying' || state === 'done') return
    setState('applying')
    try {
      await onApply(steps)
      setState('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-secondary/30">
        <Wand2 className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground">
          Apply {steps.length} step{steps.length !== 1 ? 's' : ''}
          {fileName ? ` to ${fileName}` : ''}
        </span>
      </div>

      <div className="px-3 py-2 flex flex-col gap-1">
        {preview.map((step, i) => {
          const keyword = String(step.keyword ?? '')
          const desc = String(step.description ?? step.input ?? '')
          return (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="shrink-0 font-mono text-primary/80 bg-primary/10 rounded px-1 py-0.5">
                {keyword}
              </span>
              {desc && (
                <span className="text-muted-foreground truncate">{desc}</span>
              )}
            </div>
          )
        })}
        {steps.length > 4 && (
          <div className="text-[10px] text-muted-foreground/60">
            +{steps.length - 4} more step{steps.length - 4 !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border/40 flex items-center gap-2">
        {state === 'done' ? (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Applied
          </div>
        ) : state === 'error' ? (
          <div className="text-xs text-red-400 truncate">{errorMsg}</div>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={!targetPath || state === 'applying'}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              targetPath && state !== 'applying'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed opacity-50',
            )}
          >
            {state === 'applying' && <Loader2 className="w-3 h-3 animate-spin" />}
            {state === 'applying' ? 'Applying…' : targetPath ? 'Apply to file' : 'No test case open'}
          </button>
        )}
      </div>
    </div>
  )
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MessageList({ messages, applyTargetPath, onApplySteps }: MessageListProps) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const Icon = isUser ? User : Bot
        const parts = isUser ? null : parseMessageParts(message.content)
        const hasApplyBlock = parts?.some((p) => p.type === 'apply-steps')
        const toolCalls = (message.metadata as { toolCalls?: Array<{ name: string; args: Record<string, unknown> }> } | undefined)?.toolCalls

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
                  {isUser ? 'You' : 'JKAuto AI'}
                </span>
                <span>{formatTime(message.createdAt)}</span>
              </div>

              {!isUser && toolCalls && toolCalls.length > 0 && (
                <ThinkingSection steps={toolCalls} />
              )}

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
                    hasApplyBlock && 'pb-0',
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
                      <ApplyStepsCard
                        key={i}
                        steps={part.steps}
                        targetPath={applyTargetPath}
                        onApply={onApplySteps ?? (() => Promise.resolve())}
                      />
                    )
                  })}
                  {hasApplyBlock && <div className="pb-2" />}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
