/**
 * Markdown — Unified Markdown + LaTeX rendering component.
 * Wraps react-markdown with remark-math, remark-gfm, rehype-katex.
 */

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownProps {
  children: string
  className?: string
  compact?: boolean
}

const remarkPlugins = [remarkMath, remarkGfm]
const rehypePlugins = [rehypeKatex]

export default function Markdown({ children, className, compact }: MarkdownProps) {
  const spacing = compact ? 'space-y-1' : 'space-y-2'

  return (
    <div className={`${spacing} ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-ck-t1 mt-3 mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-ck-t1 mt-3 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-ck-t1 mt-2 mb-1">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-ck-t1 mt-2 mb-0.5">{children}</h4>
          ),
          p: ({ children }) => (
            <p className={`${compact ? 'text-sm' : 'text-sm'} leading-relaxed`}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed">{children}</li>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className
            return isInline ? (
              <code className="px-1 py-0.5 bg-ck-bg2 border border-ck-b1 rounded text-xs font-mono text-ck-t1" {...props}>
                {children}
              </code>
            ) : (
              <code className={`${className ?? ''} text-xs`} {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="text-xs bg-ck-bg2 border border-ck-b1 rounded-ck px-3 py-2 overflow-x-auto">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-ck-b1 pl-3 text-sm text-ck-t2 italic">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-ck-accent hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse border border-ck-b1 w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-ck-b1 bg-ck-bg2 px-2 py-1 text-left text-xs font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-ck-b1 px-2 py-1 text-xs">{children}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
