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
import { ConversationsAliasController } from './conversations-alias.controller';
import { QueueController } from './queue.controller';
import { SessionFsController } from './session-fs.controller';
import { SessionMetadataController } from './session-metadata.controller';
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
import { StreamRegistryService } from './services/stream-registry.service';
import { SessionAssetMaterializer } from './services/session-asset-materializer.service';
import { SessionFsService } from './services/session-fs.service';
import { SessionMetadataService } from './services/session-metadata.service';
import { SessionMetadata } from './entities/session-metadata.entity';
import { LocalWorkspaceProvider } from './workspace/local-provider';
import { AgentfsWorkspaceProvider } from './workspace/agentfs-provider';
import { TypeOrmSkillContentSource } from './workspace/typeorm-skill-content-source';
import { baseMaterializerProvider } from './workspace/base-materializer.factory';
import { WorkspaceProviderFactory } from './workspace/workspace-provider.factory';
import { WORKSPACE_PROVIDER } from './workspace/types';
import { SandboxService } from './sandbox/sandbox.service';
import { SessionAssetSyncer } from './agent-runtime/session-asset-syncer.service';
import { MessageQueue } from './entities/message-queue.entity';
import { Session } from '../admin/entities/session.entity';
import { Skill } from '../skills/entities/skill.entity';
import { SkillFile } from '../skills/entities/skill-file.entity';
import { McpServer } from '../mcp/entities/mcp-server.entity';
import { Turn } from '../admin/entities/turn.entity';
import { SkillsModule } from '../skills/skills.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MessagesModule } from '../messages/messages.module';
import { FilesModule } from '../files/files.module';
import { TurnsModule } from '../admin/turns.module';
import { BundleModule } from '../bundles/bundle.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageQueue, Session, Skill, SkillFile, McpServer, SessionMetadata]),
    TurnsModule,
    SkillsModule,
    TenantsModule,
    MessagesModule,
    FilesModule,
    BundleModule,
  ],
  controllers: [SessionsController, ConversationsAliasController, QueueController, SessionFsController, SessionMetadataController],
  providers: [
    SessionsController,
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
    StreamRegistryService,
    SessionAssetMaterializer,
    SessionFsService,
    SessionMetadataService,
    LocalWorkspaceProvider,
    AgentfsWorkspaceProvider,
    TypeOrmSkillContentSource,
    baseMaterializerProvider,
    WorkspaceProviderFactory,
    SandboxService,
    SessionAssetSyncer,
  ],
  exports: [SessionsGateway, SessionService, EventMapperService, MessageQueueService, ConversationMetadataService, StreamRegistryService, WORKSPACE_PROVIDER, SessionAssetSyncer],
})
export class SessionsModule {}
