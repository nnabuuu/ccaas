/**
 * LocalWorkspaceProvider — preserves today's behavior bit-identically.
 *
 * Wraps the inline mkdir + settings.local.json writes that lived in
 * SessionService.getOrCreateSession before this refactor. MCP symlinks
 * are deliberately NOT created here — the existing
 * `SessionService.createMcpSymlinks(session)` path (called from the
 * gateway once `session.mcpServers` is wired in) does that, and that
 * path works identically for both providers since the mount point /
 * plain dir both expose a real fs path.
 *
 * close()/destroy() semantics:
 *   - close() is a no-op (SessionService.closeSession does NOT delete the dir today)
 *   - destroy() is provided for future use (e.g. admin teardown) and does rm -rf
 *
 * Capabilities: none — no snapshot, no multi-mount, no fast clone.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  CreateOpts, WorkspaceCapabilities, WorkspaceHandle, WorkspaceProvider,
} from './types';

const DEFAULT_SETTINGS = {
  permissions: {
    allow: ['Bash(*)', 'Write(*)', 'Edit(*)', 'Read(*)'],
    deny: [],
  },
  // Disable global plugins to prevent conflicts with workspace skills —
  // solutions manage their own skills via ccaas db.
  enabledPlugins: {},
};

@Injectable()
export class LocalWorkspaceProvider implements WorkspaceProvider {
  private readonly logger = new Logger(LocalWorkspaceProvider.name);
  private readonly workspaceRoot: string;

  constructor(@Inject(ConfigService) private readonly cfg: ConfigService) {
    this.workspaceRoot = this.cfg.get<string>('workspace.dir', '.agent-workspace');
  }

  async create(opts: CreateOpts): Promise<WorkspaceHandle> {
    const sessionPath = path.join(this.workspaceRoot, 'sessions', opts.sessionId);

    fs.mkdirSync(sessionPath, { recursive: true });

    const claudeDir = path.join(sessionPath, '.claude');
    fs.mkdirSync(path.join(claudeDir, 'mcp-servers'), { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
    );

    return {
      sessionId: opts.sessionId,
      path: sessionPath,
    };
  }

  async close(_sessionId: string): Promise<void> {
    // Matches today's `SessionService.closeSession` which leaves the dir on disk.
  }

  async destroy(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.workspaceRoot, 'sessions', sessionId);
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      this.logger.log(`Destroyed local workspace at ${sessionPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`destroy ${sessionId}: ${msg}`);
    }
  }

  capabilities(): WorkspaceCapabilities {
    return { snapshot: false, multiMount: false, fastClone: false, observability: false };
  }
}
