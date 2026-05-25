/**
 * BaseMaterializer — projects ccaas skills + mcp servers onto a host
 * directory tree that agentfs `--base` overlays into every session mount.
 *
 * Design rationale + sanity-check derivation:
 *   `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md` ("BaseMaterializer" section).
 * Originally prototyped in vfs-poc with raw better-sqlite3; this production
 * version uses TypeORM repositories. Output layout matches the
 * existing `tenants/{tenantId}/skills/{slug}/` + `mcp-servers/{slug}/`
 * convention so claude sees identical relative paths whether running
 * in a plain local workspace dir or in an agentfs overlay mount.
 *
 * Idempotent — only writes files whose sha1 changed. Safe to run
 * repeatedly (and is, at backend startup when WORKSPACE_PROVIDER=agentfs).
 *
 * Only invoked by AgentfsWorkspaceProvider. Local provider doesn't need
 * a base — its sessions are plain dirs.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Skill } from '../../skills/entities/skill.entity';
import { SkillFile } from '../../skills/entities/skill-file.entity';
import { McpServer } from '../../mcp/entities/mcp-server.entity';
import type { McpServerStatus } from '../../mcp/types';

export interface MaterializeResult {
  baseDir: string;
  skillsWritten: number;
  skillFilesWritten: number;
  mcpServersWritten: number;
  durationMs: number;
}

@Injectable()
export class BaseMaterializer {
  private readonly logger = new Logger(BaseMaterializer.name);
  private readonly baseDir: string;

  constructor(
    @Inject(ConfigService) cfg: ConfigService,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(SkillFile) private readonly skillFiles: Repository<SkillFile>,
    @InjectRepository(McpServer) private readonly mcpServers: Repository<McpServer>,
  ) {
    const workspaceRoot = cfg.get<string>('workspace.dir', '.agent-workspace');
    this.baseDir = cfg.get<string>('workspace.agentfs.baseDir', '')
      || path.join(workspaceRoot, '_agentfs_base');
  }

  /** Path that agentfs init should use as `--base`. */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Run a full pass: enumerate active skills + active mcp servers,
   * write any whose content changed since the previous run.
   */
  async materialize(): Promise<MaterializeResult> {
    const t0 = Date.now();
    fs.mkdirSync(this.baseDir, { recursive: true });

    // enabled: true is the canonical "active" filter; SkillStatus enum
    // doesn't even include 'deleted' so the vfs-poc-style defensive
    // status check is unnecessary in backend.
    const activeSkills = await this.skills.find({ where: { enabled: true } });

    let skillsWritten = 0;
    for (const s of activeSkills) {
      const skillDir = path.join(this.baseDir, 'tenants', s.tenantId, 'skills', s.slug);
      this.writeIfChanged(path.join(skillDir, 'SKILL.md'), s.content);
      this.writeIfChanged(
        path.join(skillDir, '.skill.json'),
        JSON.stringify({ id: s.id, name: s.name, description: s.description }, null, 2),
      );
      skillsWritten++;
    }

    let skillFilesWritten = 0;
    const skillById = new Map(activeSkills.map((s) => [s.id, s]));
    for (const f of await this.skillFiles.find()) {
      const owner = skillById.get(f.skillId);
      if (!owner) continue;
      this.writeIfChanged(
        path.join(this.baseDir, 'tenants', owner.tenantId, 'skills', owner.slug, f.relativePath),
        f.content,
      );
      skillFilesWritten++;
    }

    let mcpServersWritten = 0;
    const ACTIVE: McpServerStatus = 'active';
    const activeMcps = await this.mcpServers.find({ where: { status: ACTIVE } });
    for (const m of activeMcps) {
      const cfgObj = typeof m.config === 'string' ? JSON.parse(m.config) : m.config;
      this.writeIfChanged(
        path.join(this.baseDir, 'tenants', m.tenantId, 'mcp-servers', m.slug, 'config.json'),
        JSON.stringify({ name: m.name, type: m.type, config: cfgObj }, null, 2),
      );
      mcpServersWritten++;
    }

    const result: MaterializeResult = {
      baseDir: this.baseDir,
      skillsWritten,
      skillFilesWritten,
      mcpServersWritten,
      durationMs: Date.now() - t0,
    };
    this.logger.log(
      `materialized ${skillsWritten} skills (${skillFilesWritten} files) + ` +
      `${mcpServersWritten} mcp servers → ${this.baseDir} (${result.durationMs}ms)`,
    );
    return result;
  }

  private writeIfChanged(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath);
      if (sha1(existing) === sha1(content)) return;
    }
    fs.writeFileSync(filePath, content);
  }
}

function sha1(buf: Buffer | string): string {
  return createHash('sha1').update(buf).digest('hex');
}
