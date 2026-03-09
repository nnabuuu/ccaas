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
import { SkillPermissionGuard } from './guards/skill-permission.guard';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillFile } from './entities/skill-file.entity';
import { SkillVersionFile } from './entities/skill-version-file.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { McpModule } from '../mcp/mcp.module';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Skill, SkillVersion, SkillFile, SkillVersionFile]),
    forwardRef(() => TenantsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SessionsModule), // Week 5: SessionService for affected sessions
    McpModule,
  ],
  controllers: [SkillsController],
  providers: [SkillsService, SkillSyncService, SkillRouterService, SkillPermissionGuard],
  exports: [SkillsService, SkillSyncService, SkillRouterService],
})
export class SkillsModule {}
