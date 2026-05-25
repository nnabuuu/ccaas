/**
 * AgentfsWorkspaceProvider — integration test.
 *
 * Gated by INTEGRATION_AGENTFS=1 (CI default: skip). Requires:
 *   - agentfs binary on PATH (or WORKSPACE_AGENTFS_BIN set)
 *   - /dev/fuse (Linux) or NFS mount permission (macOS)
 *   - typically needs --privileged or equivalent in containers
 *
 * Verifies the four primitives end-to-end: create → mount visible to host,
 * write into mount lands on disk via delta, close → unmount, destroy → all gone.
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Skill } from '../../skills/entities/skill.entity';
import { SkillFile } from '../../skills/entities/skill-file.entity';
import { McpServer } from '../../mcp/entities/mcp-server.entity';
import { BaseMaterializer } from '@kedge-agentic/agentfs-runtime';
import { AgentfsWorkspaceProvider } from './agentfs-provider';

const ENABLED = process.env.INTEGRATION_AGENTFS === '1';
const describeIf = ENABLED ? describe : describe.skip;

describeIf('AgentfsWorkspaceProvider [integration]', () => {
  let provider: AgentfsWorkspaceProvider;
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'afs-int-'));
    const module = await Test.createTestingModule({
      providers: [
        AgentfsWorkspaceProvider,
        BaseMaterializer,
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, d?: string) => {
              if (k === 'workspace.dir') return workspaceRoot;
              if (k === 'workspace.provider') return 'agentfs';
              if (k === 'workspace.agentfs.binPath') return process.env.WORKSPACE_AGENTFS_BIN || 'agentfs';
              return d;
            },
          },
        },
        { provide: getRepositoryToken(Skill),     useValue: { find: jest.fn(async () => []) } },
        { provide: getRepositoryToken(SkillFile), useValue: { find: jest.fn(async () => []) } },
        { provide: getRepositoryToken(McpServer), useValue: { find: jest.fn(async () => []) } },
      ],
    }).compile();
    provider = module.get(AgentfsWorkspaceProvider);
    await provider.onModuleInit();
  });

  afterEach(async () => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('create() mounts a writable fs at the expected path', async () => {
    const sid = `int${Date.now()}`;
    const handle = await provider.create({ sessionId: sid });
    try {
      expect(handle.path).toBe(path.join(workspaceRoot, 'sessions', sid));
      // mount visible in `mount` output
      const mounts = execFileSync('mount', [], { encoding: 'utf8' });
      const seen = mounts.includes(handle.path) || mounts.includes(`/private${handle.path}`);
      expect(seen).toBe(true);
      // write + readback
      fs.writeFileSync(path.join(handle.path, 'hello.txt'), 'hi');
      expect(fs.readFileSync(path.join(handle.path, 'hello.txt'), 'utf8')).toBe('hi');
      // delta db materialized under _agentfs_deltas/{sid}/.agentfs/{sid}.db
      const deltaPath = path.join(workspaceRoot, '_agentfs_deltas', sid, '.agentfs', `${sid}.db`);
      expect(fs.existsSync(deltaPath)).toBe(true);
    } finally {
      await provider.destroy(sid);
    }
  }, 30_000);

  it('close() unmounts but keeps the delta db on disk', async () => {
    const sid = `intkeep${Date.now()}`;
    const handle = await provider.create({ sessionId: sid });
    const deltaPath = path.join(workspaceRoot, '_agentfs_deltas', sid, '.agentfs', `${sid}.db`);
    await provider.close(sid);
    // mount no longer present
    const mounts = execFileSync('mount', [], { encoding: 'utf8' });
    expect(mounts).not.toContain(handle.path);
    // db still on disk
    expect(fs.existsSync(deltaPath)).toBe(true);
    // tidy
    await provider.destroy(sid);
  }, 30_000);

  it('concurrent create() calls dedup on the same sessionId', async () => {
    const sid = `intdedup${Date.now()}`;
    try {
      const results = await Promise.all([
        provider.create({ sessionId: sid }),
        provider.create({ sessionId: sid }),
        provider.create({ sessionId: sid }),
      ]);
      // All three resolve to the same handle path (only one daemon spawned)
      expect(results[0].path).toBe(results[1].path);
      expect(results[1].path).toBe(results[2].path);
    } finally {
      await provider.destroy(sid);
    }
  }, 30_000);
});
