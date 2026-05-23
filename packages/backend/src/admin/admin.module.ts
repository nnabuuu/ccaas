/**
 * Admin Module
 *
 * Provides admin dashboard, session management, analytics, and audit capabilities.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { SessionAlert } from './entities/session-alert.entity';
import { TenantQuota } from './entities/tenant-quota.entity';
import { Session } from './entities/session.entity';
import { Turn } from './entities/turn.entity';

// Guards
import { AdminTenantAccessGuard } from './guards/admin-tenant-access.guard';

// Services
import { AuditService } from './services/audit.service';
import { AnalyticsService } from './services/analytics.service';
import { SessionManagerService } from './services/session-manager.service';

// Controllers
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminSessionsController } from './controllers/admin-sessions.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminSkillsController } from './controllers/admin-skills.controller';
import { AdminTenantsController } from './controllers/admin-tenants.controller';
import { AdminSdkController } from './controllers/admin-sdk.controller';
import { AdminApiKeysController } from './controllers/admin-api-keys.controller';
import { AdminSessionTemplatesController } from './controllers/admin-session-templates.controller';
import { AdminMcpServersController } from './controllers/admin-mcp-servers.controller';
import { AdminBundlesController } from './controllers/admin-bundles.controller';
import { AdminPlaygroundDraftsController } from './controllers/admin-playground-drafts.controller';
import { PlaygroundDraft } from './entities/playground-draft.entity';
import { AdminBuilderUsersController } from './controllers/admin-builder-users.controller';
import { AdminSolutionsController } from './controllers/admin-solutions.controller';
import { AdminUsersController } from './controllers/admin-users.controller';

// Dependent modules
import { SessionsModule } from '../sessions/sessions.module';
import { SkillsModule } from '../skills/skills.module';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { TenantsModule } from '../tenants/tenants.module';
import { BundleModule } from '../bundles/bundle.module';
import { SolutionsModule } from '../solutions/solutions.module';
import { TurnsModule } from './turns.module';

// Entities from other modules (for analytics queries)
import { Message } from '../messages/entities/message.entity';
import { ToolEvent } from '../messages/entities/tool-event.entity';
import { ThinkingBlock } from '../messages/entities/thinking-block.entity';
import { ProcessLifecycleEvent } from '../messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from '../messages/entities/api-error-event.entity';
import { TokenUsageEvent } from '../messages/entities/token-usage-event.entity';
import { ApiKey } from '../auth/entities/api-key.entity';
import { Skill } from '../skills/entities/skill.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Admin entities
      AdminAuditLog,
      SessionAlert,
      TenantQuota,
      Session,
      PlaygroundDraft,
      // Turn removed - now in TurnsModule
      // External entities for queries
      Message,
      ToolEvent,
      ThinkingBlock,
      ProcessLifecycleEvent,
      ApiErrorEvent,
      TokenUsageEvent,
      ApiKey,
      Skill,
      Tenant,
    ]),
    TurnsModule,
    SessionsModule,
    SkillsModule,
    AuthModule,
    MessagesModule,
    TenantsModule,
    BundleModule,
    SolutionsModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminSessionsController,
    AdminAnalyticsController,
    AdminAuditController,
    AdminSkillsController,
    AdminTenantsController,
    AdminSdkController,
    AdminApiKeysController,
    AdminSessionTemplatesController,
    AdminMcpServersController,
    AdminBundlesController,
    AdminPlaygroundDraftsController,
    AdminBuilderUsersController,
    AdminSolutionsController,
    AdminUsersController,
  ],
  providers: [
    AdminTenantAccessGuard,
    AuditService,
    AnalyticsService,
    SessionManagerService,
  ],
  exports: [
    AuditService,
    AnalyticsService,
    SessionManagerService,
    TurnsModule,
  ],
})
export class AdminModule {}
