import {
  SolutionConfigV2Schema,
  SolutionConfigV1Schema,
  SolutionConfigV3Schema,
  detectSchemaVersion,
  validateSolutionConfig,
  TenantConfigSchema,
  DiscoveryConfigSchema,
  SkillDefinitionSchema,
  McpServerDefinitionSchema,
  InternalConfigSchema,
  CcaasConfigSchema,
  SetupConfigSchema,
  SessionTemplateSchema,
} from './solution-config.dto';

// ============================================================================
// Test Fixtures
// ============================================================================

const validV2Config = {
  schemaVersion: '2.0' as const,
  ccaas: {
    tenant: {
      name: 'Quiz Analyzer',
      slug: 'quiz-analyzer',
      description: 'Educational quiz analysis system',
    },
    discovery: {
      enabled: true,
      mode: 'auto' as const,
      skills: [
        {
          name: 'Three Column Analysis',
          slug: 'three-column-analysis',
          description: 'Analyze quiz with three-column layout',
          skillFile: 'skills/three-column-analysis/SKILL.md',
          scope: 'solution' as const,
          triggers: [
            { type: 'keyword' as const, value: '分析这道题', priority: 10 },
            { type: 'keyword' as const, value: '解题思路', priority: 9 },
          ],
          allowedTools: ['write_output', 'parse_quiz_content'],
        },
      ],
      mcpServers: {
        'quiz-analyzer-tools': {
          command: 'node',
          args: ['mcp-server/dist/index.js'],
          description: 'Quiz Analyzer MCP tools',
          type: 'stdio' as const,
          env: { MCP_PORT: '3006' },
        },
      },
    },
  },
  internal: {
    syncFields: [
      'parsedQuiz',
      'catalog',
      'difficulty',
    ],
    setup: {
      skipSteps: [],
      customScripts: {
        preInstall: '.solution-hooks/pre-install.sh',
        postInstall: '.solution-hooks/post-install.sh',
      },
    },
  },
};

const validV1Config = {
  name: 'Lesson Plan Designer',
  slug: 'lesson-plan-designer',
  version: '1.0.0',
  description: 'AI备课助手',
  mcpServers: {
    'lesson-plan-tools': {
      command: 'node',
      args: ['mcp-server/dist/index.js'],
      description: 'Lesson Plan Designer MCP tools',
      type: 'stdio' as const,
      env: {},
    },
  },
  skills: [
    {
      name: 'Lesson Plan Designer',
      slug: 'lesson-plan-designer',
      description: 'AI备课助手',
      skillFile: 'skills/lesson-plan-designer/SKILL.md',
      scope: 'solution' as const,
      triggers: [
        { type: 'keyword' as const, value: '备课', priority: 10 },
      ],
      allowedTools: ['write_output', 'Read'],
    },
  ],
  syncFields: ['title', 'subject', 'objectives'],
};

// ============================================================================
// Schema Version Detection Tests
// ============================================================================

describe('detectSchemaVersion', () => {
  it('should return 2.0 for explicit schemaVersion field', () => {
    expect(detectSchemaVersion({ schemaVersion: '2.0' })).toBe('2.0');
  });

  it('should return 2.0 when ccaas key is present', () => {
    expect(detectSchemaVersion({ ccaas: { tenant: {} } })).toBe('2.0');
  });

  it('should return 1.0 for v1 config with name/slug', () => {
    expect(detectSchemaVersion({ name: 'Test', slug: 'test' })).toBe('1.0');
  });

  it('should return 1.0 for null input', () => {
    expect(detectSchemaVersion(null)).toBe('1.0');
  });

  it('should return 1.0 for non-object input', () => {
    expect(detectSchemaVersion('string')).toBe('1.0');
    expect(detectSchemaVersion(42)).toBe('1.0');
    expect(detectSchemaVersion(undefined)).toBe('1.0');
  });

  it('should return 1.0 for empty object', () => {
    expect(detectSchemaVersion({})).toBe('1.0');
  });

  it('should return 1.0 when ccaas is null', () => {
    expect(detectSchemaVersion({ ccaas: null })).toBe('1.0');
  });

  it('should return 1.0 when ccaas is not an object', () => {
    expect(detectSchemaVersion({ ccaas: 'string' })).toBe('1.0');
  });

  it('should prioritize schemaVersion over ccaas key presence', () => {
    expect(detectSchemaVersion({
      schemaVersion: '2.0',
      ccaas: { tenant: {} },
    })).toBe('2.0');
  });
});

// ============================================================================
// TenantConfig Schema Tests
// ============================================================================

describe('TenantConfigSchema', () => {
  it('should validate a valid tenant config', () => {
    const result = TenantConfigSchema.safeParse({
      name: 'Quiz Analyzer',
      slug: 'quiz-analyzer',
      description: 'Educational quiz analysis',
    });
    expect(result.success).toBe(true);
  });

  it('should accept tenant without description', () => {
    const result = TenantConfigSchema.safeParse({
      name: 'Quiz Analyzer',
      slug: 'quiz-analyzer',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = TenantConfigSchema.safeParse({
      name: '',
      slug: 'quiz-analyzer',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty slug', () => {
    const result = TenantConfigSchema.safeParse({
      name: 'Quiz',
      slug: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject slug with uppercase', () => {
    const result = TenantConfigSchema.safeParse({
      name: 'Quiz',
      slug: 'Quiz-Analyzer',
    });
    expect(result.success).toBe(false);
  });

  it('should reject slug with spaces', () => {
    const result = TenantConfigSchema.safeParse({
      name: 'Quiz',
      slug: 'quiz analyzer',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing name', () => {
    const result = TenantConfigSchema.safeParse({
      slug: 'quiz-analyzer',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// DiscoveryConfig Schema Tests
// ============================================================================

describe('DiscoveryConfigSchema', () => {
  it('should validate full discovery config', () => {
    const result = DiscoveryConfigSchema.safeParse({
      enabled: true,
      mode: 'auto',
      skills: [],
      mcpServers: {},
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults for empty object', () => {
    const result = DiscoveryConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.mode).toBe('auto');
      expect(result.data.skills).toEqual([]);
      expect(result.data.mcpServers).toEqual({});
    }
  });

  it('should accept mode manual', () => {
    const result = DiscoveryConfigSchema.safeParse({
      enabled: false,
      mode: 'manual',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid mode', () => {
    const result = DiscoveryConfigSchema.safeParse({
      mode: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// SkillDefinition Schema Tests
// ============================================================================

describe('SkillDefinitionSchema', () => {
  it('should validate a complete skill definition', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: 'Three Column Analysis',
      slug: 'three-column-analysis',
      description: 'Analyze quiz with three-column layout',
      skillFile: 'skills/three-column-analysis/SKILL.md',
      scope: 'solution',
      triggers: [
        { type: 'keyword', value: '分析', priority: 10 },
      ],
      allowedTools: ['write_output'],
    });
    expect(result.success).toBe(true);
  });

  it('should validate minimal skill (name + slug only)', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: 'My Skill',
      slug: 'my-skill',
    });
    expect(result.success).toBe(true);
  });

  it('should default scope to tenant', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: 'My Skill',
      slug: 'my-skill',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scope).toBe('solution');
    }
  });

  it('should reject empty name', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: '',
      slug: 'my-skill',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug format', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: 'My Skill',
      slug: 'My_Skill',
    });
    expect(result.success).toBe(false);
  });

  it('should accept skill with chained skills', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: 'Full Workflow',
      slug: 'full-workflow',
      chainedSkills: {
        notebooklm: {
          description: 'Generate audio',
          triggerPhrase: 'Generate audio',
          inputFrom: 'Lesson plan content',
          outputTo: '.agent-workspace/outputs/audio.mp3',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept skill with output format', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: 'Answer Analysis',
      slug: 'answer-analysis',
      outputFormat: 'StudentAnswer',
    });
    expect(result.success).toBe(true);
  });
});


// ============================================================================
// McpServerDefinition Schema Tests
// ============================================================================

describe('McpServerDefinitionSchema', () => {
  it('should validate a complete MCP server definition', () => {
    const result = McpServerDefinitionSchema.safeParse({
      command: 'node',
      args: ['mcp-server/dist/index.js'],
      description: 'Quiz Analyzer MCP tools',
      type: 'stdio',
      env: { MCP_PORT: '3006' },
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults for minimal config', () => {
    const result = McpServerDefinitionSchema.safeParse({
      command: 'node',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual([]);
      expect(result.data.type).toBe('stdio');
    }
  });

  it('should reject empty command', () => {
    const result = McpServerDefinitionSchema.safeParse({
      command: '',
    });
    expect(result.success).toBe(false);
  });

  it('should accept rest-adapter type', () => {
    const result = McpServerDefinitionSchema.safeParse({
      command: 'node',
      type: 'rest-adapter',
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// SetupConfig Schema Tests
// ============================================================================

describe('SetupConfigSchema', () => {
  it('should validate full setup config', () => {
    const result = SetupConfigSchema.safeParse({
      skipSteps: ['build'],
      customScripts: {
        preInstall: '.solution-hooks/pre-install.sh',
        customInit: '.solution-hooks/custom-init.sh',
        postInstall: '.solution-hooks/post-install.sh',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults for empty object', () => {
    const result = SetupConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skipSteps).toEqual([]);
    }
  });
});

// ============================================================================
// InternalConfig Schema Tests
// ============================================================================

describe('InternalConfigSchema', () => {
  it('should validate complete internal config', () => {
    const result = InternalConfigSchema.safeParse({
      syncFields: ['field1', 'field2'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept syncFields as record (grouped format)', () => {
    const result = InternalConfigSchema.safeParse({
      syncFields: {
        lessonPlan: ['title', 'subject'],
        problemExplain: ['analysis', 'steps'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty internal config', () => {
    const result = InternalConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// CcaasConfig Schema Tests
// ============================================================================

describe('CcaasConfigSchema', () => {
  it('should validate complete ccaas config', () => {
    const result = CcaasConfigSchema.safeParse({
      tenant: {
        name: 'Quiz Analyzer',
        slug: 'quiz-analyzer',
      },
      discovery: {
        enabled: true,
        mode: 'auto',
        skills: [],
        mcpServers: {},
      },
    });
    expect(result.success).toBe(true);
  });

  it('should apply discovery defaults when only tenant provided', () => {
    const result = CcaasConfigSchema.safeParse({
      tenant: {
        name: 'Quiz Analyzer',
        slug: 'quiz-analyzer',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discovery.enabled).toBe(true);
      expect(result.data.discovery.mode).toBe('auto');
      expect(result.data.discovery.skills).toEqual([]);
      expect(result.data.discovery.mcpServers).toEqual({});
    }
  });

  it('should reject missing tenant', () => {
    const result = CcaasConfigSchema.safeParse({
      discovery: { enabled: true },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// SolutionConfigV2 Schema Tests
// ============================================================================

describe('SolutionConfigV2Schema', () => {
  it('should validate a complete v2 config', () => {
    const result = SolutionConfigV2Schema.safeParse(validV2Config);
    expect(result.success).toBe(true);
  });

  it('should validate minimal v2 config (tenant only)', () => {
    const result = SolutionConfigV2Schema.safeParse({
      schemaVersion: '2.0',
      ccaas: {
        tenant: {
          name: 'My Solution',
          slug: 'my-solution',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing schemaVersion', () => {
    const result = SolutionConfigV2Schema.safeParse({
      ccaas: {
        tenant: {
          name: 'My Solution',
          slug: 'my-solution',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong schemaVersion', () => {
    const result = SolutionConfigV2Schema.safeParse({
      schemaVersion: '1.0',
      ccaas: {
        tenant: {
          name: 'My Solution',
          slug: 'my-solution',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing ccaas section', () => {
    const result = SolutionConfigV2Schema.safeParse({
      schemaVersion: '2.0',
    });
    expect(result.success).toBe(false);
  });

  it('should accept $schema field', () => {
    const result = SolutionConfigV2Schema.safeParse({
      $schema: 'https://ccaas.dev/schemas/solution.v2.json',
      schemaVersion: '2.0',
      ccaas: {
        tenant: {
          name: 'Test',
          slug: 'test',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate v2 config with multiple skills', () => {
    const result = SolutionConfigV2Schema.safeParse({
      schemaVersion: '2.0',
      ccaas: {
        tenant: {
          name: 'Quiz Analyzer',
          slug: 'quiz-analyzer',
        },
        discovery: {
          enabled: true,
          mode: 'auto',
          skills: [
            {
              name: 'Skill A',
              slug: 'skill-a',
              triggers: [{ type: 'keyword', value: 'analyze', priority: 10 }],
            },
            {
              name: 'Skill B',
              slug: 'skill-b',
              triggers: [{ type: 'pattern', value: 'review.*code' }],
            },
          ],
          mcpServers: {
            'server-a': { command: 'node', args: ['dist/a.js'] },
            'server-b': { command: 'python', args: ['server.py'] },
          },
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ccaas.discovery.skills).toHaveLength(2);
      expect(Object.keys(result.data.ccaas.discovery.mcpServers)).toHaveLength(2);
    }
  });

  it('should preserve all fields in parsed output', () => {
    const result = SolutionConfigV2Schema.safeParse(validV2Config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ccaas.tenant.name).toBe('Quiz Analyzer');
      expect(result.data.ccaas.tenant.slug).toBe('quiz-analyzer');
      expect(result.data.ccaas.discovery.skills).toHaveLength(1);
      expect(result.data.ccaas.discovery.skills[0].slug).toBe('three-column-analysis');
      expect(result.data.internal?.syncFields).toEqual(['parsedQuiz', 'catalog', 'difficulty']);
    }
  });
});

// ============================================================================
// SolutionConfigV1 Schema Tests
// ============================================================================

describe('SolutionConfigV1Schema', () => {
  it('should validate a complete v1 config', () => {
    const result = SolutionConfigV1Schema.safeParse(validV1Config);
    expect(result.success).toBe(true);
  });

  it('should validate minimal v1 config (name + slug only)', () => {
    const result = SolutionConfigV1Schema.safeParse({
      name: 'Test',
      slug: 'test',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = SolutionConfigV1Schema.safeParse({
      slug: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing slug', () => {
    const result = SolutionConfigV1Schema.safeParse({
      name: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('should accept single skill object (v1 legacy format)', () => {
    const result = SolutionConfigV1Schema.safeParse({
      name: 'Problem Explainer',
      slug: 'problem-explainer',
      skill: {
        name: 'Problem Explainer',
        slug: 'problem-explainer',
        description: 'AI problem explanation',
        triggers: ['keyword1', 'keyword2'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept skills as array (v1 current format)', () => {
    const result = SolutionConfigV1Schema.safeParse({
      name: 'Quiz',
      slug: 'quiz',
      skills: [
        { name: 'Skill A', slug: 'skill-a' },
        { name: 'Skill B', slug: 'skill-b' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept syncFields as record format', () => {
    const result = SolutionConfigV1Schema.safeParse({
      name: 'Edu Agent',
      slug: 'edu-agent',
      syncFields: {
        lessonPlan: ['title', 'subject'],
        problemExplain: ['analysis'],
      },
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// validateSolutionConfig Integration Tests
// ============================================================================

describe('validateSolutionConfig', () => {
  it('should successfully validate v2 config', () => {
    const result = validateSolutionConfig(validV2Config);
    expect(result.success).toBe(true);
    expect(result.version).toBe('2.0');
    if (result.success && result.version === '2.0') {
      expect(result.data.schemaVersion).toBe('2.0');
    }
  });

  it('should successfully validate v1 config', () => {
    const result = validateSolutionConfig(validV1Config);
    expect(result.success).toBe(true);
    expect(result.version).toBe('1.0');
    if (result.success && result.version === '1.0') {
      expect(result.data.name).toBe('Lesson Plan Designer');
    }
  });

  it('should return errors for invalid v2 config', () => {
    const result = validateSolutionConfig({
      schemaVersion: '2.0',
      // missing ccaas
    });
    expect(result.success).toBe(false);
    expect(result.version).toBe('2.0');
    if (!result.success) {
      expect(result.errors.issues.length).toBeGreaterThan(0);
    }
  });

  it('should return errors for invalid v1 config', () => {
    const result = validateSolutionConfig({
      // missing name and slug
      backend: { port: 3001 },
    });
    expect(result.success).toBe(false);
    expect(result.version).toBe('1.0');
    if (!result.success) {
      expect(result.errors.issues.length).toBeGreaterThan(0);
    }
  });

  it('should return detailed error messages', () => {
    const result = validateSolutionConfig({
      schemaVersion: '2.0',
      ccaas: {
        tenant: {
          // name missing
          slug: 'INVALID SLUG',
        },
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.errors.issues.map(i => i.path.join('.'));
      expect(paths).toContain('ccaas.tenant.name');
    }
  });

  it('should handle non-object input gracefully', () => {
    const result = validateSolutionConfig('not an object');
    expect(result.success).toBe(false);
    expect(result.version).toBe('1.0');
  });

  it('should handle null input gracefully', () => {
    const result = validateSolutionConfig(null);
    expect(result.success).toBe(false);
    expect(result.version).toBe('1.0');
  });
});

// ============================================================================
// Real-World Solution Config Tests (based on actual v1 configs in repo)
// ============================================================================

describe('Real-world v1 solution configs', () => {
  it('should validate quiz-analyzer solution.json structure', () => {
    const quizAnalyzer = {
      $schema: 'https://ccaas.dev/schemas/solution.v1.json',
      name: 'Quiz Analyzer',
      slug: 'quiz-analyzer',
      version: '1.0.0',
      description: 'Educational quiz analysis system',
      mcpServers: {
        'quiz-analyzer-tools': {
          command: 'node',
          args: ['mcp-server/dist/index.js'],
          description: 'Quiz Analyzer MCP tools',
          type: 'stdio',
          env: { MCP_PORT: '3006' },
        },
      },
      skills: [
        {
          name: 'Quiz Analyzer - Three Column Analysis',
          slug: 'three-column-analysis',
          description: 'Three-column analysis',
          skillFile: 'skills/three-column-analysis/SKILL.md',
          scope: 'solution',
          triggers: [
            { type: 'keyword', value: '分析这道题', priority: 10 },
          ],
          allowedTools: ['parse_quiz_content', 'write_output'],
        },
      ],
      syncFields: ['parsedQuiz', 'catalog', 'difficulty'],
      setup: {
        skipSteps: [],
        customScripts: {
          preInstall: '.solution-hooks/pre-install.sh',
          postInstall: '.solution-hooks/post-install.sh',
        },
      },
    };

    const result = SolutionConfigV1Schema.safeParse(quizAnalyzer);
    expect(result.success).toBe(true);
  });

  it('should validate lesson-plan-designer solution.json structure', () => {
    const lessonPlanDesigner = {
      $schema: 'https://ccaas.dev/schemas/solution.v1.json',
      name: 'Lesson Plan Designer',
      slug: 'lesson-plan-designer',
      version: '1.0.0',
      description: 'AI备课助手',
      mcpServers: {
        'lesson-plan-tools': {
          command: 'node',
          args: ['mcp-server/dist/index.js'],
          description: 'Lesson Plan Designer MCP tools',
          type: 'stdio',
          env: {},
        },
      },
      skills: [
        {
          name: 'Lesson Plan Designer',
          slug: 'lesson-plan-designer',
          description: 'AI备课助手',
          skillFile: 'skills/lesson-plan-designer/SKILL.md',
          scope: 'solution',
          triggers: [
            { type: 'keyword', value: '备课', priority: 10 },
          ],
          allowedTools: ['write_output', 'Read', 'Write', 'Skill'],
          relatedSkills: ['notebooklm'],
        },
      ],
      setup: {
        skipSteps: [],
        customScripts: {
          preInstall: '.solution-hooks/pre-install.sh',
          customInit: '.solution-hooks/custom-init.sh',
          postInstall: '.solution-hooks/post-install.sh',
        },
      },
    };

    const result = SolutionConfigV1Schema.safeParse(lessonPlanDesigner);
    expect(result.success).toBe(true);
  });

  it('should validate edu-agent solution.json with grouped syncFields', () => {
    const eduAgent = {
      name: 'EduAgent',
      slug: 'edu-agent',
      version: '1.0.0',
      description: 'AI教育助手',
      mcpServers: {
        'edu-agent-tools': {
          command: 'node',
          args: ['mcp-server/dist/index.js'],
          description: 'EduAgent MCP tools',
        },
      },
      skill: {
        name: 'EduAgent',
        description: 'AI教育助手',
        triggers: [
          { type: 'keyword', value: '备课', priority: 10 },
        ],
        allowedTools: ['write_output'],
        skillFile: 'skills/edu-agent/SKILL.md',
        relatedSkills: ['notebooklm'],
      },
      syncFields: {
        lessonPlan: ['title', 'subject', 'gradeLevel'],
        problemExplain: ['problemAnalysis', 'keyKnowledge'],
      },
    };

    const result = SolutionConfigV1Schema.safeParse(eduAgent);
    expect(result.success).toBe(true);
  });

  it('should validate lego-playground solution.json (minimal MCP server)', () => {
    const legoPlayground = {
      name: 'LEGO Playground',
      slug: 'lego-playground',
      version: '1.0.0',
      description: 'AI LEGO Mosaic Designer',
      mcpServers: {
        'lego-mosaic-tools': {
          command: 'node',
          args: ['mcp-server/dist/stdio-server.js'],
          description: 'LEGO Mosaic tools',
        },
      },
      skill: {
        name: 'LEGO Mosaic Designer',
        description: 'AI LEGO Mosaic designer',
        triggers: [
          { type: 'keyword', value: 'mosaic', priority: 10 },
        ],
        allowedTools: ['write_output', 'analyze_image'],
        skillFile: 'skills/lego-mosaic-designer/SKILL.md',
      },
      syncFields: ['mosaicConfig', 'placements', 'billOfMaterials'],
    };

    const result = SolutionConfigV1Schema.safeParse(legoPlayground);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// SolutionConfigV3Schema Tests
// ============================================================================

describe('SolutionConfigV3Schema', () => {
  const minimalV3 = {
    schemaVersion: '3.0' as const,
    tenant: { name: 'Quiz Analyzer', slug: 'quiz-analyzer' },
  };

  it('should validate minimal v3 config with defaults applied', () => {
    const result = SolutionConfigV3Schema.safeParse(minimalV3);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skills).toEqual(['skills/*']);
      expect(result.data.mcpServers).toEqual({});
      expect(result.data.discovery.enabled).toBe(true);
    }
  });

  it('should accept string wildcard skill reference', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      skills: ['skills/*'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept specific string skill path', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      skills: ['skills/three-column-analysis', 'skills/analyze-student-answer'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept folder object skill reference', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      skills: [{ folder: 'skills/three-column-analysis' }],
    });
    expect(result.success).toBe(true);
  });

  it('should accept { slug } skill reference (actual solution.json format)', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      skills: [
        { slug: 'three-column-analysis', name: 'three-column-analysis' },
        { slug: 'analyze-student-answer', name: 'analyze-student-answer' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept { slug } without name', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      skills: [{ slug: 'my-skill' }],
    });
    expect(result.success).toBe(true);
  });

  it('should reject schemaVersion !== 3.0', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      schemaVersion: '2.0',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing tenant', () => {
    const result = SolutionConfigV3Schema.safeParse({ schemaVersion: '3.0' });
    expect(result.success).toBe(false);
  });

  it('should validate v3 with sessionTemplates', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      sessionTemplates: {
        teacher: {
          description: '教师视图',
          appendSystemPrompt: '你正在为教师提供完整的题目分析材料',
          enabledSkills: ['three-column-analysis'],
        },
        student: {
          description: '学生视图',
          appendSystemPrompt: '你正在辅导一名学生解题',
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.sessionTemplates!)).toEqual(['teacher', 'student']);
    }
  });

  it('should accept quiz-analyzer actual solution.json shape', () => {
    const actual = {
      schemaVersion: '3.0',
      tenant: { name: 'Quiz Analyzer', slug: 'quiz-analyzer' },
      skills: [
        { slug: 'three-column-analysis', name: 'three-column-analysis' },
        { slug: 'analyze-student-answer', name: 'analyze-student-answer' },
      ],
      mcpServers: {
        'quiz-analyzer-tools': {
          command: 'node',
          args: ['mcp-server/dist/index.js'],
          env: { MCP_PORT: '3006' },
        },
      },
    };
    const result = SolutionConfigV3Schema.safeParse(actual);
    expect(result.success).toBe(true);
  });

  it('should reject skills array with empty string', () => {
    const result = SolutionConfigV3Schema.safeParse({
      ...minimalV3,
      skills: [''],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// SessionTemplateSchema Tests
// ============================================================================

describe('SessionTemplateSchema', () => {
  it('should accept an empty object (all fields optional)', () => {
    const result = SessionTemplateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept a fully populated template', () => {
    const result = SessionTemplateSchema.safeParse({
      description: '教师视图',
      appendSystemPrompt: '你正在为教师提供完整的题目分析',
      enabledSkills: ['three-column-analysis', 'analyze-student-answer'],
      model: 'claude-opus-4-6',
      maxTokens: 8192,
    });
    expect(result.success).toBe(true);
  });

  it('should reject maxTokens of 0', () => {
    const result = SessionTemplateSchema.safeParse({ maxTokens: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject negative maxTokens', () => {
    const result = SessionTemplateSchema.safeParse({ maxTokens: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer maxTokens', () => {
    const result = SessionTemplateSchema.safeParse({ maxTokens: 1.5 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug in enabledSkills', () => {
    const result = SessionTemplateSchema.safeParse({
      enabledSkills: ['valid-slug', 'INVALID SLUG'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty string in enabledSkills', () => {
    const result = SessionTemplateSchema.safeParse({
      enabledSkills: [''],
    });
    expect(result.success).toBe(false);
  });
});
