import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('prose-agent', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-sm font-bold mt-3 mb-1 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xs font-bold mt-3 mb-1 first:mt-0 text-foreground/90">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-semibold mt-2 mb-1 first:mt-0 text-foreground/80">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-xs leading-5 mb-2 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="text-xs leading-5 mb-2 list-disc pl-4 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-xs leading-5 mb-2 list-decimal pl-4 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-xs leading-5">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground/80">{children}</em>
        ),
        hr: () => (
          <hr className="my-3 border-border/40" />
        ),
        code: ({ children, className: codeClass }) => {
          const isBlock = codeClass?.startsWith('language-')
          if (isBlock) {
            return (
              <code className="block text-[11px] leading-4 font-mono">
                {children}
              </code>
            )
          }
          return (
            <code className="text-[11px] font-mono bg-secondary/70 text-primary/90 rounded px-1 py-0.5">
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="text-[11px] font-mono bg-secondary/50 border border-border/40 rounded-md px-3 py-2 mb-2 overflow-x-auto leading-4 text-foreground/90">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic mb-2">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto">
            <table className="text-xs w-full border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border/40">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left font-semibold px-2 py-1 text-foreground/80">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border-b border-border/20">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
