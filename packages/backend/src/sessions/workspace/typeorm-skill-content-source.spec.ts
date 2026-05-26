/**
 * TypeOrmSkillContentSource adapter tests.
 *
 * Verifies the mapping from TypeORM entity rows → pure value objects
 * the materializer consumes. Repo `find` is mocked; the test asserts
 * shape and the two normalizations we promised:
 *   - `Skill.description: null` → undefined on the VO
 *   - `McpServer.config: string` → JSON.parse-d object
 *
 * The materializer's own behavior is tested in the agent-runtime
 * package (workspace sub-module); this spec covers only the adapter layer.
 */

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TypeOrmSkillContentSource } from './typeorm-skill-content-source';
import { Skill } from '../../skills/entities/skill.entity';
import { McpServer } from '../../mcp/entities/mcp-server.entity';

async function build(opts: { skills?: any[]; mcps?: any[] } = {}) {
  const { skills = [], mcps = [] } = opts;
  const skillsRepo = { find: jest.fn(async () => skills) };
  const mcpRepo = { find: jest.fn(async () => mcps) };
  const module = await Test.createTestingModule({
    providers: [
      TypeOrmSkillContentSource,
      { provide: getRepositoryToken(Skill), useValue: skillsRepo },
      { provide: getRepositoryToken(McpServer), useValue: mcpRepo },
    ],
  }).compile();
  return {
    svc: module.get(TypeOrmSkillContentSource),
    skillsRepo,
    mcpRepo,
  };
}

describe('TypeOrmSkillContentSource', () => {
  describe('listActiveSkills', () => {
    it('maps Skill rows to SkillContent VOs including embedded files', async () => {
      const { svc } = await build({
        skills: [
          {
            id: 's-1', solutionId: 't-1', slug: 'hello',
            name: 'Hello', description: 'a skill', content: '# H\n',
            files: [
              { relativePath: 'tools/x.md', content: 'xx' },
              { relativePath: 'README.md', content: 'rr' },
            ],
          },
        ],
      });
      const out = await svc.listActiveSkills();
      expect(out).toEqual([{
        id: 's-1', solutionId: 't-1', slug: 'hello',
        name: 'Hello', description: 'a skill', content: '# H\n',
        files: [
          { relativePath: 'tools/x.md', content: 'xx' },
          { relativePath: 'README.md', content: 'rr' },
        ],
      }]);
    });

    it('normalizes description: null → undefined', async () => {
      const { svc } = await build({
        skills: [{
          id: 's-1', solutionId: 't-1', slug: 'h', name: '', description: null,
          content: '', files: [],
        }],
      });
      const [s] = await svc.listActiveSkills();
      expect(s.description).toBeUndefined();
    });

    it('treats undefined files as empty array (defensive)', async () => {
      const { svc } = await build({
        skills: [{
          id: 's-1', solutionId: 't-1', slug: 'h', name: '', description: null,
          content: '',
          // no files property at all (e.g. relation not loaded)
        }],
      });
      const [s] = await svc.listActiveSkills();
      expect(s.files).toEqual([]);
    });

    it('queries with where.enabled=true + relations=[files]', async () => {
      const { svc, skillsRepo } = await build({ skills: [] });
      await svc.listActiveSkills();
      expect(skillsRepo.find).toHaveBeenCalledWith({
        where: { enabled: true },
        relations: ['files'],
      });
    });
  });

  describe('listActiveMcpServers', () => {
    it('maps McpServer rows to McpServerContent VOs', async () => {
      const { svc } = await build({
        mcps: [{
          id: 'm-1', solutionId: 't-1', slug: 'srv',
          name: 'My', type: 'stdio',
          config: { command: 'node', args: ['x.js'] },
        }],
      });
      const out = await svc.listActiveMcpServers();
      expect(out).toEqual([{
        solutionId: 't-1', slug: 'srv',
        name: 'My', type: 'stdio',
        config: { command: 'node', args: ['x.js'] },
      }]);
    });

    it('parses legacy JSON-stringified config', async () => {
      const { svc } = await build({
        mcps: [{
          solutionId: 't', slug: 's', name: '', type: 'stdio',
          config: '{"command":"node","args":["x.js"]}',
        }],
      });
      const [m] = await svc.listActiveMcpServers();
      expect(m.config).toEqual({ command: 'node', args: ['x.js'] });
    });

    it('filters by status=active', async () => {
      const { svc, mcpRepo } = await build({ mcps: [] });
      await svc.listActiveMcpServers();
      expect(mcpRepo.find).toHaveBeenCalledWith({ where: { status: 'active' } });
    });
  });
});
