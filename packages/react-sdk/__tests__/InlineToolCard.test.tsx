import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineToolCard } from '../src/components/InlineToolCard'
import type { ToolActivity } from '../src/types'

describe('InlineToolCard', () => {
  const baseToolActivity: ToolActivity = {
    toolName: 'Read',
    toolId: 'tool-1',
    phase: 'end',
    timestamp: new Date(),
    duration: 50,
    success: true,
  }

  describe('Basic Rendering', () => {
    it('should render tool name and icon', () => {
      render(<InlineToolCard tool={baseToolActivity} />)
      expect(screen.getByText('Read')).toBeInTheDocument()
      expect(screen.getByText('📖')).toBeInTheDocument()
    })

    it('should display tool summary for file operations', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: { file_path: '/path/to/file.md' },
      }
      render(<InlineToolCard tool={tool} />)
      expect(screen.getByText('.../to/file.md')).toBeInTheDocument()
    })

    it('should display duration in ms', () => {
      render(<InlineToolCard tool={{ ...baseToolActivity, duration: 50 }} />)
      expect(screen.getByText('50ms')).toBeInTheDocument()
    })

    it('should display duration in seconds for > 1000ms', () => {
      render(<InlineToolCard tool={{ ...baseToolActivity, duration: 1500 }} />)
      expect(screen.getByText('1.5s')).toBeInTheDocument()
    })
  })

  describe('Phase Indicators', () => {
    it('should show loading spinner when phase=start', () => {
      const tool: ToolActivity = { ...baseToolActivity, phase: 'start' }
      const { container } = render(<InlineToolCard tool={tool} />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should show ✅ when success=true', () => {
      const tool: ToolActivity = { ...baseToolActivity, success: true }
      render(<InlineToolCard tool={tool} />)
      expect(screen.getByText('✅')).toBeInTheDocument()
    })

    it('should show ❌ when success=false', () => {
      const tool: ToolActivity = { ...baseToolActivity, success: false }
      render(<InlineToolCard tool={tool} />)
      expect(screen.getByText('❌')).toBeInTheDocument()
    })
  })

  describe('Expandable Details', () => {
    it('should show expand arrow when hasDetails', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: { file_path: '/path/to/file.md' },
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const arrow = container.querySelector('svg[viewBox="0 0 16 16"]')
      expect(arrow).toBeInTheDocument()
    })

    it('should not show arrow when no details', () => {
      const { container } = render(<InlineToolCard tool={baseToolActivity} />)
      const arrow = container.querySelector('svg[viewBox="0 0 16 16"]')
      expect(arrow).not.toBeInTheDocument()
    })

    it('should toggle expand on click when hasDetails', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: { file_path: '/path/to/file.md' },
        toolOutput: 'File content here',
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const card = container.querySelector('.cursor-pointer')

      // Initially collapsed
      expect(screen.queryByText('输入:')).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(card!)
      expect(screen.getByText('输入:')).toBeInTheDocument()
      expect(screen.getByText('输出:')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(card!)
      expect(screen.queryByText('输入:')).not.toBeInTheDocument()
    })

    it('should rotate arrow when expanded', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: { file_path: '/path/to/file.md' },
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const arrow = container.querySelector('svg[viewBox="0 0 16 16"]')
      const card = container.querySelector('.cursor-pointer')

      // Initially not rotated
      expect(arrow).not.toHaveClass('rotate-90')

      // Click to expand
      fireEvent.click(card!)
      expect(arrow).toHaveClass('rotate-90')
    })

    it('should apply hover style when hasDetails', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: { file_path: '/path/to/file.md' },
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const card = container.querySelector('.cursor-pointer')
      expect(card).toHaveClass('hover:bg-gray-50')
    })

    it('should not be clickable when no details', () => {
      const { container } = render(<InlineToolCard tool={baseToolActivity} />)
      const card = container.querySelector('.flex.items-center')
      expect(card).not.toHaveClass('cursor-pointer')
    })
  })

  describe('Details Panel Content', () => {
    it('should display toolInput when expanded', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: { file_path: '/path/to/file.md', limit: 100 },
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const card = container.querySelector('.cursor-pointer')
      fireEvent.click(card!)

      expect(screen.getByText('输入:')).toBeInTheDocument()
      const pre = container.querySelector('pre')
      // simplifyToolInput formats it as "文件路径: /path/to/file.md"
      expect(pre?.textContent).toContain('/path/to/file.md')
    })

    it('should display toolOutput when expanded', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolOutput: 'File content here',
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const card = container.querySelector('.cursor-pointer')
      fireEvent.click(card!)

      expect(screen.getByText('输出:')).toBeInTheDocument()
      expect(screen.getByText('File content here')).toBeInTheDocument()
    })

    it('should display toolError when expanded', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolError: 'File not found',
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const card = container.querySelector('.cursor-pointer')
      fireEvent.click(card!)

      expect(screen.getByText('错误:')).toBeInTheDocument()
      expect(screen.getByText('File not found')).toBeInTheDocument()
    })

    it('should format toolInput using simplifyToolInput', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: { file_path: '/path/to/file.md', limit: 100 },
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const card = container.querySelector('.cursor-pointer')
      fireEvent.click(card!)

      const pre = container.querySelector('pre')
      // simplifyToolInput formats Read/Write/Edit inputs specially
      expect(pre?.textContent).toContain('/path/to/file.md')
    })

    it('should display string toolInput as-is', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolInput: 'Simple string input',
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const card = container.querySelector('.cursor-pointer')
      fireEvent.click(card!)

      expect(screen.getByText('Simple string input')).toBeInTheDocument()
    })
  })

  describe('Summary Generation', () => {
    it('should show file path summary for Read/Write/Edit', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolName: 'Write',
        toolInput: { file_path: '/very/long/path/to/file.md' },
      }
      render(<InlineToolCard tool={tool} />)
      expect(screen.getByText('.../to/file.md')).toBeInTheDocument()
    })

    it('should show command summary for Bash', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolName: 'Bash',
        toolInput: { command: 'npm test' },
      }
      render(<InlineToolCard tool={tool} />)
      expect(screen.getByText('npm test')).toBeInTheDocument()
    })

    it('should truncate long Bash commands', () => {
      const longCmd = 'a'.repeat(60)
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolName: 'Bash',
        toolInput: { command: longCmd },
      }
      const { container } = render(<InlineToolCard tool={tool} />)
      const summary = container.querySelector('.truncate')
      expect(summary?.textContent).toContain('...')
    })

    it('should show pattern for Glob/Grep', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        toolName: 'Glob',
        toolInput: { pattern: '**/*.ts' },
      }
      render(<InlineToolCard tool={tool} />)
      expect(screen.getByText('**/*.ts')).toBeInTheDocument()
    })

    it('should prefer description over computed summary', () => {
      const tool: ToolActivity = {
        ...baseToolActivity,
        description: 'Custom description',
        toolInput: { file_path: '/path/to/file.md' },
      }
      render(<InlineToolCard tool={tool} />)
      expect(screen.getByText('Custom description')).toBeInTheDocument()
      expect(screen.queryByText('.../to/file.md')).not.toBeInTheDocument()
    })
  })
})
