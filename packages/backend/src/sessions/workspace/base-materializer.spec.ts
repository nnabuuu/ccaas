/**
 * BaseMaterializer unit tests — mocks repos, verifies the projected tree.
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Skill } from '../../skills/entities/skill.entity';
import { SkillFile } from '../../skills/entities/skill-file.entity';
import { McpServer } from '../../mcp/entities/mcp-server.entity';
import { BaseMaterializer } from './base-materializer';

async function setup(baseDir: string, fixtures: {
  skills?: any[]; skillFiles?: any[]; mcpServers?: any[];
} = {}) {
  const { skills = [], skillFiles = [], mcpServers = [] } = fixtures;
  const module = await Test.createTestingModule({
    providers: [
      BaseMaterializer,
      {
        provide: ConfigService,
        useValue: {
          get: (k: string, d?: string) => {
            if (k === 'workspace.dir') return baseDir;
            if (k === 'workspace.agentfs.baseDir') return ''; // use default under workspace.dir
            return d;
          },
        },
      },
      { provide: getRepositoryToken(Skill),     useValue: { find: jest.fn(async () => skills) } },
      { provide: getRepositoryToken(SkillFile), useValue: { find: jest.fn(async () => skillFiles) } },
      { provide: getRepositoryToken(McpServer), useValue: { find: jest.fn(async () => mcpServers) } },
    ],
  }).compile();
  return module.get(BaseMaterializer);
}

describe('BaseMaterializer', () => {
  let tmpRoot: string;
  beforeEach(() => { tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-')); });
  afterEach(()  => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

  it('writes SKILL.md + .skill.json per skill', async () => {
    const bm = await setup(tmpRoot, {
      skills: [{
        id: 's1', tenantId: 't1', slug: 'hello',
        name: 'Hello', description: 'desc', content: '# Hello\n', enabled: true,
      }],
    });
    const result = await bm.materialize();
    expect(result.skillsWritten).toBe(1);

    const skillDir = path.join(tmpRoot, '_agentfs_base', 'tenants', 't1', 'skills', 'hello');
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe('# Hello\n');
    const meta = JSON.parse(fs.readFileSync(path.join(skillDir, '.skill.json'), 'utf8'));
    expect(meta).toEqual({ id: 's1', name: 'Hello', description: 'desc' });
  });

  it('writes skill_files at relative paths under their skill dir', async () => {
    const bm = await setup(tmpRoot, {
      skills: [{ id: 's1', tenantId: 't1', slug: 'hello', name: '', description: null, content: '', enabled: true }],
      skillFiles: [
        { skillId: 's1', relativePath: 'examples/a.md', content: 'aaa' },
        { skillId: 's1', relativePath: 'README.md',     content: 'rr'  },
        { skillId: 'orphan', relativePath: 'x.md',      content: 'xx'  }, // owner missing → skipped
      ],
    });
    const result = await bm.materialize();
    expect(result.skillFilesWritten).toBe(2);

    const root = path.join(tmpRoot, '_agentfs_base', 'tenants', 't1', 'skills', 'hello');
    expect(fs.readFileSync(path.join(root, 'examples/a.md'), 'utf8')).toBe('aaa');
    expect(fs.readFileSync(path.join(root, 'README.md'),    'utf8')).toBe('rr');
    expect(fs.existsSync(path.join(tmpRoot, '_agentfs_base/tenants/t1/skills/hello/x.md'))).toBe(false);
  });

  it('writes mcp-servers config.json (parses string config)', async () => {
    const bm = await setup(tmpRoot, {
      mcpServers: [{
        id: 'm1', tenantId: 't1', slug: 'srv', name: 'My MCP',
        type: 'stdio', config: '{"command":"node","args":["x.js"]}',
      }],
    });
    const result = await bm.materialize();
    expect(result.mcpServersWritten).toBe(1);

    const cfg = JSON.parse(fs.readFileSync(
      path.join(tmpRoot, '_agentfs_base/tenants/t1/mcp-servers/srv/config.json'),
      'utf8',
    ));
    expect(cfg).toEqual({ name: 'My MCP', type: 'stdio', config: { command: 'node', args: ['x.js'] } });
  });

  it('is idempotent — second run writes nothing when content unchanged', async () => {
    const bm = await setup(tmpRoot, {
      skills: [{ id: 's1', tenantId: 't1', slug: 'hello', name: 'H', description: null, content: 'x', enabled: true }],
    });
    await bm.materialize();
    const mtimeBefore = fs.statSync(
      path.join(tmpRoot, '_agentfs_base/tenants/t1/skills/hello/SKILL.md'),
    ).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await bm.materialize();
    const mtimeAfter = fs.statSync(
      path.join(tmpRoot, '_agentfs_base/tenants/t1/skills/hello/SKILL.md'),
    ).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it('respects WORKSPACE_AGENTFS_BASE_DIR override when set', async () => {
    const custom = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-custom-'));
    try {
      const module = await Test.createTestingModule({
        providers: [
          BaseMaterializer,
          {
            provide: ConfigService,
            useValue: {
              get: (k: string, d?: string) => {
                if (k === 'workspace.dir') return tmpRoot;
                if (k === 'workspace.agentfs.baseDir') return custom;
                return d;
              },
            },
          },
          { provide: getRepositoryToken(Skill),     useValue: { find: jest.fn(async () => []) } },
          { provide: getRepositoryToken(SkillFile), useValue: { find: jest.fn(async () => []) } },
          { provide: getRepositoryToken(McpServer), useValue: { find: jest.fn(async () => []) } },
        ],
      }).compile();
      const bm = module.get(BaseMaterializer);
      expect(bm.getBaseDir()).toBe(custom);
    } finally {
      fs.rmSync(custom, { recursive: true, force: true });
    }
  });
});
