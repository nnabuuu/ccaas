/**
 * SandboxService unit tests — mode resolution, spec shape, deny/steer
 * behavior. Doesn't spawn the MCP server (that's covered by e2e).
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { SandboxService, SANDBOX_BASH_MCP_NAME } from './sandbox.service';

async function svcWith(bashSandbox: string | undefined, workspaceDir = '/tmp/wd') {
  const module = await Test.createTestingModule({
    providers: [
      SandboxService,
      {
        provide: ConfigService,
        useValue: {
          get: (k: string, d?: unknown) => {
            if (k === 'workspace.bashSandbox') return bashSandbox ?? d;
            if (k === 'workspace.dir') return workspaceDir;
            return d;
          },
        },
      },
    ],
  }).compile();
  return module.get(SandboxService);
}

describe('SandboxService', () => {
  it('mode=none → enabled=false, all helpers return null/empty', async () => {
    const s = await svcWith('none');
    expect(s.mode).toBe('none');
    expect(s.enabled).toBe(false);
    expect(s.bashMcpSpec('/some/path')).toBeNull();
    expect(s.disallowedTools()).toEqual([]);
    expect(s.systemPromptSteer()).toBe('');
  });

  it('mode=just-bash → enabled=true, all helpers populated', async () => {
    const s = await svcWith('just-bash');
    expect(s.enabled).toBe(true);
    expect(s.disallowedTools()).toEqual(['Bash']);
    expect(s.systemPromptSteer()).toContain(SANDBOX_BASH_MCP_NAME);
    expect(s.systemPromptSteer()).toMatch(/built-in Bash/i);
  });

  it('bashMcpSpec uses the current Node binary + workspaceDir as CCAAS_SANDBOX_ROOT', async () => {
    const s = await svcWith('just-bash');
    const spec = s.bashMcpSpec('/my/session/dir');
    expect(spec).not.toBeNull();
    expect(spec!.name).toBe(SANDBOX_BASH_MCP_NAME);
    expect(spec!.command).toBe(process.execPath);
    expect(spec!.args[0]).toMatch(/just-bash-mcp\/server\.mjs$/);
    expect(spec!.env?.CCAAS_SANDBOX_ROOT).toBe('/my/session/dir');
    expect(spec!.env?.PATH).toBe(process.env.PATH ?? '');
  });

  it('bashMcpSpec sets CCAAS_SANDBOX_MCP_LOG under workspace.dir/_sandbox_logs/', async () => {
    const s = await svcWith('just-bash', '/var/agentfs');
    const spec = s.bashMcpSpec('/whatever');
    expect(spec!.env?.CCAAS_SANDBOX_MCP_LOG).toBe(
      '/var/agentfs/_sandbox_logs/bash-mcp.log',
    );
  });

  it('reserved MCP name is ccaas-prefixed to avoid solution collisions', () => {
    expect(SANDBOX_BASH_MCP_NAME.startsWith('__')).toBe(true);
    expect(SANDBOX_BASH_MCP_NAME).toBe('__ccaas_bash');
  });
});
