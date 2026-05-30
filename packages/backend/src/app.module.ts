/**
 * Claude Code as a Service — Root Module (phase 5.5 dynamic factory).
 *
 * `AppModule` is a `DynamicModule` factory rather than a static
 * `@Module({})`. Call `AppModule.register({ extraModules })` to
 * compose the platform with solution-specific handler bundles loaded
 * dynamically at boot. This is how `main.ts` wires
 * `PLATFORM_HANDLER_PACKAGES` env-driven handler packages
 * (e.g. `@kedge-agentic/live-lesson-platform-handlers`) into the
 * NestJS module tree WITHOUT `@kedge-agentic/backend` itself naming
 * any solution at compile time.
 *
 * Generic infrastructure stays inside this module's static `imports`.
 * Solution-specific behavior (LessonSession ontology registrar,
 * live-lesson workflow handlers, dashboard endpoints) is injected by
 * the deploy entrypoint via `extraModules`. With `extraModules` empty,
 * the backend boots as a truly generic platform — engine + ingest
 * endpoints idle, no triggers register.
 */

import { DynamicModule, Module, Type } from '@nestjs/common';
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

export interface AppModuleRegisterOptions {
  /**
   * Solution-specific handler bundles to register in the NestJS
   * module tree. Each entry is either a NestJS `Module` class
   * (static `@Module({})`) or a `DynamicModule` (returned by a
   * `register()` factory). `main.ts` populates this list by
   * dynamically `await import()`ing the packages named in
   * `PLATFORM_HANDLER_PACKAGES`.
   */
  readonly extraModules?: Array<Type<unknown> | DynamicModule>;
}

@Module({})
export class AppModule {
  static register(opts: AppModuleRegisterOptions = {}): DynamicModule {
    const extraModules = opts.extraModules ?? [];
    return {
      module: AppModule,
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
            limit: 10000, // high limit for benchmark workloads
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

        // Feature modules
        SessionsModule,
        HealthModule,
        SkillsModule,
        SolutionsModule,
        MessagesModule,
        FilesModule,
        UsersModule,

        // Quota enforcement
        QuotaModule,

        // Admin
        AdminModule,

        // Scheduler
        SchedulerModule,

        // Background jobs
        JobModule,

        // Solution auto-discovery (tenant rows + MCP + skills + bundles)
        SolutionLoaderModule,

        // Bundle system (platform capability packages)
        BundleModule,

        // Builder module (external developer self-service)
        BuilderModule,

        // Ontology layer (Phase 3): generic manifest accessor + action
        // bridge. Knows nothing about live-lesson; solution-specific
        // ontology registrars come in via `extraModules`.
        OntologyModule,

        // Workflow layer (Phase 5): generic declarative triggers +
        // cross-process event ingest. Knows nothing about live-lesson;
        // solution-specific handlers come in via `extraModules`.
        WorkflowModule,

        // Solution-specific handler bundles injected at boot by main.ts
        // based on the PLATFORM_HANDLER_PACKAGES env var.
        ...extraModules,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    };
  }
}
