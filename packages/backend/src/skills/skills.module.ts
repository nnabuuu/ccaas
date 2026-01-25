/**
 * Skills Module
 *
 * Handles skill management with CRUD API, sync service, and routing.
 */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { SkillSyncService } from './skill-sync.service';
import { SkillRouterService } from './skill-router.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Skill, SkillVersion]),
    forwardRef(() => TenantsModule),
    McpModule,
  ],
  controllers: [SkillsController],
  providers: [SkillsService, SkillSyncService, SkillRouterService],
  exports: [SkillsService, SkillSyncService, SkillRouterService],
})
export class SkillsModule {}
