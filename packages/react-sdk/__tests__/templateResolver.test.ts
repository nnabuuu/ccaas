/**
 * @kedge-agentic/react-sdk tests for templateResolver
 */

import { describe, it, expect } from 'vitest'
import {
  resolveSessionTemplate,
  mergeTemplateParams,
  type ResolvedTemplateParams,
} from '../src/utils/templateResolver'
import type { SessionTemplateMap, SessionTemplate } from '@kedge-agentic/common'
import type { McpServerConfig } from '../src/types'

describe('resolveSessionTemplate', () => {
  const mockTemplates: SessionTemplateMap = {
    'teacher-analysis': {
      description: '教师视图 - 完整分析功能',
      appendSystemPrompt: '你是教育领域的专业分析师',
      enabledSkills: ['knowledge-point-matching', 'complete-analysis'],
      mcpServers: {
        'quiz-analyzer-tools': {
          command: 'node',
          args: ['mcp-server/dist/index.js'],
        },
      },
    },
    'student-practice': {
      description: '学生视图 - 学习辅导功能',
      appendSystemPrompt: '你是一位耐心的学习伙伴',
      enabledSkills: ['analyze-student-answer'],
    },
  }

  it('should resolve valid template name', () => {
    const template = resolveSessionTemplate('teacher-analysis', mockTemplates)

    expect(template).toBeDefined()
    expect(template.description).toBe('教师视图 - 完整分析功能')
    expect(template.enabledSkills).toEqual(['knowledge-point-matching', 'complete-analysis'])
  })

  it('should throw error for invalid template name format', () => {
    expect(() => {
      resolveSessionTemplate('Teacher-Analysis', mockTemplates) // Capital letter
    }).toThrow(/Invalid session template name/)

    expect(() => {
      resolveSessionTemplate('teacher analysis', mockTemplates) // Space
    }).toThrow(/Invalid session template name/)

    expect(() => {
      resolveSessionTemplate('teacher.analysis', mockTemplates) // Dot
    }).toThrow(/Invalid session template name/)
  })

  it('should throw error for non-existent template', () => {
    expect(() => {
      resolveSessionTemplate('non-existent', mockTemplates)
    }).toThrow(/Session template "non-existent" not found/)
  })

  it('should list available templates in error message', () => {
    expect(() => {
      resolveSessionTemplate('non-existent', mockTemplates)
    }).toThrow(/teacher-analysis/)

    expect(() => {
      resolveSessionTemplate('non-existent', mockTemplates)
    }).toThrow(/student-practice/)
  })

  it('should throw error when templates map is empty', () => {
    expect(() => {
      resolveSessionTemplate('any-template', {})
    }).toThrow(/No session templates defined/)
  })

  it('should throw error when templates map is undefined', () => {
    expect(() => {
      resolveSessionTemplate('any-template', undefined)
    }).toThrow(/No session templates defined/)
  })

  it('should accept valid kebab-case names', () => {
    const validNames = [
      'simple',
      'with-dashes',
      'with_underscores',
      'with-123-numbers',
      'a1b2c3',
    ]

    validNames.forEach(name => {
      const templates = { [name]: { description: 'test' } }
      expect(() => resolveSessionTemplate(name, templates)).not.toThrow()
    })
  })
})

describe('mergeTemplateParams', () => {
  const mockTemplate: SessionTemplate = {
    description: '教师视图',
    appendSystemPrompt: 'Template prompt',
    enabledSkills: ['skill-a', 'skill-b'],
    mcpServers: {
      'template-server': {
        command: 'node',
        args: ['template.js'],
      },
    },
    skillPath: '/templates/path',
  }

  const mockSolutionDefaults = {
    mcpServers: {
      'default-server': {
        command: 'node',
        args: ['default.js'],
      },
    } as Record<string, McpServerConfig>,
    skillPath: '/default/path',
  }

  it('should use explicit params when provided (highest priority)', () => {
    const result = mergeTemplateParams(
      mockTemplate,
      {
        enabledSkills: ['explicit-skill'],
        mcpServers: {
          'explicit-server': {
            command: 'node',
            args: ['explicit.js'],
          },
        },
        skillPath: '/explicit/path',
      },
      mockSolutionDefaults
    )

    // enabledSkills: REPLACE strategy
    expect(result.enabledSkills).toEqual(['explicit-skill'])

    // mcpServers: MERGE strategy (all three layers)
    expect(result.mcpServers).toMatchObject({
      'default-server': { command: 'node', args: ['default.js'] },
      'template-server': { command: 'node', args: ['template.js'] },
      'explicit-server': { command: 'node', args: ['explicit.js'] },
    })

    // skillPath: REPLACE strategy
    expect(result.skillPath).toBe('/explicit/path')
  })

  it('should use template params when no explicit params', () => {
    const result = mergeTemplateParams(
      mockTemplate,
      {},
      mockSolutionDefaults
    )

    expect(result.enabledSkills).toEqual(['skill-a', 'skill-b'])
    expect(result.mcpServers).toMatchObject({
      'default-server': { command: 'node', args: ['default.js'] },
      'template-server': { command: 'node', args: ['template.js'] },
    })
    expect(result.skillPath).toBe('/templates/path')
  })

  it('should use solution defaults when no template or explicit params', () => {
    const result = mergeTemplateParams(
      undefined,
      {},
      mockSolutionDefaults
    )

    expect(result.enabledSkills).toBeUndefined()
    expect(result.mcpServers).toMatchObject({
      'default-server': { command: 'node', args: ['default.js'] },
    })
    expect(result.skillPath).toBe('/default/path')
  })

  it('should concatenate appendSystemPrompt from template and explicit', () => {
    const result = mergeTemplateParams(
      mockTemplate,
      { appendSystemPrompt: 'Explicit prompt' },
      undefined
    )

    expect(result.appendSystemPrompt).toBe('Template prompt\n\nExplicit prompt')
  })

  it('should only use template prompt if no explicit prompt', () => {
    const result = mergeTemplateParams(
      mockTemplate,
      {},
      undefined
    )

    expect(result.appendSystemPrompt).toBe('Template prompt')
  })

  it('should handle mcpServers shallow merge correctly', () => {
    const result = mergeTemplateParams(
      {
        mcpServers: {
          'server-a': { command: 'node', args: ['a.js'] },
          'server-b': { command: 'node', args: ['b.js'] },
        },
      },
      {
        mcpServers: {
          'server-b': { command: 'bun', args: ['b-override.js'] }, // Override
          'server-c': { command: 'node', args: ['c.js'] }, // Add new
        },
      },
      {
        mcpServers: {
          'server-default': { command: 'node', args: ['default.js'] },
        } as Record<string, McpServerConfig>,
      }
    )

    expect(result.mcpServers).toMatchObject({
      'server-default': { command: 'node', args: ['default.js'] },
      'server-a': { command: 'node', args: ['a.js'] },
      'server-b': { command: 'bun', args: ['b-override.js'] }, // Overridden
      'server-c': { command: 'node', args: ['c.js'] },
    })
  })

  it('should handle empty explicit params', () => {
    const result = mergeTemplateParams(
      mockTemplate,
      {},
      undefined
    )

    expect(result.enabledSkills).toEqual(['skill-a', 'skill-b'])
    expect(result.mcpServers).toMatchObject({
      'template-server': { command: 'node', args: ['template.js'] },
    })
  })

  it('should handle null skillPath as explicit "no skill path"', () => {
    const result = mergeTemplateParams(
      mockTemplate,
      { skillPath: null },
      mockSolutionDefaults
    )

    // Explicit null means "no skill path", should not use template or defaults
    expect(result.skillPath).toBeUndefined()
  })

  it('should replace enabledSkills, not merge', () => {
    const result = mergeTemplateParams(
      { enabledSkills: ['template-skill-1', 'template-skill-2'] },
      { enabledSkills: ['explicit-skill'] },
      undefined
    )

    // REPLACE strategy: only explicit skills
    expect(result.enabledSkills).toEqual(['explicit-skill'])
    expect(result.enabledSkills).not.toContain('template-skill-1')
    expect(result.enabledSkills).not.toContain('template-skill-2')
  })

  it('should handle empty enabledSkills array as fallback to template', () => {
    const result = mergeTemplateParams(
      { enabledSkills: ['template-skill'] },
      { enabledSkills: [] }, // Empty array has no effect, falls back to template
      undefined
    )

    // Empty array is ignored, template value is used
    expect(result.enabledSkills).toEqual(['template-skill'])
  })

  it('should return empty object when all inputs are empty', () => {
    const result = mergeTemplateParams(
      undefined,
      {},
      undefined
    )

    expect(result).toEqual({})
  })

  it('should handle partial template', () => {
    const partialTemplate: SessionTemplate = {
      description: 'Partial template',
      enabledSkills: ['skill-1'],
      // No mcpServers, no skillPath, no appendSystemPrompt
    }

    const result = mergeTemplateParams(
      partialTemplate,
      {},
      mockSolutionDefaults
    )

    expect(result.enabledSkills).toEqual(['skill-1'])
    expect(result.mcpServers).toMatchObject({
      'default-server': { command: 'node', args: ['default.js'] },
    })
    expect(result.skillPath).toBe('/default/path')
    expect(result.appendSystemPrompt).toBeUndefined()
  })

  it('should handle multiple prompt layers', () => {
    const templateWithPrompt: SessionTemplate = {
      appendSystemPrompt: 'Layer 1: Template',
    }

    const result = mergeTemplateParams(
      templateWithPrompt,
      { appendSystemPrompt: 'Layer 2: Explicit' },
      undefined
    )

    expect(result.appendSystemPrompt).toBe('Layer 1: Template\n\nLayer 2: Explicit')
  })
})

describe('mergeTemplateParams - Priority Rules', () => {
  it('should follow priority: explicit > template > defaults', () => {
    const template: SessionTemplate = {
      enabledSkills: ['template-skill'],
      mcpServers: {
        'shared': { command: 'template', args: [] },
        'template-only': { command: 'node', args: [] },
      },
      skillPath: '/template',
    }

    const explicit = {
      enabledSkills: ['explicit-skill'],
      mcpServers: {
        'shared': { command: 'explicit', args: [] },
        'explicit-only': { command: 'node', args: [] },
      } as Record<string, McpServerConfig>,
      skillPath: '/explicit',
    }

    const defaults = {
      mcpServers: {
        'shared': { command: 'default', args: [] },
        'default-only': { command: 'node', args: [] },
      } as Record<string, McpServerConfig>,
      skillPath: '/default',
    }

    const result = mergeTemplateParams(template, explicit, defaults)

    // enabledSkills: explicit wins
    expect(result.enabledSkills).toEqual(['explicit-skill'])

    // mcpServers: explicit > template > defaults (all merged, explicit overwrites)
    expect(result.mcpServers?.['shared']?.command).toBe('explicit')
    expect(result.mcpServers?.['template-only']).toBeDefined()
    expect(result.mcpServers?.['explicit-only']).toBeDefined()
    expect(result.mcpServers?.['default-only']).toBeDefined()

    // skillPath: explicit wins
    expect(result.skillPath).toBe('/explicit')
  })
})
