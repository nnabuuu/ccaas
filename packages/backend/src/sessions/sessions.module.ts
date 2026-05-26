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
import { WorkspaceChangesController } from './agent-runtime/workspace-changes.controller';
import { AgentRuntimeModule } from './agent-runtime/agent-runtime.module';
import { ProjectArtifactSourceRegistry } from './agent-runtime/project-artifact-source-registry';
import { ProjectBinaryArtifactSourceRegistry } from './agent-runtime/project-binary-artifact-source-registry';
import { SessionMetadataWorkspaceResolver } from './agent-runtime/session-metadata-workspace-resolver';
import { WorkspaceAccessGuard } from './agent-runtime/workspace-access.guard';
import {
  PROJECT_ARTIFACT_SOURCE_REGISTRY,
  PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY,
  PROJECT_TENANT_RESOLVER,
} from './agent-runtime/tokens';
import { MessageQueue } from './entities/message-queue.entity';
import { Session } from '../admin/entities/session.entity';
import { Skill } from '../skills/entities/skill.entity';
import { SkillFile } from '../skills/entities/skill-file.entity';
import { McpServer } from '../mcp/entities/mcp-server.entity';
import { Turn } from '../admin/entities/turn.entity';
import { SkillsModule } from '../skills/skills.module';
import { SolutionsModule } from '../solutions/solutions.module';
import { MessagesModule } from '../messages/messages.module';
import { FilesModule } from '../files/files.module';
import { TurnsModule } from '../admin/turns.module';
import { BundleModule } from '../bundles/bundle.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageQueue, Session, Skill, SkillFile, McpServer, SessionMetadata]),
    TurnsModule,
    SkillsModule,
    SolutionsModule,
    MessagesModule,
    FilesModule,
    BundleModule,
    // Agent-runtime sync layer: source URL lives on `tenant.config.artifactUrl`
    // (set via solution.json auto-discovery or `PUT /solutions/:id`).
    // `ProjectArtifactSourceRegistry` (provided below) reads it lazily +
    // invalidates on `tenant.config.changed` events.
    AgentRuntimeModule.forRoot(),
  ],
  controllers: [SessionsController, ConversationsAliasController, QueueController, SessionFsController, SessionMetadataController, WorkspaceChangesController],
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
    // Agent-runtime registry lives here (not in AgentRuntimeModule) because
    // it depends on SolutionsService — which is reachable from SessionsModule
    // via the SolutionsModule import above, but pulling SolutionsModule into
    // AgentRuntimeModule creates DI grief (SolutionAuthGuard → UserSolutionService).
    ProjectArtifactSourceRegistry,
    {
      provide: PROJECT_ARTIFACT_SOURCE_REGISTRY,
      useExisting: ProjectArtifactSourceRegistry,
    },
    // Phase 2b-4: binary artifact registry. Same pattern as the text
    // one — solutions opt in via `tenant.config.binaryArtifactUrl`;
    // tenants without it skip the binary half of sync entirely.
    ProjectBinaryArtifactSourceRegistry,
    {
      provide: PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY,
      useExisting: ProjectBinaryArtifactSourceRegistry,
    },
    // Phase 2b-2: WorkspaceChangesController auth uses this resolver to map
    // workspace identity → solutionId. Overrides the AgentRuntimeModule's
    // DenyAll default. Lives here (not in AgentRuntimeModule) because it
    // depends on the SessionMetadata repo registered above — wiring it
    // in AgentRuntimeModule would mean re-importing TypeOrmModule for
    // the same entity twice and leaks the SessionsModule-owned table.
    SessionMetadataWorkspaceResolver,
    {
      provide: PROJECT_TENANT_RESOLVER,
      useExisting: SessionMetadataWorkspaceResolver,
    },
    // Guard for /workspaces/:id/* (and /projects/:id/* alias) endpoints
    // (SSE + invalidate). Must be a Guard rather than in-handler auth
    // because @Sse commits the HTTP response before the handler's
    // Observable subscribes — see workspace-access.guard.ts header for
    // details.
    WorkspaceAccessGuard,
  ],
  exports: [SessionsGateway, SessionService, EventMapperService, MessageQueueService, ConversationMetadataService, StreamRegistryService, WORKSPACE_PROVIDER, SessionAssetSyncer, PROJECT_ARTIFACT_SOURCE_REGISTRY],
})
export class SessionsModule {}
