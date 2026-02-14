/**
 * Tests for toolDisplay utilities
 */
import { describe, it, expect } from 'vitest'
import { stripMcpPrefix, simplifyToolInput, simplifyToolOutput } from '../src/utils/toolDisplay'

describe('toolDisplay utilities', () => {
  describe('stripMcpPrefix', () => {
    it('should strip MCP prefix from tool name', () => {
      expect(stripMcpPrefix('mcp__server__Read')).toBe('Read')
      expect(stripMcpPrefix('mcp__chrome__navigate')).toBe('navigate')
      expect(stripMcpPrefix('mcp__linear__get_issue')).toBe('get_issue')
    })

    it('should return original name if no MCP prefix', () => {
      expect(stripMcpPrefix('Read')).toBe('Read')
      expect(stripMcpPrefix('Bash')).toBe('Bash')
      expect(stripMcpPrefix('CustomTool')).toBe('CustomTool')
    })

    it('should handle edge cases', () => {
      expect(stripMcpPrefix('')).toBe('')
      expect(stripMcpPrefix('mcp__')).toBe('mcp__')
      expect(stripMcpPrefix('mcp')).toBe('mcp')
    })
  })

  describe('simplifyToolInput', () => {
    describe('null and undefined handling', () => {
      it('should return (无输入) for null', () => {
        expect(simplifyToolInput('Read', null)).toBe('(无输入)')
      })

      it('should return (无输入) for undefined', () => {
        expect(simplifyToolInput('Read', undefined)).toBe('(无输入)')
      })
    })

    describe('non-object inputs', () => {
      it('should convert string to String', () => {
        expect(simplifyToolInput('Read', 'test')).toBe('test')
      })

      it('should convert number to String', () => {
        expect(simplifyToolInput('Read', 123)).toBe('123')
      })

      it('should convert boolean to String', () => {
        expect(simplifyToolInput('Read', true)).toBe('true')
        expect(simplifyToolInput('Read', false)).toBe('false')
      })

      it('should handle 0 correctly (not treat as falsy)', () => {
        expect(simplifyToolInput('Read', 0)).toBe('0')
      })
    })

    describe('Read/Write/Edit tools', () => {
      it('should show file path for Read tool', () => {
        expect(simplifyToolInput('Read', { file_path: '/path/to/file.ts' }))
          .toBe('文件路径: /path/to/file.ts')
      })

      it('should show file path for Write tool', () => {
        expect(simplifyToolInput('Write', { file_path: '/path/to/file.ts' }))
          .toBe('文件路径: /path/to/file.ts')
      })

      it('should show file path for Edit tool', () => {
        expect(simplifyToolInput('Edit', { file_path: '/path/to/file.ts' }))
          .toBe('文件路径: /path/to/file.ts')
      })

      it('should fallback to path field if file_path missing', () => {
        expect(simplifyToolInput('Read', { path: '/alternative/path.ts' }))
          .toBe('文件路径: /alternative/path.ts')
      })

      it('should show unknown if no path provided', () => {
        expect(simplifyToolInput('Read', {})).toBe('文件路径: unknown')
      })

      it('should strip MCP prefix from tool name', () => {
        expect(simplifyToolInput('mcp__server__Read', { file_path: '/test.ts' }))
          .toBe('文件路径: /test.ts')
      })
    })

    describe('Bash tool', () => {
      it('should show command', () => {
        expect(simplifyToolInput('Bash', { command: 'npm install' }))
          .toBe('命令: npm install')
      })

      it('should show unknown if no command', () => {
        expect(simplifyToolInput('Bash', {})).toBe('命令: unknown')
      })
    })

    describe('Grep/Glob tools', () => {
      it('should show pattern and path for Grep', () => {
        expect(simplifyToolInput('Grep', { pattern: '*.ts', path: './src' }))
          .toBe('搜索模式: *.ts\n路径: ./src')
      })

      it('should show pattern and path for Glob', () => {
        expect(simplifyToolInput('Glob', { pattern: '**/*.test.ts', path: './tests' }))
          .toBe('搜索模式: **/*.test.ts\n路径: ./tests')
      })

      it('should default path to . if not provided', () => {
        expect(simplifyToolInput('Grep', { pattern: '*.ts' }))
          .toBe('搜索模式: *.ts\n路径: .')
      })

      it('should show unknown if no pattern', () => {
        expect(simplifyToolInput('Grep', {})).toBe('搜索模式: unknown\n路径: .')
      })
    })

    describe('Task tool', () => {
      it('should show description', () => {
        expect(simplifyToolInput('Task', { description: 'Run tests' }))
          .toBe('描述: Run tests')
      })

      it('should fallback to prompt field', () => {
        expect(simplifyToolInput('Task', { prompt: 'Build project' }))
          .toBe('描述: Build project')
      })

      it('should show unknown if neither field present', () => {
        expect(simplifyToolInput('Task', {})).toBe('描述: unknown')
      })
    })

    describe('Unknown tools', () => {
      it('should return JSON for unknown tools', () => {
        const input = { custom: 'value', number: 42 }
        expect(simplifyToolInput('UnknownTool', input))
          .toBe(JSON.stringify(input, null, 2))
      })
    })
  })

  describe('simplifyToolOutput', () => {
    describe('null and undefined handling', () => {
      it('should return (无输出) for null', () => {
        expect(simplifyToolOutput(null)).toBe('(无输出)')
      })

      it('should return (无输出) for undefined', () => {
        expect(simplifyToolOutput(undefined)).toBe('(无输出)')
      })
    })

    describe('falsy values should NOT be treated as empty', () => {
      it('should handle 0 correctly', () => {
        expect(simplifyToolOutput(0)).toBe('0')
      })

      it('should handle false correctly', () => {
        expect(simplifyToolOutput(false)).toBe('false')
      })

      it('should handle empty string correctly', () => {
        expect(simplifyToolOutput('')).toBe('')
      })
    })

    describe('string outputs', () => {
      it('should return short strings as-is', () => {
        expect(simplifyToolOutput('Hello world')).toBe('Hello world')
      })

      it('should truncate long strings at 500 chars', () => {
        const longString = 'a'.repeat(600)
        const result = simplifyToolOutput(longString)
        expect(result).toContain('a'.repeat(500))
        expect(result).toContain('... (输出已截断，共 600 字符)')
      })

      it('should not truncate strings under 500 chars', () => {
        const mediumString = 'a'.repeat(499)
        expect(simplifyToolOutput(mediumString)).toBe(mediumString)
      })
    })

    describe('object outputs', () => {
      it('should return JSON for small objects', () => {
        const obj = { name: 'test', value: 42 }
        expect(simplifyToolOutput(obj)).toBe(JSON.stringify(obj, null, 2))
      })

      it('should truncate large JSON objects', () => {
        const largeObj = { data: 'x'.repeat(600) }
        const result = simplifyToolOutput(largeObj)
        expect(result).toContain('... (输出已截断)')
        expect(result.length).toBeLessThan(600)
      })
    })

    describe('other types', () => {
      it('should convert numbers to string', () => {
        expect(simplifyToolOutput(123)).toBe('123')
      })

      it('should convert booleans to string', () => {
        expect(simplifyToolOutput(true)).toBe('true')
      })
    })
  })
})
