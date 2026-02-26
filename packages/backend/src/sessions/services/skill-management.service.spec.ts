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
});
