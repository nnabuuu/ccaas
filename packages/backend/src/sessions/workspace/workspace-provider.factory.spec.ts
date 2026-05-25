/**
 * WorkspaceProviderFactory selects implementation by config.
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Skill } from '../../skills/entities/skill.entity';
import { SkillFile } from '../../skills/entities/skill-file.entity';
import { McpServer } from '../../mcp/entities/mcp-server.entity';
import { LocalWorkspaceProvider } from './local-provider';
import { AgentfsWorkspaceProvider } from './agentfs-provider';
import { BaseMaterializer } from '@kedge-agentic/agentfs-runtime';
import { WorkspaceProviderFactory } from './workspace-provider.factory';
import { WORKSPACE_PROVIDER } from './types';

const repoMock = { find: jest.fn(async () => []) };

async function setup(providerName: string) {
  return Test.createTestingModule({
    providers: [
      LocalWorkspaceProvider,
      AgentfsWorkspaceProvider,
      BaseMaterializer,
      WorkspaceProviderFactory,
      { provide: getRepositoryToken(Skill),     useValue: repoMock },
      { provide: getRepositoryToken(SkillFile), useValue: repoMock },
      { provide: getRepositoryToken(McpServer), useValue: repoMock },
      {
        provide: ConfigService,
        useValue: {
          get: (k: string, d?: string) => {
            if (k === 'workspace.provider') return providerName;
            if (k === 'workspace.dir') return '/tmp/test-vfs';
            return d;
          },
        },
      },
    ],
  }).compile();
}

describe('WorkspaceProviderFactory', () => {
  it('returns LocalWorkspaceProvider when config.workspace.provider=local', async () => {
    const m = await setup('local');
    const local = m.get(LocalWorkspaceProvider);
    const resolved = m.get(WORKSPACE_PROVIDER);
    expect(resolved).toBe(local);
  });

  it('returns AgentfsWorkspaceProvider when config.workspace.provider=agentfs', async () => {
    const m = await setup('agentfs');
    const agentfs = m.get(AgentfsWorkspaceProvider);
    const resolved = m.get(WORKSPACE_PROVIDER);
    expect(resolved).toBe(agentfs);
  });

  it('defaults to local when unset', async () => {
    const m = await Test.createTestingModule({
      providers: [
        LocalWorkspaceProvider,
        AgentfsWorkspaceProvider,
        BaseMaterializer,
        WorkspaceProviderFactory,
          { provide: getRepositoryToken(Skill),     useValue: repoMock },
        { provide: getRepositoryToken(SkillFile), useValue: repoMock },
        { provide: getRepositoryToken(McpServer), useValue: repoMock },
        {
          provide: ConfigService,
          useValue: { get: (_k: string, d?: string) => d },
        },
      ],
    }).compile();
    const local = m.get(LocalWorkspaceProvider);
    expect(m.get(WORKSPACE_PROVIDER)).toBe(local);
  });

  it('throws for unknown provider name', async () => {
    await expect(setup('bogus')).rejects.toThrow(/unknown workspace\.provider/);
  });
});
