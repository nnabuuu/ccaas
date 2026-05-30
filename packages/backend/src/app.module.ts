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
import { SolutionsModule } from './solutions/solutions.module';
import { MessagesModule } from './messages/messages.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { ProtocolModule } from './protocol/protocol.module';
import { McpModule } from './mcp/mcp.module';
import { ToolCallerModule } from './tool-caller/tool-caller.module';
import { AdminModule } from './admin/admin.module';
import { QuotaModule } from './admin/quota.module';
import { HealthModule } from './health/health.module';
import { Skill } from './skills/entities/skill.entity';
import { SkillVersion } from './skills/entities/skill-version.entity';
import { SkillFile } from './skills/entities/skill-file.entity';
import { SkillVersionFile } from './skills/entities/skill-version-file.entity';
import { Solution } from './solutions/entities/solution.entity';
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
import { AdminAuditLog, SessionAlert, SolutionQuota, Turn, Session } from './admin/entities';
import { StorageModule } from './storage/storage.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ScheduledTask } from './scheduler/entities/scheduled-task.entity';
import { ScheduledTaskExecution } from './scheduler/entities/scheduled-task-execution.entity';
import { JobModule } from './jobs/job.module';
import { JobEntity } from './jobs/entities/job.entity';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { UserSolution } from './users/entities/user-solution.entity';
import { MessageQueue } from './sessions/entities/message-queue.entity';
import { SessionMetadata } from './sessions/entities/session-metadata.entity';
import { SessionArtifactSnapshot } from './sessions/agent-runtime/session-artifact-snapshot.entity';
import { SolutionLoaderModule } from './solutions/solution-loader.module';
import { BundleModule } from './bundles/bundle.module';
import { BuilderModule } from './builder/builder.module';
import { OntologyModule } from './ontology/ontology.module';
import { WorkflowModule } from './workflow/workflow.module';
import {
  ObservationRecord,
  ObserverEventRecord,
} from './workflow/entities';

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
        Solution,
        ApiKey,
        McpServer,
        AgentFile,
        FileVersion,
        // User entities
        User,
        UserSolution,
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
        SessionArtifactSnapshot,
        SessionMetadata,
        // Workflow / observation persistence (phase 5)
        ObservationRecord,
        ObserverEventRecord,
        // Storage entities
        LargeContent,
        SystemPromptVersion,
        // Admin entities
        AdminAuditLog,
        SessionAlert,
        SolutionQuota,
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
    ToolCallerModule,
    StorageModule,

    // Note: AgentRuntimeModule.forRoot() is imported by SessionsModule
    // (transitively reaches AppModule via SessionsModule below). The
    // artifact callback URL lives on `tenant.config.artifactUrl`, set via
    // solution.json auto-discovery or `PUT /solutions/:id` — no env vars.

    // Feature modules
    SessionsModule, // Unified session management (WebSocket + REST)
    HealthModule,   // System health monitoring
    SkillsModule,
    SolutionsModule,
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
    SolutionLoaderModule,

    // Bundle system (platform capability packages)
    BundleModule,

    // Builder module (external developer self-service)
    BuilderModule,

    // Ontology layer (Phase 3): manifest accessor + ActionDef bridge.
    // Dead-code at boot until Solutions register manifests + actions.
    OntologyModule,

    // Workflow layer (Phase 5): declarative triggers + cross-process
    // event ingest. Dead-code until solutions register TriggerDefs and
    // start pushing events through the ingest endpoint.
    WorkflowModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
