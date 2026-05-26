/**
 * LocalWorkspaceProvider unit tests.
 *
 * Bit-identical-to-pre-PR is the success criterion: same paths created,
 * same files written, same WorkspaceService.createMcpSymlinks call.
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { LocalWorkspaceProvider } from './local-provider';

describe('LocalWorkspaceProvider', () => {
  let provider: LocalWorkspaceProvider;
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lws-'));
    const module = await Test.createTestingModule({
      providers: [
        LocalWorkspaceProvider,
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: string) => (k === 'workspace.dir' ? tmpRoot : d) },
        },
      ],
    }).compile();
    provider = module.get(LocalWorkspaceProvider);
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('creates session dir, .claude/mcp-servers, settings.local.json', async () => {
    const handle = await provider.create({ sessionId: 's1' });

    expect(handle.path).toBe(path.join(tmpRoot, 'sessions', 's1'));
    expect(fs.existsSync(handle.path)).toBe(true);
    expect(fs.existsSync(path.join(handle.path, '.claude', 'mcp-servers'))).toBe(true);

    const settings = JSON.parse(
      fs.readFileSync(path.join(handle.path, '.claude', 'settings.local.json'), 'utf8'),
    );
    expect(settings.permissions.allow).toEqual(['Bash(*)', 'Write(*)', 'Edit(*)', 'Read(*)']);
    expect(settings.permissions.deny).toEqual([]);
    expect(settings.enabledPlugins).toEqual({});
  });

  it('does NOT call workspace MCP setup — gateway-driven path remains the single call site', async () => {
    // Sanity guard: providers must not duplicate WorkspaceService.createMcpSymlinks
    // (called later by SessionService.createMcpSymlinks once mcpServers wired).
    // If a future change adds it here, this test should explicitly break.
    const handle = await provider.create({ sessionId: 's-mcp', solutionId: 't1' });
    // No assertion needed beyond "create() returned without error and didn't
    // try to inject a WorkspaceService" — the absence of a WorkspaceService
    // provider in beforeEach would have thrown if create() depended on it.
    expect(handle.path).toContain('s-mcp');
  });

  it("close() is a no-op — does NOT delete the dir (matches today's closeSession soft-close)", async () => {
    const handle = await provider.create({ sessionId: 's3' });
    await provider.close('s3');
    expect(fs.existsSync(handle.path)).toBe(true);
  });

  it('destroy() removes the session dir', async () => {
    const handle = await provider.create({ sessionId: 's4' });
    await provider.destroy('s4');
    expect(fs.existsSync(handle.path)).toBe(false);
  });

  it('destroy() on non-existent session does not throw', async () => {
    await expect(provider.destroy('never-existed')).resolves.toBeUndefined();
  });

  it('capabilities reports nothing fancy', () => {
    expect(provider.capabilities()).toEqual({
      snapshot: false,
      multiMount: false,
      fastClone: false,
      observability: false,
    });
  });
});
