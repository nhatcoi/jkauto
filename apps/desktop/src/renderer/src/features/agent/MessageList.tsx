import { useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentMessage } from './types'
import { ThinkingSection } from './ThinkingSection'
import logoUrl from '@/assets/logo.svg'

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
  const [state, setState] = useState<'idle' | 'applying' | 'done' | 'error'>(
    'idle',
  )
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
            {state === 'applying' && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {state === 'applying'
              ? 'Applying…'
              : targetPath
                ? 'Apply to file'
                : 'No test case open'}
          </button>
        )}
      </div>
    </div>
  )
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-all hover:bg-secondary hover:text-foreground group-hover:opacity-100"
      title="Copy message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export function MessageList({
  messages,
  applyTargetPath,
  onApplySteps,
}: MessageListProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const parts = isUser ? null : parseMessageParts(message.content)
        const hasApplyBlock = parts?.some((p) => p.type === 'apply-steps')
        const toolCalls = (
          message.metadata as
            | {
                toolCalls?: Array<{
                  name: string
                  args: Record<string, unknown>
                }>
              }
            | undefined
        )?.toolCalls

        if (isUser) {
          return (
            <div key={message.id} className="group flex justify-end">
              <div className="flex max-w-[88%] flex-col items-end gap-1">
                <div className="rounded-2xl rounded-br-md bg-secondary px-3.5 py-2.5 text-xs leading-5 text-foreground whitespace-pre-wrap">
                  {message.content}
                </div>
                <div className="flex h-6 items-center gap-1 text-[10px] text-muted-foreground/50">
                  <CopyButton content={message.content} />
                  <span>{formatTime(message.createdAt)}</span>
                </div>
              </div>
            </div>
          )
        }

        return (
          <div key={message.id} className="group flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
              <img src={logoUrl} alt="JKAuto" className="h-4.5 w-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex h-5 items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground/80">JKAuto</span>
                <span className="text-muted-foreground/50">
                  {formatTime(message.createdAt)}
                </span>
                <CopyButton content={message.content} />
              </div>

              {toolCalls && toolCalls.length > 0 && (
                <ThinkingSection steps={toolCalls} />
              )}

              {!parts ? (
                <div className="text-xs leading-5 text-foreground/90 whitespace-pre-wrap">
                  {message.content}
                </div>
              ) : (
                <div
                  className={cn(
                    'max-w-full text-xs leading-5 text-foreground/90',
                    hasApplyBlock && 'pb-1',
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
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
