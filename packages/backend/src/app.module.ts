/**
 * Claude Code as a Service - Root Module
 *
 * Assembles all feature modules into the application.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { ChatModule } from './chat/chat.module';
import { SkillsModule } from './skills/skills.module';
import { TenantsModule } from './tenants/tenants.module';
import { MessagesModule } from './messages/messages.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { ProtocolModule } from './protocol/protocol.module';
import { McpModule } from './mcp/mcp.module';
import { AdminModule } from './admin/admin.module';
import { Skill } from './skills/entities/skill.entity';
import { SkillVersion } from './skills/entities/skill-version.entity';
import { Tenant } from './tenants/entities/tenant.entity';
import { Message } from './messages/entities/message.entity';
import { ToolEvent } from './messages/entities/tool-event.entity';
import { ConversationContext } from './messages/entities/conversation-context.entity';
import { ProcessLifecycleEvent } from './messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from './messages/entities/api-error-event.entity';
import { ThinkingBlock } from './messages/entities/thinking-block.entity';
import { TokenUsageEvent } from './messages/entities/token-usage-event.entity';
import { UserContextEvent } from './messages/entities/user-context-event.entity';
import { AgentFile } from './files/entities/agent-file.entity';
import { ApiKey } from './auth/entities/api-key.entity';
import { McpServer } from './mcp/entities/mcp-server.entity';
import { LargeContent, SystemPromptVersion } from './storage/entities';
import { AdminAuditLog, SessionAlert } from './admin/entities';
import { StorageModule } from './storage/storage.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { LessonPlanEntity } from './lesson-plans/entities/lesson-plan.entity';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database (SQLite for simplicity, can switch to PostgreSQL)
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH || '.agent-workspace/data.db',
      entities: [
        // Core entities
        Skill,
        SkillVersion,
        Tenant,
        ApiKey,
        McpServer,
        AgentFile,
        // Message entities
        Message,
        ToolEvent,
        ConversationContext,
        ProcessLifecycleEvent,
        ApiErrorEvent,
        ThinkingBlock,
        TokenUsageEvent,
        UserContextEvent,
        // Storage entities
        LargeContent,
        SystemPromptVersion,
        // Admin entities
        AdminAuditLog,
        SessionAlert,
        // Lesson Plan entities
        LessonPlanEntity,
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
    ChatModule,
    SkillsModule,
    TenantsModule,
    MessagesModule,
    FilesModule,

    // Admin module
    AdminModule,

    // Lesson Plan module
    LessonPlansModule,

    // Sessions REST API module
    SessionsModule,
  ],
})
export class AppModule {}
