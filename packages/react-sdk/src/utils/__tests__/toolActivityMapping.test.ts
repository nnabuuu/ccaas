import { describe, it, expect } from 'vitest'
import { getToolActivityDescription, TOOL_ACTIVITY_MAP } from '../toolActivityMapping'

describe('toolActivityMapping', () => {
  describe('TOOL_ACTIVITY_MAP constants', () => {
    it('should have mappings for common tools', () => {
      expect(TOOL_ACTIVITY_MAP['Read']).toBe('正在阅读')
      expect(TOOL_ACTIVITY_MAP['Write']).toBe('正在生成')
      expect(TOOL_ACTIVITY_MAP['Edit']).toBe('正在修改')
      expect(TOOL_ACTIVITY_MAP['Grep']).toBe('正在搜索')
      expect(TOOL_ACTIVITY_MAP['Glob']).toBe('正在查找文件')
      expect(TOOL_ACTIVITY_MAP['Bash']).toBe('正在执行命令')
      expect(TOOL_ACTIVITY_MAP['Task']).toBe('正在执行任务')
      expect(TOOL_ACTIVITY_MAP['Skill']).toBe('正在调用技能')
      expect(TOOL_ACTIVITY_MAP['WebSearch']).toBe('正在搜索网页')
      expect(TOOL_ACTIVITY_MAP['computer']).toBe('正在操作浏览器')
      expect(TOOL_ACTIVITY_MAP['screenshot']).toBe('正在截图')
      expect(TOOL_ACTIVITY_MAP['navigate']).toBe('正在导航')
    })

    it('should have a default fallback', () => {
      expect(TOOL_ACTIVITY_MAP['_default']).toBe('正在处理')
    })
  })

  describe('getToolActivityDescription', () => {
    it('should return custom description when provided', () => {
      const customDesc = '正在读取配置文件'
      expect(getToolActivityDescription('Read', customDesc)).toBe(customDesc)
      expect(getToolActivityDescription('UnknownTool', customDesc)).toBe(customDesc)
    })

    it('should return mapped description for known tools', () => {
      expect(getToolActivityDescription('Read')).toBe('正在阅读')
      expect(getToolActivityDescription('Write')).toBe('正在生成')
      expect(getToolActivityDescription('Grep')).toBe('正在搜索')
    })

    it('should return default description for unknown tools', () => {
      expect(getToolActivityDescription('UnknownTool')).toBe('正在处理')
      expect(getToolActivityDescription('RandomTool')).toBe('正在处理')
      expect(getToolActivityDescription('')).toBe('正在处理')
    })

    it('should prioritize custom description over mapping', () => {
      const customDesc = '自定义操作'
      expect(getToolActivityDescription('Read', customDesc)).toBe(customDesc)
      expect(getToolActivityDescription('Read', customDesc)).not.toBe(TOOL_ACTIVITY_MAP['Read'])
    })

    it('should handle all mapped tools correctly', () => {
      Object.keys(TOOL_ACTIVITY_MAP).forEach(toolName => {
        if (toolName !== '_default') {
          const description = getToolActivityDescription(toolName)
          expect(description).toBe(TOOL_ACTIVITY_MAP[toolName])
        }
      })
    })
  })
})
