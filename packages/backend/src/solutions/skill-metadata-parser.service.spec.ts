import { SkillMetadataParserService } from './skill-metadata-parser.service';
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

  // ==========================================================================
  // 1. Valid SKILL.md with standard frontmatter (name + description only)
  // ==========================================================================

  describe('valid SKILL.md with standard frontmatter', () => {
    it('should parse name and description, return source=frontmatter', async () => {
      const content = [
        '---',
        'name: three-column-analysis',
        'description: "Triple-column quiz analysis"',
        '---',
        '',
        '# Skill: Three Column Analysis',
        '',
        'This is the skill body.',
      ].join('\n');

      const filePath = await writeSkillFile('three-column-analysis', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.name).toBe('three-column-analysis');
      expect(result.frontmatter.description).toBe('Triple-column quiz analysis');
      expect(result.content).toContain('# Skill: Three Column Analysis');
      expect(result.content).toContain('This is the skill body.');
      expect(result.warnings).toHaveLength(0);
    });

    it('should infer slug from directory name, not frontmatter', async () => {
      const content = [
        '---',
        'name: My Custom Name',
        'description: A skill with custom name',
        '---',
        '',
        'Body text.',
      ].join('\n');

      const filePath = await writeSkillFile('my-skill-dir', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      // slug inferred from directory name "my-skill-dir"
      expect(result.slug).toBe('my-skill-dir');
      // name comes from frontmatter
      expect(result.frontmatter.name).toBe('My Custom Name');
    });

    it('should handle unicode in frontmatter values', async () => {
      const content = [
        '---',
        'name: lesson-plan-polish',
        'description: "Based on Prof. Cui - optimize lesson plans"',
        '---',
        '',
        '# Content here',
      ].join('\n');

      const filePath = await writeSkillFile('lesson-plan-polish', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.slug).toBe('lesson-plan-polish');
    });
  });

  // ==========================================================================
  // 2. SKILL.md without frontmatter -> defaults
  // ==========================================================================

  describe('SKILL.md without frontmatter (defaults)', () => {
    it('should use defaults when no frontmatter present', async () => {
      const content = [
        '# Skill: Quiz Analysis',
        '',
        'No frontmatter here, just markdown.',
      ].join('\n');

      const filePath = await writeSkillFile('quiz-analysis', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.slug).toBe('quiz-analysis');
      expect(result.frontmatter.name).toBe('quiz-analysis');
      expect(result.frontmatter.description).toContain('Auto-discovered');
      expect(result.content).toContain('No frontmatter here');
      expect(result.warnings.some((w) => w.includes('No YAML frontmatter'))).toBe(true);
    });

    it('should use directory name as slug and name in defaults', async () => {
      const content = '# Just markdown, no frontmatter';
      const filePath = await writeSkillFile('three-column-analysis', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.slug).toBe('three-column-analysis');
      expect(result.frontmatter.name).toBe('three-column-analysis');
    });
  });

  // ==========================================================================
  // 3. Missing SKILL.md file -> defaults
  // ==========================================================================

  describe('missing SKILL.md file', () => {
    it('should return defaults when file does not exist', async () => {
      const missingPath = path.join(
        tmpDir,
        'skills',
        'nonexistent',
        'SKILL.md',
      );

      const result = await service.parseSkillFile(missingPath);

      expect(result.source).toBe('defaults');
      expect(result.slug).toBe('nonexistent');
      expect(result.frontmatter.name).toBe('nonexistent');
      expect(result.content).toBe('');
      expect(result.warnings.some((w) => w.includes('not found'))).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Invalid frontmatter -> defaults
  // ==========================================================================

  describe('invalid frontmatter', () => {
    it('should fall back to defaults when frontmatter is missing required fields', async () => {
      // Frontmatter has no name or description
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
      expect(result.slug).toBe('broken-skill');
      expect(result.frontmatter.name).toBe('broken-skill');
      expect(result.content).toContain('No useful metadata');
    });

    it('should fall back to defaults when name is present but description is missing', async () => {
      const content = [
        '---',
        'name: partial-skill',
        '---',
        '',
        '# Partial skill',
      ].join('\n');

      const filePath = await writeSkillFile('partial-skill', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.slug).toBe('partial-skill');
      expect(result.warnings.some((w) => w.includes('Invalid frontmatter'))).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty SKILL.md file', async () => {
      const filePath = await writeSkillFile('empty-skill', '');
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.slug).toBe('empty-skill');
    });

    it('should handle SKILL.md with only frontmatter delimiters', async () => {
      const content = '---\n---\n';
      const filePath = await writeSkillFile('empty-fm', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.slug).toBe('empty-fm');
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
        'description: Has numbers in path',
        '---',
        '',
        'Content.',
      ].join('\n');

      const filePath = await writeSkillFile(skillName, content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.slug).toBe('skill-with-numbers-123');
    });
  });

  // ==========================================================================
  // 6. Real-world SKILL.md formats
  // ==========================================================================

  describe('real-world SKILL.md formats', () => {
    it('should parse lesson-plan-designer style', async () => {
      const content = [
        '---',
        "name: lesson-plan-polish",
        "description: \"Optimize lesson plans based on Prof. Cui's framework\"",
        '---',
        '',
        '# Lesson Plan Polish',
        '',
        '> **Important**: Always call `read_context` first.',
      ].join('\n');

      const filePath = await writeSkillFile('lesson-plan-polish', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('frontmatter');
      expect(result.frontmatter.name).toBe('lesson-plan-polish');
      expect(result.slug).toBe('lesson-plan-polish');
      expect(result.content).toContain('Always call `read_context` first');
    });

    it('should handle quiz-analyzer style (no frontmatter, uses defaults)', async () => {
      const content = [
        '# Skill: Quiz Three-Column Analysis',
        '',
        '## Overview',
        'Provides complete quiz analysis workflow.',
      ].join('\n');

      const filePath = await writeSkillFile('three-column-analysis', content);
      const result = await service.parseSkillFile(filePath);

      expect(result.source).toBe('defaults');
      expect(result.slug).toBe('three-column-analysis');
      expect(result.content).toContain('Provides complete quiz analysis');
    });
  });
});
