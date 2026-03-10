import { Test, TestingModule } from '@nestjs/testing';
import { SkillManagementService } from './skill-management.service';
import { SkillsService } from '../../skills/skills.service';

describe('SkillManagementService', () => {
  let service: SkillManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillManagementService,
        { provide: SkillsService, useValue: {} },
      ],
    }).compile();

    service = module.get<SkillManagementService>(SkillManagementService);
  });

  describe('generateToolRegistryPrompt', () => {
    it('should return empty string for empty entries', () => {
      expect(service.generateToolRegistryPrompt([])).toBe('');
    });

    it('should generate markdown table with select: queries', () => {
      const entries = [
        { toolName: 'suggest_questions', mcpPrefixedName: 'mcp__live-lesson-tools__suggest_questions' },
        { toolName: 'advance_beat', mcpPrefixedName: 'mcp__live-lesson-tools__advance_beat' },
      ];

      const result = service.generateToolRegistryPrompt(entries);

      expect(result).toContain('## MCP Tool Registry');
      expect(result).toContain('| suggest_questions | ToolSearch("select:mcp__live-lesson-tools__suggest_questions") |');
      expect(result).toContain('| advance_beat | ToolSearch("select:mcp__live-lesson-tools__advance_beat") |');
      expect(result).toContain('Load all needed tools proactively');
    });

    it('should include table header', () => {
      const entries = [
        { toolName: 'my_tool', mcpPrefixedName: 'mcp__server__my_tool' },
      ];

      const result = service.generateToolRegistryPrompt(entries);

      expect(result).toContain('| Tool | Load command |');
      expect(result).toContain('|------|-------------|');
    });
  });

  describe('generateMixedSkillPrompt', () => {
    const skills = [
      { slug: 'skill-a', name: 'Skill A' },
      { slug: 'skill-b', name: 'Skill B' },
      { slug: 'skill-c', name: 'Skill C' },
    ];

    let inlineSpy: jest.SpyInstance;
    let protocolSpy: jest.SpyInstance;

    beforeEach(() => {
      inlineSpy = jest.spyOn(service, 'generateInlineSkillPrompt')
        .mockResolvedValue('INLINE_CONTENT');
      protocolSpy = jest.spyOn(service, 'generateSkillSystemPrompt')
        .mockReturnValue('PROTOCOL_CONTENT');
    });

    afterEach(() => {
      inlineSpy.mockRestore();
      protocolSpy.mockRestore();
    });

    it('should split skills by promptModeMap overrides', async () => {
      const result = await service.generateMixedSkillPrompt(
        '/workspace',
        skills,
        { 'skill-b': 'protocol', 'skill-c': 'protocol' },
        'inline', // default: inline
      );

      // skill-a has no override → defaults to inline
      // skill-b, skill-c → protocol
      expect(inlineSpy).toHaveBeenCalledWith('/workspace', [skills[0]]);
      expect(protocolSpy).toHaveBeenCalledWith([skills[1], skills[2]]);
      expect(result).toContain('INLINE_CONTENT');
      expect(result).toContain('PROTOCOL_CONTENT');
      expect(result).toContain('---');
    });

    it('should handle all skills as inline (no protocol section)', async () => {
      const result = await service.generateMixedSkillPrompt(
        '/workspace',
        skills,
        {}, // no overrides
        'inline', // all default to inline
      );

      expect(inlineSpy).toHaveBeenCalledWith('/workspace', skills);
      expect(protocolSpy).not.toHaveBeenCalled();
      expect(result).toBe('INLINE_CONTENT');
    });

    it('should handle all skills as protocol (no inline section)', async () => {
      const result = await service.generateMixedSkillPrompt(
        '/workspace',
        skills,
        {}, // no overrides
        'protocol', // all default to protocol
      );

      expect(inlineSpy).not.toHaveBeenCalled();
      expect(protocolSpy).toHaveBeenCalledWith(skills);
      expect(result).toBe('PROTOCOL_CONTENT');
    });

    it('should return undefined for empty skills array', async () => {
      const result = await service.generateMixedSkillPrompt(
        '/workspace',
        [],
        {},
        'inline',
      );

      expect(inlineSpy).not.toHaveBeenCalled();
      expect(protocolSpy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should return undefined when both delegates return no content', async () => {
      inlineSpy.mockResolvedValue(undefined);
      protocolSpy.mockReturnValue('');

      const result = await service.generateMixedSkillPrompt(
        '/workspace',
        skills,
        { 'skill-a': 'inline' },
        'protocol',
      );

      expect(result).toBeUndefined();
    });

    it('should use separator between inline and protocol sections', async () => {
      const result = await service.generateMixedSkillPrompt(
        '/workspace',
        [skills[0], skills[1]],
        { 'skill-b': 'protocol' },
        'inline',
      );

      expect(result).toBe('INLINE_CONTENT\n\n---\n\nPROTOCOL_CONTENT');
    });
  });

  describe('generateSkillSystemPrompt', () => {
    it('should return empty string for empty skills', () => {
      expect(service.generateSkillSystemPrompt([])).toBe('');
    });

    it('should list skills with protocol instructions', () => {
      const result = service.generateSkillSystemPrompt([
        { slug: 'my-skill', name: 'My Skill', description: 'Does things' },
      ]);

      expect(result).toContain('SKILL USAGE PROTOCOL');
      expect(result).toContain('**My Skill** (`my-skill`): Does things');
      expect(result).toContain('Read(".claude/skills/{skill-slug}/SKILL.md")');
    });
  });
});
