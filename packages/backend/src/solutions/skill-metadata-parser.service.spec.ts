import { SkillMetadataParserService } from './skill-metadata-parser.service';
import type { SolutionConfigV2 } from './dto/solution-config.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SkillMetadataParserService', () => {
  let service: SkillMetadataParserService;
  let tmpDir: string;

  beforeEach(async () => {
    service = new SkillMetadataParserService();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-parser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  // Helper to write a SKILL.md file under a named skill directory
  // --------------------------------------------------------------------------

  async function writeSkillFile(
    skillName: string,
    content: string,
  ): Promise<string> {
    const skillDir = path.join(tmpDir, 'skills', skillName);
    await fs.mkdir(skillDir, { recursive: true });
    const filePath = path.join(skillDir, 'SKILL.md');
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  // --------------------------------------------------------------------------
  // Helper: build a minimal valid v2 config
  // --------------------------------------------------------------------------

  function buildV2Config(
    skills: Array<{
      name: string;
      slug: string;
      description?: string;
      scope?: 'tenant' | 'personal';
      triggers?: Array<{ type: string; value: string; priority?: number }>;
      allowedTools?: string[];
    }>,
  ): SolutionConfigV2 {
    return {
      schemaVersion: '2.0',
      ccaas: {
        tenant: { name: 'Test Solution', slug: 'test-solution' },
        discovery: {
          enabled: true,
          mode: 'auto',
          skills: skills.map((s) => ({
            name: s.name,
            slug: s.slug,
            description: s.description,
            scope: s.scope ?? 'tenant',
            triggers: s.triggers as any,
            allowedTools: s.allowedTools,
          })),
          mcpServers: {},
        },
      },
    };
  }

  // ==========================================================================
  // 1. Valid SKILL.md with complete frontmatter
  // ==========================================================================

  describe('valid SKILL.md with complete frontmatter', () => {
    it('should parse frontmatter and return source=frontmatter', async () => {
      const content = [
        '---',
        'name: three-column-analysis',
        'slug: three-column-analysis',
        'description: "Triple-column quiz analysis"',
        'scope: tenant',
        'triggers:',
        '  - type: keyword',
        '    value: "analyze quiz"',
        '    priority: 10',
        'allowedTools:',
        '  - parse_quiz_content',
        '  - write_output',
        '---',
        '',
        '# Skill: Three Column Analysis',
        '',
        'This is the skill body.',
      ].join('\n');

      const filePath = await writeSkillFile(
        'three-column-analysis',
        content,
      );
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.name).toBe('three-column-analysis');
      expect(result.frontmatter.slug).toBe('three-column-analysis');
      expect(result.frontmatter.description).toBe(
        'Triple-column quiz analysis',
      );
      expect(result.frontmatter.scope).toBe('tenant');
      expect(result.frontmatter.triggers).toHaveLength(1);
      expect(result.frontmatter.triggers[0].type).toBe('keyword');
      expect(result.frontmatter.triggers[0].value).toBe('analyze quiz');
      expect(result.frontmatter.triggers[0].priority).toBe(10);
      expect(result.frontmatter.allowedTools).toEqual([
        'parse_quiz_content',
        'write_output',
      ]);
      expect(result.content).toContain('# Skill: Three Column Analysis');
      expect(result.content).toContain('This is the skill body.');
      expect(result.warnings).toHaveLength(0);
    });

    it('should apply schema defaults for missing optional fields', async () => {
      const content = [
        '---',
        'name: my-skill',
        'slug: my-skill',
        'description: A minimal skill',
        '---',
        '',
        'Body text.',
      ].join('\n');

      const filePath = await writeSkillFile('my-skill', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.scope).toBe('tenant');
      expect(result.frontmatter.triggers).toEqual([]);
      expect(result.frontmatter.allowedTools).toEqual([]);
    });

    it('should handle unicode in frontmatter values', async () => {
      const content = [
        '---',
        'name: lesson-plan-polish',
        'slug: lesson-plan-polish',
        'description: "Based on Prof. Cui - optimize lesson plans"',
        '---',
        '',
        '# Content here',
      ].join('\n');

      const filePath = await writeSkillFile('lesson-plan-polish', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.slug).toBe('lesson-plan-polish');
    });
  });

  // ==========================================================================
  // 2. SKILL.md without frontmatter -> fallback to solution.json
  // ==========================================================================

  describe('SKILL.md without frontmatter (fallback to solution.json)', () => {
    it('should use solution.json when no frontmatter present', async () => {
      const content = [
        '# Skill: Quiz Analysis',
        '',
        'No frontmatter here, just markdown.',
      ].join('\n');

      const filePath = await writeSkillFile('quiz-analysis', content);
      const config = buildV2Config([
        {
          name: 'Quiz Analysis',
          slug: 'quiz-analysis',
          description: 'Analyze quizzes from solution.json',
          triggers: [
            { type: 'keyword', value: 'analyze', priority: 10 },
          ],
          allowedTools: ['tool-a'],
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'quiz-analysis',
      );

      expect(result.source).toBe('solution-json');
      expect(result.frontmatter.name).toBe('Quiz Analysis');
      expect(result.frontmatter.slug).toBe('quiz-analysis');
      expect(result.frontmatter.description).toBe(
        'Analyze quizzes from solution.json',
      );
      expect(result.frontmatter.triggers).toHaveLength(1);
      expect(result.frontmatter.allowedTools).toEqual(['tool-a']);
      expect(result.content).toContain('No frontmatter here');
      expect(
        result.warnings.some((w) => w.includes('No YAML frontmatter')),
      ).toBe(true);
    });

    it('should generate default description from name if missing in solution.json', async () => {
      const content = '# Just markdown';
      const filePath = await writeSkillFile('test-skill', content);
      const config = buildV2Config([
        {
          name: 'Test Skill',
          slug: 'test-skill',
          // no description
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'test-skill',
      );

      expect(result.source).toBe('solution-json');
      expect(result.frontmatter.description).toBe('Skill: Test Skill');
    });
  });

  // ==========================================================================
  // 3. Missing SKILL.md file -> fallback to solution.json
  // ==========================================================================

  describe('missing SKILL.md file', () => {
    it('should fall back to solution.json when file does not exist', async () => {
      const missingPath = path.join(
        tmpDir,
        'skills',
        'nonexistent',
        'SKILL.md',
      );
      const config = buildV2Config([
        {
          name: 'Nonexistent Skill',
          slug: 'nonexistent',
          description: 'From config only',
        },
      ]);

      const result = await service.parseSkillFile(
        missingPath,
        config,
        'nonexistent',
      );

      expect(result.source).toBe('solution-json');
      expect(result.frontmatter.name).toBe('Nonexistent Skill');
      expect(result.frontmatter.slug).toBe('nonexistent');
      expect(result.content).toBe('');
      expect(
        result.warnings.some((w) => w.includes('not found')),
      ).toBe(true);
    });

    it('should use defaults when file missing and no solution config', async () => {
      const missingPath = path.join(
        tmpDir,
        'skills',
        'orphan-skill',
        'SKILL.md',
      );

      const result = await service.parseSkillFile(missingPath);

      expect(result.source).toBe('defaults');
      expect(result.frontmatter.slug).toBe('orphan-skill');
      expect(result.frontmatter.name).toBe('orphan-skill');
      expect(result.frontmatter.description).toContain('Auto-discovered');
      expect(result.content).toBe('');
    });
  });

  // ==========================================================================
  // 4. Invalid frontmatter -> fallback chain
  // ==========================================================================

  describe('invalid frontmatter', () => {
    it('should merge invalid frontmatter with solution.json', async () => {
      // Frontmatter has name but missing required slug and description
      const content = [
        '---',
        'name: partial-skill',
        '---',
        '',
        '# Partial skill',
      ].join('\n');

      const filePath = await writeSkillFile('partial-skill', content);
      const config = buildV2Config([
        {
          name: 'Partial Skill',
          slug: 'partial-skill',
          description: 'Filled in by solution.json',
          allowedTools: ['tool-x'],
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'partial-skill',
      );

      // Should successfully merge
      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.name).toBe('partial-skill');
      expect(result.frontmatter.slug).toBe('partial-skill');
      expect(result.frontmatter.description).toBe(
        'Filled in by solution.json',
      );
      expect(
        result.warnings.some((w) => w.includes('Merged frontmatter')),
      ).toBe(true);
    });

    it('should fall back to solution.json when merge still fails', async () => {
      // Frontmatter has invalid data that can't be merged
      const content = [
        '---',
        'name: ""',
        'slug: "INVALID SLUG"',
        '---',
        '',
        '# Bad frontmatter',
      ].join('\n');

      const filePath = await writeSkillFile('bad-skill', content);
      const config = buildV2Config([
        {
          name: 'Bad Skill Fixed',
          slug: 'bad-skill',
          description: 'Fixed by solution.json',
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'bad-skill',
      );

      expect(result.source).toBe('solution-json');
      expect(result.frontmatter.name).toBe('Bad Skill Fixed');
      expect(result.frontmatter.slug).toBe('bad-skill');
    });

    it('should use defaults when both frontmatter and solution.json fail', async () => {
      const content = [
        '---',
        'invalid: true',
        '---',
        '',
        '# No useful metadata',
      ].join('\n');

      const filePath = await writeSkillFile('broken-skill', content);

      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.frontmatter.slug).toBe('broken-skill');
      expect(result.frontmatter.name).toBe('broken-skill');
      expect(result.content).toContain('No useful metadata');
    });
  });

  // ==========================================================================
  // 5. Complete fallback chain tests
  // ==========================================================================

  describe('complete fallback chain', () => {
    it('frontmatter > solution.json > defaults (frontmatter wins)', async () => {
      const content = [
        '---',
        'name: from-frontmatter',
        'slug: my-skill',
        'description: Frontmatter wins',
        '---',
        '',
        'Body.',
      ].join('\n');

      const filePath = await writeSkillFile('my-skill', content);
      const config = buildV2Config([
        {
          name: 'From Config',
          slug: 'my-skill',
          description: 'Config loses',
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'my-skill',
      );

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.name).toBe('from-frontmatter');
      expect(result.frontmatter.description).toBe('Frontmatter wins');
    });

    it('solution.json > defaults (when no file)', async () => {
      const missingPath = path.join(
        tmpDir,
        'skills',
        'config-skill',
        'SKILL.md',
      );
      const config = buildV2Config([
        {
          name: 'Config Skill',
          slug: 'config-skill',
          description: 'From config',
        },
      ]);

      const result = await service.parseSkillFile(
        missingPath,
        config,
        'config-skill',
      );

      expect(result.source).toBe('solution-json');
      expect(result.frontmatter.name).toBe('Config Skill');
    });

    it('defaults (when nothing else available)', async () => {
      const missingPath = path.join(
        tmpDir,
        'skills',
        'lonely-skill',
        'SKILL.md',
      );

      const result = await service.parseSkillFile(missingPath);

      expect(result.source).toBe('defaults');
      expect(result.frontmatter.slug).toBe('lonely-skill');
    });

    it('should not match wrong slug in solution.json', async () => {
      const content = '# No frontmatter';
      const filePath = await writeSkillFile('skill-a', content);
      const config = buildV2Config([
        {
          name: 'Skill B',
          slug: 'skill-b',
          description: 'Wrong slug',
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'skill-a', // no match in config
      );

      expect(result.source).toBe('defaults');
      expect(result.frontmatter.slug).toBe('skill-a');
    });
  });

  // ==========================================================================
  // 6. Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty SKILL.md file', async () => {
      const filePath = await writeSkillFile('empty-skill', '');
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.frontmatter.slug).toBe('empty-skill');
    });

    it('should handle SKILL.md with only frontmatter delimiters', async () => {
      const content = '---\n---\n';
      const filePath = await writeSkillFile('empty-fm', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.frontmatter.slug).toBe('empty-fm');
    });

    it('should handle SKILL.md with malformed YAML', async () => {
      const content = [
        '---',
        'name: valid',
        'slug: [unclosed bracket',
        '---',
        '',
        'Body content.',
      ].join('\n');

      const filePath = await writeSkillFile('malformed', content);
      const result = await service.parseSkillFile(filePath);

      // gray-matter may throw or produce partial data
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle path with special characters', async () => {
      const skillName = 'skill-with-numbers-123';
      const content = [
        '---',
        'name: numbered-skill',
        'slug: skill-with-numbers-123',
        'description: Has numbers in path',
        '---',
        '',
        'Content.',
      ].join('\n');

      const filePath = await writeSkillFile(skillName, content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.slug).toBe('skill-with-numbers-123');
    });

    it('should handle solution config with empty skills array', async () => {
      const content = '# No frontmatter';
      const filePath = await writeSkillFile('orphan', content);
      const config = buildV2Config([]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'orphan',
      );

      expect(result.source).toBe('defaults');
    });

    it('should convert personal scope to tenant in solution.json fallback', async () => {
      const missingPath = path.join(
        tmpDir,
        'skills',
        'personal-skill',
        'SKILL.md',
      );
      const config = buildV2Config([
        {
          name: 'Personal Skill',
          slug: 'personal-skill',
          description: 'Has personal scope',
          scope: 'personal',
        },
      ]);

      const result = await service.parseSkillFile(
        missingPath,
        config,
        'personal-skill',
      );

      expect(result.source).toBe('solution-json');
      // "personal" in solution.json maps to "tenant" in frontmatter schema
      // (frontmatter schema only accepts 'tenant' | 'global')
      expect(result.frontmatter.scope).toBe('tenant');
    });

    it('should preserve triggers from solution.json in fallback', async () => {
      const content = '# No frontmatter here';
      const filePath = await writeSkillFile('triggered-skill', content);
      const config = buildV2Config([
        {
          name: 'Triggered Skill',
          slug: 'triggered-skill',
          description: 'Has triggers',
          triggers: [
            { type: 'keyword', value: 'analyze', priority: 10 },
            { type: 'pattern', value: 'quiz.*analysis', priority: 8 },
          ],
          allowedTools: ['tool-a', 'tool-b'],
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'triggered-skill',
      );

      expect(result.source).toBe('solution-json');
      expect(result.frontmatter.triggers).toHaveLength(2);
      expect(result.frontmatter.triggers[0]).toEqual({
        type: 'keyword',
        value: 'analyze',
        priority: 10,
      });
      expect(result.frontmatter.triggers[1]).toEqual({
        type: 'pattern',
        value: 'quiz.*analysis',
        priority: 8,
      });
      expect(result.frontmatter.allowedTools).toEqual([
        'tool-a',
        'tool-b',
      ]);
    });
  });

  // ==========================================================================
  // 7. Real-world SKILL.md formats
  // ==========================================================================

  describe('real-world SKILL.md formats', () => {
    it('should parse lesson-plan-designer style (with frontmatter)', async () => {
      const content = [
        '---',
        'name: lesson-plan-polish',
        'slug: lesson-plan-polish',
        'description: "Optimize lesson plans based on Prof. Cui\'s framework"',
        '---',
        '',
        '# Lesson Plan Polish',
        '',
        '> **Important**: Always call `read_context` first.',
      ].join('\n');

      const filePath = await writeSkillFile(
        'lesson-plan-polish',
        content,
      );
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.name).toBe('lesson-plan-polish');
      expect(result.content).toContain('Always call `read_context` first');
    });

    it('should handle quiz-analyzer style (no frontmatter, fallback needed)', async () => {
      const content = [
        '# Skill: Quiz Three-Column Analysis',
        '',
        '## Overview',
        'Provides complete quiz analysis workflow.',
      ].join('\n');

      const filePath = await writeSkillFile(
        'three-column-analysis',
        content,
      );
      const config = buildV2Config([
        {
          name: 'Quiz Analyzer - Three Column Analysis',
          slug: 'three-column-analysis',
          description: 'Triple-column quiz analysis workflow',
          triggers: [
            { type: 'keyword', value: 'analyze quiz', priority: 11 },
          ],
          allowedTools: [
            'parse_quiz_content',
            'search_knowledge_points_json',
          ],
        },
      ]);

      const result = await service.parseSkillFile(
        filePath,
        config,
        'three-column-analysis',
      );

      expect(result.source).toBe('solution-json');
      expect(result.frontmatter.name).toBe(
        'Quiz Analyzer - Three Column Analysis',
      );
      expect(result.frontmatter.triggers).toHaveLength(1);
      expect(result.content).toContain('Provides complete quiz analysis');
    });
  });
});
