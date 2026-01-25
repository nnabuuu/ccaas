/**
 * Admin Module
 *
 * Provides admin dashboard, session management, analytics, and audit capabilities.
 */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { SessionAlert } from './entities/session-alert.entity';

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

// Dependent modules
import { ChatModule } from '../chat/chat.module';
import { SkillsModule } from '../skills/skills.module';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { TenantsModule } from '../tenants/tenants.module';

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
    // Use forwardRef to avoid circular dependencies
    forwardRef(() => ChatModule),
    forwardRef(() => SkillsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => MessagesModule),
    forwardRef(() => TenantsModule),
  ],
  controllers: [
    AdminDashboardController,
    AdminSessionsController,
    AdminAnalyticsController,
    AdminAuditController,
    AdminSkillsController,
    AdminTenantsController,
  ],
  providers: [
    AuditService,
    AnalyticsService,
    SessionManagerService,
  ],
  exports: [
    AuditService,
    AnalyticsService,
    SessionManagerService,
  ],
})
export class AdminModule {}
