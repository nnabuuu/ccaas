/**
 * Claude Code as a Service - Root Module
 *
 * Assembles all feature modules into the application.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { SessionsModule } from './sessions/sessions.module';
import { SkillsModule } from './skills/skills.module';
import { TenantsModule } from './tenants/tenants.module';
import { MessagesModule } from './messages/messages.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { ProtocolModule } from './protocol/protocol.module';
import { McpModule } from './mcp/mcp.module';
import { AdminModule } from './admin/admin.module';
import { QuotaModule } from './admin/quota.module';
import { HealthModule } from './health/health.module';
import { Skill } from './skills/entities/skill.entity';
import { SkillVersion } from './skills/entities/skill-version.entity';
import { SkillFile } from './skills/entities/skill-file.entity';
import { SkillVersionFile } from './skills/entities/skill-version-file.entity';
import { Tenant } from './tenants/entities/tenant.entity';
import { Message } from './messages/entities/message.entity';
import { ToolEvent } from './messages/entities/tool-event.entity';
import { ConversationContext } from './messages/entities/conversation-context.entity';
import { ProcessLifecycleEvent } from './messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from './messages/entities/api-error-event.entity';
import { ThinkingBlock } from './messages/entities/thinking-block.entity';
import { TokenUsageEvent } from './messages/entities/token-usage-event.entity';
import { UserContextEvent } from './messages/entities/user-context-event.entity';
import { SessionEventRecord } from './messages/entities/session-event.entity';
import { AgentFile } from './files/entities/agent-file.entity';
import { FileVersion } from './files/entities/file-version.entity';
import { ApiKey } from './auth/entities/api-key.entity';
import { McpServer } from './mcp/entities/mcp-server.entity';
import { LargeContent, SystemPromptVersion } from './storage/entities';
import { AdminAuditLog, SessionAlert, TenantQuota, Turn, Session } from './admin/entities';
import { StorageModule } from './storage/storage.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ScheduledTask } from './scheduler/entities/scheduled-task.entity';
import { ScheduledTaskExecution } from './scheduler/entities/scheduled-task-execution.entity';
import { JobModule } from './jobs/job.module';
import { JobEntity } from './jobs/entities/job.entity';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { UserTenant } from './users/entities/user-tenant.entity';
import { MessageQueue } from './sessions/entities/message-queue.entity';
import { SolutionsModule } from './solutions/solutions.module';
import { BundleModule } from './bundles/bundle.module';
import { BuilderModule } from './builder/builder.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate Limiting (Global defaults, overridden per endpoint)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10000,  // high limit for benchmark workloads
      },
    ]),

    // Event Emitter (Week 5: WebSocket events)
    EventEmitterModule.forRoot(),

    // Database (SQLite for simplicity, can switch to PostgreSQL)
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH || '.agent-workspace/data.db',
      entities: [
        // Core entities
        Skill,
        SkillVersion,
        SkillFile,
        SkillVersionFile,
        Tenant,
        ApiKey,
        McpServer,
        AgentFile,
        FileVersion,
        // User entities
        User,
        UserTenant,
        // Message entities
        Message,
        ToolEvent,
        ConversationContext,
        ProcessLifecycleEvent,
        ApiErrorEvent,
        ThinkingBlock,
        TokenUsageEvent,
        UserContextEvent,
        SessionEventRecord,
        // Session entities
        MessageQueue,
        Session,
        // Storage entities
        LargeContent,
        SystemPromptVersion,
        // Admin entities
        AdminAuditLog,
        SessionAlert,
        TenantQuota,
        Turn,
        // Scheduler entities
        ScheduledTask,
        ScheduledTaskExecution,
        // Job entities
        JobEntity,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.DEBUG === 'true',
    }),

    // Core modules
    ProtocolModule,
    AuthModule,
    McpModule,
    StorageModule,

    // Feature modules
    SessionsModule, // Unified session management (WebSocket + REST)
    HealthModule,   // System health monitoring
    SkillsModule,
    TenantsModule,
    MessagesModule,
    FilesModule,
    UsersModule,

    // Quota enforcement (global — used by Sessions + Messages + Admin)
    QuotaModule,

    // Admin module
    AdminModule,

    // Scheduler module
    SchedulerModule,

    // Background jobs module
    JobModule,

    // Solution auto-discovery
    SolutionsModule,

    // Bundle system (platform capability packages)
    BundleModule,

    // Builder module (external developer self-service)
    BuilderModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
