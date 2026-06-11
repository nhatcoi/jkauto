import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentMessage } from './types'

interface MessageListProps {
  messages: AgentMessage[]
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const Icon = isUser ? User : Bot

        return (
          <div
            key={message.id}
            className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}
          >
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
