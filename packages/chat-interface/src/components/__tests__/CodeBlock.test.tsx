import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CodeBlock, extractText } from '../CodeBlock'

vi.mock('../MermaidBlock', () => ({
  MermaidBlock: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mermaid-block">{children}</div>
  ),
}))

describe('CodeBlock', () => {
  it('renders inline code (no language-* class) as plain <code>', () => {
    const { container } = render(<CodeBlock>inline</CodeBlock>)
    const code = container.querySelector('code')
    expect(code).toBeTruthy()
    expect(code!.textContent).toBe('inline')
    // No wrapper div (block code has a wrapping div)
    expect(container.querySelector('pre')).toBeNull()
  })

  it('renders block code with language label and copy button', () => {
    render(<CodeBlock className="language-typescript">const x = 1</CodeBlock>)
    screen.getByText('typescript')
    expect(screen.getByLabelText('复制代码')).toBeTruthy()
  })

  it('dispatches to MermaidBlock when language-mermaid class is present', () => {
    render(<CodeBlock className="language-mermaid">graph TD; A--&gt;B;</CodeBlock>)
    expect(screen.getByTestId('mermaid-block')).toBeTruthy()
  })
})

describe('extractText', () => {
  it('extracts string from plain text', () => {
    expect(extractText('hello')).toBe('hello')
  })

  it('extracts string from nested React elements', () => {
    const node = (
      <span>
        <em>hello</em> world
      </span>
    )
    expect(extractText(node)).toBe('hello world')
  })

  it('returns empty string for null/undefined', () => {
    expect(extractText(null)).toBe('')
    expect(extractText(undefined)).toBe('')
  })
})
