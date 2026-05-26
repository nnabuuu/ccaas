/**
 * TypeOrmSkillContentSource — TypeORM-backed adapter for
 * `ContentSource` (from @kedge-agentic/agent-runtime).
 *
 * This is the *adapter* in the clean-architecture sense: it knows
 * about TypeORM, NestJS, our specific `Skill` / `SkillFile` / `McpServer`
 * entities, and translates them into the value objects the pure
 * BaseMaterializer consumes. The materializer never imports any of
 * that.
 *
 * Why a single adapter and not three: the materializer already needs
 * skills + their files joined (each skill's sub-files written under
 * the skill's dir). Loading `relations: ['files']` in one query is
 * cheaper than fetching SkillFile separately and joining in memory —
 * which is what the previous standalone BaseMaterializer used to do.
 * The orphan-SkillFile filter that the old code maintained moves
 * here implicitly: TypeORM's `relations` join only returns files
 * whose `skillId` matches a parent.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  ContentSource,
  SkillContent,
  McpServerContent,
} from '@kedge-agentic/agent-runtime';

import { Skill } from '../../skills/entities/skill.entity';
import { McpServer } from '../../mcp/entities/mcp-server.entity';
import type { McpServerStatus } from '../../mcp/types';

@Injectable()
export class TypeOrmSkillContentSource implements ContentSource {
  constructor(
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(McpServer) private readonly mcpServers: Repository<McpServer>,
  ) {}

  async listActiveSkills(): Promise<ReadonlyArray<SkillContent>> {
    const rows = await this.skills.find({
      where: { enabled: true },
      relations: ['files'],
    });
    return rows.map((s) => ({
      id: s.id,
      solutionId: s.solutionId,
      slug: s.slug,
      name: s.name,
      description: s.description ?? undefined,
      content: s.content,
      files: (s.files ?? []).map((f) => ({
        relativePath: f.relativePath,
        content: f.content,
      })),
    }));
  }

  async listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>> {
    const ACTIVE: McpServerStatus = 'active';
    const rows = await this.mcpServers.find({ where: { status: ACTIVE } });
    return rows.map((m) => ({
      solutionId: m.solutionId,
      slug: m.slug,
      name: m.name,
      type: m.type,
      // Persisted config may be a JSON string (legacy rows) or an object
      // (newer rows); normalize so the materializer always sees an object.
      config: typeof m.config === 'string' ? JSON.parse(m.config) : m.config,
    }));
  }
}
