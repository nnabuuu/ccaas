/**
 * Sessions Module
 *
 * Unified session management module combining WebSocket and REST APIs.
 * Consolidates session lifecycle, message handling, and real-time communication.
 *
 * Previously split into:
 * - ChatModule (WebSocket gateway + SessionService)
 * - SessionsModule (REST controller)
 *
 * Now unified under SessionsModule for clearer architecture.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsGateway } from './sessions.gateway';
import { SessionsController } from './sessions.controller';
import { ConversationsController } from './conversations.controller';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import { CompletionOrchestrationService } from './services/completion-orchestration.service';
import { SkillManagementService } from './services/skill-management.service';
import { AttachmentService } from './services/attachment.service';
import { CliProcessService } from './services/cli-process.service';
import { WorkspaceService } from './services/workspace.service';
import { BackgroundTaskMonitorService } from './services/background-task-monitor.service';
import { ToolCallTrackerService } from './services/tool-call-tracker.service';
import { SubAgentTrackerService } from './services/subagent-tracker.service';
import { ToolAnalysisService } from './services/tool-analysis.service';
import { MessageQueueService } from './services/message-queue.service';
import { MessageWorkerService } from './services/message-worker.service';
import { ConversationMetadataService } from './services/conversation-metadata.service';
import { MessageQueue } from './entities/message-queue.entity';
import { Session } from '../admin/entities/session.entity';
import { Turn } from '../admin/entities/turn.entity';
import { SkillsModule } from '../skills/skills.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MessagesModule } from '../messages/messages.module';
import { FilesModule } from '../files/files.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageQueue, Session, Turn]),
    SkillsModule,
    TenantsModule,
    MessagesModule,
    FilesModule,
    AdminModule,
  ],
  controllers: [SessionsController, ConversationsController],
  providers: [
    SessionsGateway,
    SessionService,
    EventMapperService,
    CompletionOrchestrationService,
    SkillManagementService,
    AttachmentService,
    CliProcessService,
    WorkspaceService,
    BackgroundTaskMonitorService,
    ToolCallTrackerService,
    SubAgentTrackerService,
    ToolAnalysisService,
    MessageQueueService,
    MessageWorkerService,
    ConversationMetadataService,
  ],
  exports: [SessionsGateway, SessionService, EventMapperService, MessageQueueService, ConversationMetadataService],
})
export class SessionsModule {}
