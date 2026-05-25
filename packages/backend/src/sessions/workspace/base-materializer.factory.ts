/**
 * NestJS factory wiring for `BaseMaterializer` (from
 * @kedge-agentic/agentfs-runtime).
 *
 * The pure BaseMaterializer is framework-free; this factory bridges:
 *   - reads agentfs base-dir config from ConfigService
 *   - constructs a NestJS Logger bridge so the package's Logger port
 *     calls land in the standard NestJS log stream
 *   - injects the TypeORM-backed ContentSource adapter
 *
 * The provider's DI token is the `BaseMaterializer` class itself, so
 * existing `@Inject(BaseMaterializer)` consumers (notably
 * `AgentfsWorkspaceProvider`) need no change.
 */

import { Logger as NestLogger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';

import {
  BaseMaterializer,
  type Logger as PortLogger,
} from '@kedge-agentic/agentfs-runtime';

import { TypeOrmSkillContentSource } from './typeorm-skill-content-source';

/** Bridges the package's `Logger` port → NestJS `Logger`. */
class NestLoggerAdapter implements PortLogger {
  private readonly logger: NestLogger;
  constructor(name: string) {
    this.logger = new NestLogger(name);
  }
  log(m: string): void { this.logger.log(m); }
  warn(m: string): void { this.logger.warn(m); }
  error(m: string): void { this.logger.error(m); }
  debug(m: string): void { this.logger.debug(m); }
}

export const baseMaterializerProvider: Provider = {
  provide: BaseMaterializer,
  useFactory: (src: TypeOrmSkillContentSource, cfg: ConfigService): BaseMaterializer => {
    const workspaceRoot = cfg.get<string>('workspace.dir', '.agent-workspace');
    const baseDir =
      cfg.get<string>('workspace.agentfs.baseDir', '') ||
      path.join(workspaceRoot, '_agentfs_base');
    return new BaseMaterializer(src, baseDir, new NestLoggerAdapter('BaseMaterializer'));
  },
  inject: [TypeOrmSkillContentSource, ConfigService],
};
