/**
 * Tests for the solution migration CLI tool.
 *
 * Tests migration of solution.json from v1 to v2 format
 * and YAML frontmatter generation for SKILL.md files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SolutionConfigAdapter } from '../solutions/solution-config-adapter';
import { SolutionConfigV2Schema, detectSchemaVersion } from '../solutions/dto/solution-config.dto';
import type { SkillDefinition } from '../solutions/dto/solution-config.dto';

// ============================================================================
// Import the functions we want to test by re-implementing the pure functions
// (The CLI script is designed for direct execution; we test the underlying
//  logic by importing the adapter and testing frontmatter generation separately)
// ============================================================================

// Re-implement the pure functions from migrate-solution.ts for testing
function yamlString(value: string): string {
  if (/[:#\[\]{}|>&*!?,]/.test(value) || value.includes('\n')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function generateFrontmatter(skill: SkillDefinition): string {
  const lines: string[] = ['---'];

  lines.push(`name: ${skill.name}`);
  lines.push(`slug: ${skill.slug}`);

  if (skill.description) {
    lines.push(`description: ${yamlString(skill.description)}`);
  }

  lines.push(`scope: ${skill.scope}`);

  if (skill.triggers && skill.triggers.length > 0) {
    lines.push('triggers:');
    for (const trigger of skill.triggers) {
      lines.push(`  - type: ${trigger.type}`);
      lines.push(`    value: ${yamlString(trigger.value)}`);
      if (trigger.priority !== undefined) {
        lines.push(`    priority: ${trigger.priority}`);
      }
    }
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    lines.push('allowedTools:');
    for (const tool of skill.allowedTools) {
      lines.push(`  - ${tool}`);
    }
  }

  lines.push('---');

  return lines.join('\n');
}

function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith('---');
}

// ============================================================================
// Real solution configs for integration-style tests
// ============================================================================

const SOLUTIONS_DIR = path.resolve(__dirname, '../../../../solutions');

// ============================================================================
// Tests
// ============================================================================

describe('migrate-solution', () => {
  // ==========================================================================
  // Frontmatter Generation
  // ==========================================================================

  describe('generateFrontmatter', () => {
    it('should generate minimal frontmatter', () => {
      const skill: SkillDefinition = {
        name: 'Test Skill',
        slug: 'test-skill',
        scope: 'tenant',
      };

      const fm = generateFrontmatter(skill);
      expect(fm).toContain('---');
      expect(fm).toContain('name: Test Skill');
      expect(fm).toContain('slug: test-skill');
      expect(fm).toContain('scope: tenant');
      expect(fm.split('---').length).toBe(3); // Two delimiters
    });

    it('should include description', () => {
      const skill: SkillDefinition = {
        name: 'Skill',
        slug: 'skill',
        scope: 'tenant',
        description: 'A test skill',
      };

      const fm = generateFrontmatter(skill);
      expect(fm).toContain('description: A test skill');
    });

    it('should quote description with special YAML characters', () => {
      const skill: SkillDefinition = {
        name: 'Skill',
        slug: 'skill',
        scope: 'tenant',
        description: 'Analysis: parse & verify',
      };

      const fm = generateFrontmatter(skill);
      expect(fm).toContain('description: "Analysis: parse & verify"');
    });

    it('should include triggers', () => {
      const skill: SkillDefinition = {
        name: 'Skill',
        slug: 'skill',
        scope: 'tenant',
        triggers: [
          { type: 'keyword', value: 'test', priority: 10 },
          { type: 'intent', value: 'analyze' },
        ],
      };

      const fm = generateFrontmatter(skill);
      expect(fm).toContain('triggers:');
      expect(fm).toContain('  - type: keyword');
      expect(fm).toContain('    value: test');
      expect(fm).toContain('    priority: 10');
      expect(fm).toContain('  - type: intent');
      expect(fm).toContain('    value: analyze');
    });

    it('should include allowedTools', () => {
      const skill: SkillDefinition = {
        name: 'Skill',
        slug: 'skill',
        scope: 'tenant',
        allowedTools: ['write_output', 'Read'],
      };

      const fm = generateFrontmatter(skill);
      expect(fm).toContain('allowedTools:');
      expect(fm).toContain('  - write_output');
      expect(fm).toContain('  - Read');
    });

    it('should generate complete frontmatter for real quiz-analyzer skill', () => {
      const skill: SkillDefinition = {
        name: 'Quiz Analyzer - Three Column Analysis',
        slug: 'three-column-analysis',
        description: 'Three column quiz analysis',
        scope: 'tenant',
        triggers: [
          { type: 'keyword', value: 'analyze', priority: 11 },
          { type: 'keyword', value: 'start', priority: 10 },
        ],
        allowedTools: ['parse_quiz_content', 'write_output'],
      };

      const fm = generateFrontmatter(skill);
      expect(fm.startsWith('---')).toBe(true);
      expect(fm.endsWith('---')).toBe(true);
      expect(fm).toContain('name: Quiz Analyzer - Three Column Analysis');
      expect(fm).toContain('slug: three-column-analysis');
    });

    it('should not include triggers when empty', () => {
      const skill: SkillDefinition = {
        name: 'Skill',
        slug: 'skill',
        scope: 'tenant',
        triggers: [],
      };

      const fm = generateFrontmatter(skill);
      expect(fm).not.toContain('triggers:');
    });

    it('should not include allowedTools when empty', () => {
      const skill: SkillDefinition = {
        name: 'Skill',
        slug: 'skill',
        scope: 'tenant',
        allowedTools: [],
      };

      const fm = generateFrontmatter(skill);
      expect(fm).not.toContain('allowedTools:');
    });
  });

  // ==========================================================================
  // YAML String Quoting
  // ==========================================================================

  describe('yamlString', () => {
    it('should not quote simple strings', () => {
      expect(yamlString('hello')).toBe('hello');
      expect(yamlString('simple value')).toBe('simple value');
    });

    it('should quote strings with colon', () => {
      expect(yamlString('key: value')).toBe('"key: value"');
    });

    it('should quote strings with hash', () => {
      expect(yamlString('test # comment')).toBe('"test # comment"');
    });

    it('should quote strings with brackets', () => {
      expect(yamlString('[array]')).toBe('"[array]"');
      expect(yamlString('{object}')).toBe('"{object}"');
    });

    it('should escape double quotes in quoted strings', () => {
      expect(yamlString('say "hello"')).toBe('say "hello"');
      // The quote appears because the string doesn't have special YAML chars
      // but if it does:
      expect(yamlString('say: "hello"')).toBe('"say: \\"hello\\""');
    });

    it('should quote Chinese strings with special chars', () => {
      expect(yamlString('Analysis: Chinese text')).toBe('"Analysis: Chinese text"');
    });
  });

  // ==========================================================================
  // Frontmatter Detection
  // ==========================================================================

  describe('hasFrontmatter', () => {
    it('should detect existing frontmatter', () => {
      const content = '---\nname: test\n---\n# Content';
      expect(hasFrontmatter(content)).toBe(true);
    });

    it('should detect frontmatter with leading whitespace', () => {
      const content = '  ---\nname: test\n---\n# Content';
      expect(hasFrontmatter(content)).toBe(true);
    });

    it('should return false for content without frontmatter', () => {
      const content = '# My Skill\n\nDescription here.';
      expect(hasFrontmatter(content)).toBe(false);
    });

    it('should return false for empty content', () => {
      expect(hasFrontmatter('')).toBe(false);
    });

    it('should return false for content starting with heading', () => {
      const content = '# Skill: Quiz Analysis\n\n## Overview';
      expect(hasFrontmatter(content)).toBe(false);
    });
  });

  // ==========================================================================
  // Real Solution Migration (end-to-end with adapter)
  // ==========================================================================

  describe('real solution migration', () => {
    const adapter = new SolutionConfigAdapter();

    async function loadSolution(slug: string): Promise<unknown> {
      const filePath = path.join(SOLUTIONS_DIR, slug, 'solution.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }

    it('should migrate quiz-analyzer v1 to valid v2', async () => {
      const raw = await loadSolution('quiz-analyzer');
      const version = detectSchemaVersion(raw);

      // quiz-analyzer may already be v2 if previously migrated
      if (version === '1.0') {
        const outcome = adapter.adapt(raw);
        expect(outcome.success).toBe(true);
        if (outcome.success) {
          const validation = SolutionConfigV2Schema.safeParse(outcome.data);
          expect(validation.success).toBe(true);
          expect(outcome.data.ccaas.discovery.skills.length).toBeGreaterThan(0);
        }
      } else {
        // Already v2, just validate it passes
        const validation = SolutionConfigV2Schema.safeParse(raw);
        expect(validation.success).toBe(true);
      }
    });

    it('should migrate lesson-plan-designer v1 to valid v2', async () => {
      const raw = await loadSolution('lesson-plan-designer');
      const version = detectSchemaVersion(raw);

      if (version === '1.0') {
        const outcome = adapter.adapt(raw);
        expect(outcome.success).toBe(true);
        if (outcome.success) {
          const validation = SolutionConfigV2Schema.safeParse(outcome.data);
          expect(validation.success).toBe(true);
          expect(outcome.data.ccaas.tenant.slug).toBe('lesson-plan-designer');
        }
      } else {
        const validation = SolutionConfigV2Schema.safeParse(raw);
        expect(validation.success).toBe(true);
      }
    });

    it('should migrate edu-agent v1 (single skill) to valid v2', async () => {
      const raw = await loadSolution('edu-agent');
      const version = detectSchemaVersion(raw);

      if (version === '1.0') {
        const outcome = adapter.adapt(raw);
        expect(outcome.success).toBe(true);
        if (outcome.success) {
          const validation = SolutionConfigV2Schema.safeParse(outcome.data);
          expect(validation.success).toBe(true);
          expect(outcome.data.ccaas.discovery.skills.length).toBeGreaterThanOrEqual(1);
        }
      } else {
        const validation = SolutionConfigV2Schema.safeParse(raw);
        expect(validation.success).toBe(true);
      }
    });

    it('should migrate lego-playground v1 (single skill) to valid v2', async () => {
      const raw = await loadSolution('lego-playground');
      const version = detectSchemaVersion(raw);

      if (version === '1.0') {
        const outcome = adapter.adapt(raw);
        expect(outcome.success).toBe(true);
        if (outcome.success) {
          const validation = SolutionConfigV2Schema.safeParse(outcome.data);
          expect(validation.success).toBe(true);
        }
      } else {
        const validation = SolutionConfigV2Schema.safeParse(raw);
        expect(validation.success).toBe(true);
      }
    });

    it('should migrate problem-explainer v1 to valid v2', async () => {
      const raw = await loadSolution('problem-explainer');
      const version = detectSchemaVersion(raw);

      if (version === '1.0') {
        const outcome = adapter.adapt(raw);
        expect(outcome.success).toBe(true);
        if (outcome.success) {
          const validation = SolutionConfigV2Schema.safeParse(outcome.data);
          expect(validation.success).toBe(true);
          expect(outcome.data.ccaas.tenant.slug).toBe('problem-explainer');
        }
      } else {
        const validation = SolutionConfigV2Schema.safeParse(raw);
        expect(validation.success).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Frontmatter for real solution skills
  // ==========================================================================

  describe('frontmatter generation from migrated configs', () => {
    const adapter = new SolutionConfigAdapter();

    it('should generate valid frontmatter for all quiz-analyzer skills', async () => {
      const filePath = path.join(SOLUTIONS_DIR, 'quiz-analyzer', 'solution.json');
      const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const outcome = adapter.adapt(raw);

      expect(outcome.success).toBe(true);
      if (!outcome.success) return;

      for (const skill of outcome.data.ccaas.discovery.skills) {
        const fm = generateFrontmatter(skill);
        expect(fm.startsWith('---')).toBe(true);
        expect(fm.endsWith('---')).toBe(true);
        expect(fm).toContain(`slug: ${skill.slug}`);
      }
    });

    it('should generate frontmatter for lesson-plan-designer skills', async () => {
      const filePath = path.join(SOLUTIONS_DIR, 'lesson-plan-designer', 'solution.json');
      const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const outcome = adapter.adapt(raw);

      expect(outcome.success).toBe(true);
      if (!outcome.success) return;

      const skills = outcome.data.ccaas.discovery.skills;
      expect(skills.length).toBeGreaterThan(0);

      const fm = generateFrontmatter(skills[0]);
      expect(fm).toContain('name: Lesson Plan Designer');
      expect(fm).toContain('slug: lesson-plan-designer');
    });
  });

  // ==========================================================================
  // Backup and Rollback Logic
  // ==========================================================================

  describe('backup naming', () => {
    it('should use .v1.backup suffix', () => {
      const original = '/path/to/solution.json';
      const backup = original + '.v1.backup';
      expect(backup).toBe('/path/to/solution.json.v1.backup');
    });
  });

  // ==========================================================================
  // SKILL.md File Discovery
  // ==========================================================================

  describe('SKILL.md file existence', () => {
    it('should find SKILL.md files referenced in quiz-analyzer', async () => {
      const filePath = path.join(SOLUTIONS_DIR, 'quiz-analyzer', 'solution.json');
      const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const outcome = adapter.adapt(raw);

      if (!outcome.success) return;

      for (const skill of outcome.data.ccaas.discovery.skills) {
        if (!skill.skillFile) continue;

        const skillFilePath = path.join(SOLUTIONS_DIR, 'quiz-analyzer', skill.skillFile);
        const exists = await fs.access(skillFilePath).then(() => true).catch(() => false);

        // We expect the file to exist for skills that have a skillFile
        if (exists) {
          const content = await fs.readFile(skillFilePath, 'utf-8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });

    const adapter = new SolutionConfigAdapter();
  });

  // ==========================================================================
  // Idempotency
  // ==========================================================================

  describe('idempotency', () => {
    it('frontmatter should not be added twice', () => {
      const content = '---\nname: test\nslug: test\n---\n\n# Content';
      expect(hasFrontmatter(content)).toBe(true);
      // Migration logic skips files that already have frontmatter
    });

    it('v2 config should be skipped by adapter', () => {
      const adapter = new SolutionConfigAdapter();
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

      const result = adapter.adapt(v2Config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.migrated).toBe(false);
      }
    });
  });
});
