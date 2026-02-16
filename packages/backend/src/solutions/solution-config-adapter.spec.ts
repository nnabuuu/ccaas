import { SolutionConfigAdapter } from './solution-config-adapter';
import type { AdaptResult, AdaptError } from './solution-config-adapter';
import { SolutionConfigV2Schema } from './dto/solution-config.dto';

// ============================================================================
// Helpers
// ============================================================================

function expectSuccess(outcome: ReturnType<SolutionConfigAdapter['adapt']>): AdaptResult {
  expect(outcome.success).toBe(true);
  return outcome as AdaptResult;
}

function expectError(outcome: ReturnType<SolutionConfigAdapter['adapt']>): AdaptError {
  expect(outcome.success).toBe(false);
  return outcome as AdaptError;
}

// ============================================================================
// Real v1 configs (from solutions/ directory)
// ============================================================================

const quizAnalyzerV1 = {
  $schema: 'https://ccaas.dev/schemas/solution.v1.json',
  name: 'Quiz Analyzer',
  slug: 'quiz-analyzer',
  version: '1.0.0',
  description: '教育题目智能分析系统',
  backend: {
    port: 3005,
    ccaasUrl: 'http://localhost:3001',
    database: { type: 'sqlite', path: 'data/quiz-analyzer.db' },
  },
  frontend: { port: 5282 },
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
      description: '三栏布局题目分析',
      skillFile: 'skills/three-column-analysis/SKILL.md',
      scope: 'tenant',
      instructions: '请严格遵循工作流',
      triggers: [
        { type: 'keyword', value: '请帮我分析这道题目', priority: 11 },
        { type: 'keyword', value: '开始分析', priority: 10 },
      ],
      allowedTools: ['parse_quiz_content', 'write_output'],
    },
    {
      name: 'Quiz Analyzer - Knowledge Point Matching',
      slug: 'knowledge-point-matching',
      description: '智能标注题目知识点',
      skillFile: 'SKILL_KNOWLEDGE_POINT_MATCHING.md',
      scope: 'tenant',
      triggers: [
        { type: 'keyword', value: '标注知识点', priority: 10 },
      ],
      allowedTools: ['write_output', 'get_knowledge_points_tree'],
    },
  ],
  syncFields: [
    'parsedQuiz', 'catalog', 'difficulty', 'knowledgePointTags',
  ],
  setup: {
    skipSteps: [],
    customScripts: {
      preInstall: '.solution-hooks/pre-install.sh',
      postInstall: '.solution-hooks/post-install.sh',
    },
  },
};

const eduAgentV1 = {
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
    description: 'AI教育助手 - 备课设计、讲题解析',
    triggers: [
      { type: 'keyword', value: '备课', priority: 10 },
      { type: 'keyword', value: '讲题', priority: 10 },
    ],
    allowedTools: ['write_output', 'navigate_to', 'Read', 'Write'],
    skillFile: 'skills/edu-agent/SKILL.md',
    relatedSkills: ['notebooklm', 'example-skills:pptx'],
  },
  chainedSkills: {
    notebooklm: {
      description: '生成讲解音频',
      triggerPhrase: '生成音频',
      inputFrom: '讲稿内容',
      outputTo: '.agent-workspace/sessions/{sessionId}/outputs/讲解音频.mp3',
    },
  },
  backend: { port: 3010, ccaasUrl: 'http://localhost:3001' },
  frontend: { port: 5282 },
  syncFields: {
    lessonPlan: ['title', 'subject', 'gradeLevel'],
    problemExplain: ['problemAnalysis', 'keyKnowledge'],
  },
};

const legoPlaygroundV1 = {
  name: 'LEGO Playground',
  slug: 'lego-playground',
  version: '1.0.0',
  description: 'AI 乐高马赛克设计师',
  mcpServers: {
    'lego-mosaic-tools': {
      command: 'node',
      args: ['mcp-server/dist/stdio-server.js'],
      description: 'LEGO Mosaic Designer MCP tools',
    },
  },
  skill: {
    name: 'LEGO Mosaic Designer',
    description: 'AI 乐高马赛克设计师',
    triggers: [
      { type: 'keyword', value: 'mosaic', priority: 10 },
      { type: 'keyword', value: 'LEGO', priority: 10 },
    ],
    allowedTools: ['write_output', 'analyze_image', 'generate_mosaic'],
    skillFile: 'skills/lego-mosaic-designer/SKILL.md',
    relatedSkills: ['example-skills:pdf'],
  },
  syncFields: ['mosaicConfig', 'placements', 'billOfMaterials'],
  backend: { port: 3005, ccaasUrl: 'http://localhost:3001' },
  frontend: { port: 5282 },
};

// ============================================================================
// Tests
// ============================================================================

describe('SolutionConfigAdapter', () => {
  let adapter: SolutionConfigAdapter;

  beforeEach(() => {
    adapter = new SolutionConfigAdapter();
  });

  // ==========================================================================
  // Invalid input handling
  // ==========================================================================

  describe('invalid input', () => {
    it('should reject null', () => {
      const result = expectError(adapter.adapt(null));
      expect(result.errors).toContain('Config must be a non-null object');
    });

    it('should reject undefined', () => {
      const result = expectError(adapter.adapt(undefined));
      expect(result.errors).toContain('Config must be a non-null object');
    });

    it('should reject non-objects', () => {
      expect(adapter.adapt('string' as any).success).toBe(false);
      expect(adapter.adapt(42 as any).success).toBe(false);
      expect(adapter.adapt(true as any).success).toBe(false);
    });
  });

  // ==========================================================================
  // V2 pass-through
  // ==========================================================================

  describe('v2 pass-through', () => {
    it('should pass through a valid v2 config unchanged', () => {
      const v2Config = {
        schemaVersion: '2.0',
        ccaas: {
          tenant: { name: 'Test', slug: 'test' },
          discovery: {
            enabled: true,
            mode: 'auto',
            skills: [],
            mcpServers: {},
          },
        },
      };

      const result = expectSuccess(adapter.adapt(v2Config));
      expect(result.migrated).toBe(false);
      expect(result.data.schemaVersion).toBe('2.0');
      expect(result.data.ccaas.tenant.name).toBe('Test');
    });

    it('should detect v2 by ccaas key even without schemaVersion', () => {
      const v2Config = {
        ccaas: {
          tenant: { name: 'Test', slug: 'test' },
        },
      };

      // This should be treated as v2 (detected by ccaas key)
      // but will fail v2 validation because schemaVersion is missing
      const result = adapter.adapt(v2Config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid v2 config', () => {
      const invalid = {
        schemaVersion: '2.0',
        ccaas: {
          tenant: { name: '' }, // empty name
        },
      };
      const result = expectError(adapter.adapt(invalid));
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass through v2 config with internal section', () => {
      const v2Config = {
        schemaVersion: '2.0',
        ccaas: {
          tenant: { name: 'Full', slug: 'full' },
          discovery: {
            enabled: true,
            mode: 'auto',
            skills: [
              { name: 'Skill One', slug: 'skill-one', scope: 'tenant' },
            ],
            mcpServers: {
              tools: { command: 'node', args: ['server.js'] },
            },
          },
        },
        internal: {
          backend: { port: 3002, ccaasUrl: 'http://localhost:3001' },
          frontend: { port: 5280 },
        },
      };

      const result = expectSuccess(adapter.adapt(v2Config));
      expect(result.migrated).toBe(false);
      expect(result.data.ccaas.discovery.skills).toHaveLength(1);
      expect(result.data.internal?.backend?.port).toBe(3002);
    });
  });

  // ==========================================================================
  // V1 -> V2 migration with real configs
  // ==========================================================================

  describe('v1 to v2 migration - quiz-analyzer', () => {
    let result: AdaptResult;

    beforeEach(() => {
      result = expectSuccess(adapter.adapt(quizAnalyzerV1));
    });

    it('should mark as migrated', () => {
      expect(result.migrated).toBe(true);
    });

    it('should set schemaVersion to 2.0', () => {
      expect(result.data.schemaVersion).toBe('2.0');
    });

    it('should map name/slug/description to ccaas.tenant', () => {
      expect(result.data.ccaas.tenant.name).toBe('Quiz Analyzer');
      expect(result.data.ccaas.tenant.slug).toBe('quiz-analyzer');
      expect(result.data.ccaas.tenant.description).toBe('教育题目智能分析系统');
    });

    it('should map skills array to ccaas.discovery.skills', () => {
      const skills = result.data.ccaas.discovery.skills;
      expect(skills).toHaveLength(2);
      expect(skills[0].name).toBe('Quiz Analyzer - Three Column Analysis');
      expect(skills[0].slug).toBe('three-column-analysis');
      expect(skills[0].scope).toBe('tenant');
      expect(skills[0].triggers).toHaveLength(2);
      expect(skills[0].triggers![0].priority).toBe(11);
      expect(skills[0].allowedTools).toContain('parse_quiz_content');
    });

    it('should map mcpServers to ccaas.discovery.mcpServers', () => {
      const servers = result.data.ccaas.discovery.mcpServers;
      expect(servers['quiz-analyzer-tools']).toBeDefined();
      expect(servers['quiz-analyzer-tools'].command).toBe('node');
      expect(servers['quiz-analyzer-tools'].env).toEqual({ MCP_PORT: '3006' });
    });

    it('should enable discovery', () => {
      expect(result.data.ccaas.discovery.enabled).toBe(true);
      expect(result.data.ccaas.discovery.mode).toBe('auto');
    });

    it('should map backend/frontend to internal', () => {
      expect(result.data.internal?.backend?.port).toBe(3005);
      expect(result.data.internal?.backend?.ccaasUrl).toBe('http://localhost:3001');
      expect(result.data.internal?.backend?.database).toEqual({
        type: 'sqlite',
        path: 'data/quiz-analyzer.db',
      });
      expect(result.data.internal?.frontend?.port).toBe(5282);
    });

    it('should map syncFields to internal.syncFields', () => {
      expect(result.data.internal?.syncFields).toEqual([
        'parsedQuiz', 'catalog', 'difficulty', 'knowledgePointTags',
      ]);
    });

    it('should map setup to internal.setup', () => {
      expect(result.data.internal?.setup?.skipSteps).toEqual([]);
      expect(result.data.internal?.setup?.customScripts?.preInstall).toBe(
        '.solution-hooks/pre-install.sh',
      );
    });

    it('should produce a valid v2 config', () => {
      const validation = SolutionConfigV2Schema.safeParse(result.data);
      expect(validation.success).toBe(true);
    });
  });

  describe('v1 to v2 migration - edu-agent (single skill)', () => {
    let result: AdaptResult;

    beforeEach(() => {
      result = expectSuccess(adapter.adapt(eduAgentV1));
    });

    it('should migrate single "skill" object to skills array', () => {
      const skills = result.data.ccaas.discovery.skills;
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('EduAgent');
      expect(skills[0].triggers).toHaveLength(2);
      expect(skills[0].relatedSkills).toEqual(['notebooklm', 'example-skills:pptx']);
    });

    it('should handle object-style syncFields', () => {
      expect(result.data.internal?.syncFields).toEqual({
        lessonPlan: ['title', 'subject', 'gradeLevel'],
        problemExplain: ['problemAnalysis', 'keyKnowledge'],
      });
    });

    it('should produce a valid v2 config', () => {
      const validation = SolutionConfigV2Schema.safeParse(result.data);
      expect(validation.success).toBe(true);
    });
  });

  describe('v1 to v2 migration - lego-playground', () => {
    let result: AdaptResult;

    beforeEach(() => {
      result = expectSuccess(adapter.adapt(legoPlaygroundV1));
    });

    it('should migrate correctly', () => {
      expect(result.data.ccaas.tenant.name).toBe('LEGO Playground');
      expect(result.data.ccaas.tenant.slug).toBe('lego-playground');
      expect(result.data.ccaas.discovery.skills).toHaveLength(1);
      expect(result.data.ccaas.discovery.skills[0].name).toBe('LEGO Mosaic Designer');
    });

    it('should produce a valid v2 config', () => {
      const validation = SolutionConfigV2Schema.safeParse(result.data);
      expect(validation.success).toBe(true);
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle minimal v1 config (name + slug only)', () => {
      const minimal = { name: 'Minimal', slug: 'minimal' };
      const result = expectSuccess(adapter.adapt(minimal));
      expect(result.migrated).toBe(true);
      expect(result.data.ccaas.tenant.name).toBe('Minimal');
      expect(result.data.ccaas.discovery.skills).toEqual([]);
      expect(result.data.ccaas.discovery.mcpServers).toEqual({});
    });

    it('should generate slug from name when slug is missing', () => {
      const noSlug = { name: 'My Cool Solution' };
      const result = expectSuccess(adapter.adapt(noSlug));
      expect(result.data.ccaas.tenant.slug).toBe('my-cool-solution');
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Missing or empty "slug"'),
      );
    });

    it('should use fallback when name is missing', () => {
      const noName = { slug: 'something' };
      const result = expectSuccess(adapter.adapt(noName));
      expect(result.data.ccaas.tenant.name).toBe('Unnamed Solution');
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Missing or empty "name"'),
      );
    });

    it('should handle empty skills array', () => {
      const config = { name: 'Test', slug: 'test', skills: [] };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.ccaas.discovery.skills).toEqual([]);
    });

    it('should handle empty mcpServers object', () => {
      const config = { name: 'Test', slug: 'test', mcpServers: {} };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.ccaas.discovery.mcpServers).toEqual({});
    });

    it('should skip skills with missing name', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        skills: [{ description: 'no name skill' }],
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.ccaas.discovery.skills).toEqual([]);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Skipping skill with missing name'),
      );
    });

    it('should skip MCP server with missing command', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        mcpServers: {
          broken: { args: ['a.js'] },
        },
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.ccaas.discovery.mcpServers).toEqual({});
      expect(result.warnings).toContainEqual(
        expect.stringContaining('missing command'),
      );
    });

    it('should handle extra/unknown fields gracefully', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        unknownField: 'hello',
        workflow: { phases: [] },
        subjects: [{ id: '1' }],
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.ccaas.tenant.name).toBe('Test');
      // Extra fields silently ignored
    });

    it('should generate slug for skill when missing', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        skills: [
          { name: 'My Great Skill' },
        ],
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.ccaas.discovery.skills[0].slug).toBe('my-great-skill');
    });

    it('should skip backend config when port is missing', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        backend: { ccaasUrl: 'http://localhost:3001' },
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.internal?.backend).toBeUndefined();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Backend config missing port'),
      );
    });

    it('should skip frontend config when port is missing', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        frontend: { apiBaseUrl: '/api' },
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.internal?.frontend).toBeUndefined();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Frontend config missing port'),
      );
    });

    it('should handle skill with chainedSkills on the skill object', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        skills: [
          {
            name: 'Main',
            slug: 'main',
            chainedSkills: {
              notebooklm: {
                description: 'Generate audio',
                triggerPhrase: 'generate audio',
              },
            },
          },
        ],
      };
      const result = expectSuccess(adapter.adapt(config));
      const skill = result.data.ccaas.discovery.skills[0];
      expect(skill.chainedSkills?.notebooklm?.description).toBe('Generate audio');
    });

    it('should not include internal when no internal fields exist', () => {
      const config = { name: 'Test', slug: 'test' };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.internal).toBeUndefined();
    });

    it('should handle non-object MCP server entries', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        mcpServers: { bad: 'string-value' },
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(Object.keys(result.data.ccaas.discovery.mcpServers)).toHaveLength(0);
    });

    it('should default scope to tenant when invalid', () => {
      const config = {
        name: 'Test',
        slug: 'test',
        skills: [
          { name: 'Skill', slug: 'skill', scope: 'invalid_scope' },
        ],
      };
      const result = expectSuccess(adapter.adapt(config));
      expect(result.data.ccaas.discovery.skills[0].scope).toBe('tenant');
    });
  });

  // ==========================================================================
  // Validation of migrated configs
  // ==========================================================================

  describe('migrated configs pass v2 validation', () => {
    const allV1Configs = [
      { label: 'quiz-analyzer', config: quizAnalyzerV1 },
      { label: 'edu-agent', config: eduAgentV1 },
      { label: 'lego-playground', config: legoPlaygroundV1 },
    ];

    it.each(allV1Configs)(
      'migrated $label should pass SolutionConfigV2Schema validation',
      ({ config }) => {
        const result = expectSuccess(adapter.adapt(config));
        const validation = SolutionConfigV2Schema.safeParse(result.data);
        expect(validation.success).toBe(true);
      },
    );
  });

  // ==========================================================================
  // migrateV1ToV2 directly
  // ==========================================================================

  describe('migrateV1ToV2 method', () => {
    it('should be callable directly', () => {
      const result = adapter.migrateV1ToV2({ name: 'Direct', slug: 'direct' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schemaVersion).toBe('2.0');
      }
    });
  });

  // ==========================================================================
  // Idempotency: migrating a migrated config
  // ==========================================================================

  describe('idempotency', () => {
    it('should pass through an already-migrated v2 config', () => {
      const first = expectSuccess(adapter.adapt(quizAnalyzerV1));
      const second = expectSuccess(adapter.adapt(first.data));
      expect(second.migrated).toBe(false);
      expect(second.data).toEqual(first.data);
    });
  });
});
