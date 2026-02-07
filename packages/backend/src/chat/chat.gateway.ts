/**
 * Chat Gateway
 *
 * WebSocket gateway for real-time communication with frontend clients.
 * Handles chat messages, cancellation, and session management.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseFilters, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { TenantsService } from '../tenants/tenants.service';
import { MessagesService } from '../messages/messages.service';
import { ToolEventsService } from '../messages/tool-events.service';
import { ThinkingBlocksService } from '../messages/thinking-blocks.service';
import { TokenUsageService } from '../messages/token-usage.service';
import { ProcessLifecycleService } from '../messages/process-lifecycle.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { UserContextService } from '../messages/user-context.service';
import { FilesService } from '../files/files.service';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';
import { ChatMessageDto, CancelRequestDto, ReconnectRequestDto } from './dto/chat-message.dto';
import {
  createWriteFileTrackerHook,
  createToolEventTrackerHook,
  createThinkingTracker,
  createTokenUsageTracker,
  createProcessLifecycleTracker,
} from '../hooks';
import { SkillChangeNotifier, SkillChangeCallback } from '../common/skill-change-notifier';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UseFilters(WsExceptionFilter)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private clientSockets = new Map<string, Socket>();

  /** Track SDK connection metadata for admin dashboard */
  private sdkConnections = new Map<string, {
    clientId: string;
    socketId: string;
    sdkType: string;
    sdkVersion: string;
    tenantId: string;
    solutionName: string;
    connectedAt: Date;
  }>();

  // Process lifecycle tracker instance (for access across methods)
  private processLifecycleTracker: ReturnType<typeof createProcessLifecycleTracker> | null = null;

  // Skill change callback (stored for cleanup)
  private skillChangeCallback: SkillChangeCallback | null = null;

  constructor(
    private readonly sessionService: SessionService,
    private readonly eventMapperService: EventMapperService,
    private readonly skillSyncService: SkillSyncService,
    private readonly tenantsService: TenantsService,
    private readonly messagesService: MessagesService,
    private readonly toolEventsService: ToolEventsService,
    private readonly thinkingBlocksService: ThinkingBlocksService,
    private readonly tokenUsageService: TokenUsageService,
    private readonly processLifecycleService: ProcessLifecycleService,
    private readonly conversationContextService: ConversationContextService,
    private readonly userContextService: UserContextService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Register hooks on module initialization
   */
  onModuleInit() {
    // Register ToolEventTracker hook (must be first to capture all events)
    const toolEventTrackerHook = createToolEventTrackerHook({
      toolEventsService: this.toolEventsService,
      getSession: (sessionId) => this.sessionService.getSession(sessionId),
    });
    this.eventMapperService.registerToolHook(toolEventTrackerHook);
    this.logger.log('Registered ToolEventTracker hook');

    // Register WriteFileTracker hook
    const writeFileTrackerHook = createWriteFileTrackerHook({
      filesService: this.filesService,
      getSession: (sessionId) => this.sessionService.getSession(sessionId),
    });
    this.eventMapperService.registerToolHook(writeFileTrackerHook);
    this.logger.log('Registered WriteFileTracker hook');

    // Register ThinkingTracker callback
    const thinkingTracker = createThinkingTracker({
      thinkingBlocksService: this.thinkingBlocksService,
      getSession: (sessionId) => this.sessionService.getSession(sessionId),
    });
    this.eventMapperService.registerThinkingCallback(
      (event, sessionId) => thinkingTracker.onThinkingEvent(event, sessionId),
    );
    this.logger.log('Registered ThinkingTracker callback');

    // Register TokenUsageTracker callback
    const tokenUsageTracker = createTokenUsageTracker({
      tokenUsageService: this.tokenUsageService,
      getSession: (sessionId) => this.sessionService.getSession(sessionId),
    });
    this.eventMapperService.registerTokenUsageCallback(
      (usage, sessionId) => tokenUsageTracker.onTokenUsage(usage, sessionId),
    );
    this.logger.log('Registered TokenUsageTracker callback');

    // Create ProcessLifecycleTracker for use in session methods
    this.processLifecycleTracker = createProcessLifecycleTracker({
      processLifecycleService: this.processLifecycleService,
      getSession: (sessionId) => this.sessionService.getSession(sessionId),
    });
    this.logger.log('Created ProcessLifecycleTracker');

    // Register skill change listener
    this.skillChangeCallback = (tenantId, skillId, skillSlug, action) => {
      this.handleSkillChange(tenantId, skillId, skillSlug, action);
    };
    SkillChangeNotifier.addListener(this.skillChangeCallback);
    this.logger.log('Registered skill change listener');
  }

  /**
   * Get active sub-agents for a session
   * Exposes EventMapper's internal state to REST endpoints
   */
  getActiveSubAgents(sessionId: string): Array<{
    subAgentId: string;
    agentType: string;
    description?: string;
    startedAt: string;
    status: 'running' | 'completed' | 'failed';
    nestingLevel?: number;
  }> {
    return this.eventMapperService.getActiveSubAgents(sessionId);
  }

  /**
   * Handle skill change notification
   * Marks affected sessions for restart and notifies connected clients
   */
  private handleSkillChange(
    tenantId: string,
    skillId: string,
    skillSlug: string,
    action: 'created' | 'updated' | 'published' | 'unpublished' | 'archived',
  ): void {
    this.logger.log(`Skill change: ${action} ${skillSlug} for tenant ${tenantId}`);

    // Mark all sessions for this tenant as needing restart
    const affectedSessionIds = this.sessionService.markSessionsForRestart(tenantId);

    if (affectedSessionIds.length === 0) {
      this.logger.debug('No active sessions affected by skill change');
      return;
    }

    // Notify connected clients about the skill change
    for (const [clientId, socket] of this.clientSockets) {
      // Find if this client has any affected sessions
      const clientSessions = this.sessionService.getClientSessions(clientId);
      const hasAffectedSession = clientSessions.some(
        (s) => affectedSessionIds.includes(s.sessionId),
      );

      if (hasAffectedSession) {
        socket.emit('skill_updated', {
          skillId,
          skillSlug,
          action,
          message: `Skill "${skillSlug}" was ${action}. Restart session to use updated skills.`,
          requiresRestart: true,
          affectedSessions: clientSessions
            .filter((s) => affectedSessionIds.includes(s.sessionId))
            .map((s) => s.sessionId),
        });

        this.logger.debug(`Notified client ${clientId} of skill change`);
      }
    }
  }

  /**
   * Handle new client connection
   */
  handleConnection(client: Socket) {
    const clientId = uuidv4();
    client.data.clientId = clientId;
    this.clientSockets.set(clientId, client);

    this.logger.log(`Client connected: ${clientId} (socket: ${client.id})`);

    // Capture SDK metadata from handshake query
    const query = client.handshake?.query || {};
    const sdkType = (query.sdkType as string) || 'unknown';
    const sdkVersion = (query.sdkVersion as string) || 'unknown';
    const tenantId = (query.tenantId as string) || '';
    const solutionName = (query.solutionName as string) || '';

    const connectionInfo = {
      clientId,
      socketId: client.id,
      sdkType,
      sdkVersion,
      tenantId,
      solutionName,
      connectedAt: new Date(),
    };
    this.sdkConnections.set(clientId, connectionInfo);

    // Notify admin namespace
    this.server.emit('admin:sdk_connected', connectionInfo);
    this.logger.log(`SDK connected: ${sdkType}@${sdkVersion} tenant=${tenantId} solution=${solutionName}`);

    // Send client ID to frontend
    client.emit('client_id', { clientId });

    // Send initial idle status
    client.emit('agent_status', { status: 'idle' });
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(client: Socket) {
    const clientId = client.data.clientId;
    this.logger.log(`Client disconnected: ${clientId}`);

    // Remove SDK connection tracking and notify admin
    const connectionInfo = this.sdkConnections.get(clientId);
    if (connectionInfo) {
      this.sdkConnections.delete(clientId);
      this.server.emit('admin:sdk_disconnected', {
        ...connectionInfo,
        disconnectedAt: new Date(),
      });
    }

    this.clientSockets.delete(clientId);
    // Note: We don't immediately close sessions on disconnect
    // to allow for reconnection. Sessions will be cleaned up by TTL.
  }

  /**
   * Handle chat message from client
   */
  @SubscribeMessage('chat')
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatMessageDto,
  ) {
    const clientId = client.data.clientId;
    const sessionId = data.sessionId || `session_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const tenantId = data.tenantId;

    this.logger.log(`Received chat message: ${data.message?.slice(0, 50)}...`);

    // Require tenantId for skill sync to work
    if (!tenantId) {
      this.logger.error('tenantId is required for chat - skills cannot be loaded without a tenant');
      client.emit('agent_status', {
        status: 'error',
        sessionId,
        error: 'tenantId is required. Skills cannot be loaded without a tenant.',
      });
      return;
    }

    try {
      // Resolve tenant slug/id to actual tenant UUID
      // This is needed because skills are stored with tenant UUID, not slug
      let resolvedTenantId = tenantId;
      try {
        const tenant = await this.tenantsService.findOne(tenantId);
        if (tenant) {
          resolvedTenantId = tenant.id;
          this.logger.debug(`Resolved tenant ${tenantId} to UUID ${resolvedTenantId}`);
        } else {
          this.logger.warn(`Tenant not found: ${tenantId}, using as-is`);
        }
      } catch (error) {
        this.logger.warn(`Failed to resolve tenant: ${error}`);
      }

      // Get or create session
      const session = this.sessionService.getOrCreateSession(sessionId, clientId, client);

      // Store tenant context on session (use original for display, resolved for queries)
      session.tenantId = resolvedTenantId;

      // Store MCP servers configuration from solution backend (if provided)
      if (data.mcpServers && Object.keys(data.mcpServers).length > 0) {
        session.mcpServers = data.mcpServers;
        this.logger.log(`Session ${sessionId} configured with MCP servers: ${Object.keys(data.mcpServers).join(', ')}`);
      }

      // Sync tenant skills to session workspace
      try {
        const syncResult = await this.skillSyncService.syncToSession(
          session.workspaceDir,
          resolvedTenantId,
          {
            publishedOnly: true,
            skillSlugs: data.enabledSkillSlugs,
          },
        );
        session.skillSyncedAt = new Date();
        this.logger.log(`Synced ${syncResult.skillCount} skills for tenant ${tenantId} (${resolvedTenantId})`);
      } catch (error) {
        this.logger.warn(`Failed to sync skills: ${error}`);
        // Continue without skills - non-fatal
      }

      // If solution provided a skill file path, copy it to session workspace
      if (data.skillPath && fs.existsSync(data.skillPath)) {
        try {
          const skillName = path.basename(path.dirname(data.skillPath));
          const targetDir = path.join(session.workspaceDir, '.claude', 'skills', skillName);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(data.skillPath, path.join(targetDir, 'SKILL.md'));
          this.logger.log(`Copied skill ${skillName} to session workspace from ${data.skillPath}`);
        } catch (error) {
          this.logger.warn(`Failed to copy skill file: ${error}`);
          // Continue without skill - non-fatal
        }
      }

      // Create message records for persistence
      const userMessage = await this.messagesService.create({
        sessionId,
        tenantId: resolvedTenantId,
        role: 'user',
        content: data.message,
      });

      const assistantMessage = await this.messagesService.create({
        sessionId,
        tenantId: resolvedTenantId,
        role: 'assistant',
        content: '', // Will be accumulated as response streams in
      });

      // Store message IDs on session for file association
      session.currentUserMessageId = userMessage.id;
      session.currentAssistantMessageId = assistantMessage.id;

      this.logger.debug(
        `Created messages: user=${userMessage.id}, assistant=${assistantMessage.id}`,
      );

      // Create or update ConversationContext (on first message)
      if (session.messageCount === 0 && !data.resumeSession) {
        try {
          await this.conversationContextService.createOrUpdate({
            sessionId,
            tenantId: resolvedTenantId,
            workspaceDir: session.workspaceDir,
            clientId,
          });
          this.logger.debug(`Created conversation context for session ${sessionId}`);
        } catch (err) {
          this.logger.warn(`Failed to create conversation context: ${err}`);
        }
      }

      // Notify frontend that agent is starting
      client.emit('agent_status', {
        status: 'running',
        sessionId,
      });

      // Track accumulated text for message update
      let accumulatedText = '';

      // Event handler that also accumulates text
      const handleEvent = (event: { type: string; text?: string; [key: string]: unknown }) => {
        // Accumulate text_delta events
        if (event.type === 'text_delta' && event.text) {
          accumulatedText += event.text;
        }

        // Emit to client
        client.emit(event.type, event);

        // On completion, update the assistant message with accumulated content
        if (event.type === 'agent_status' && (event as any).status === 'complete') {
          this.messagesService
            .updateContent(assistantMessage.id, accumulatedText)
            .catch((err) => this.logger.error(`Failed to update message content: ${err}`));
        }
      };

      // Check if this is a follow-up message
      if (session.messageCount > 0 || data.resumeSession) {
        // Follow-up message - use --resume
        await this.sessionService.sendFollowUp(session, data.message, handleEvent);
      } else {
        // First message - spawn new CLI process
        await this.sessionService.ensureCLIProcess(session, data.message, handleEvent);
      }
    } catch (error) {
      this.logger.error(`Error handling chat: ${error}`);
      client.emit('agent_status', {
        status: 'error',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle cancel request from client
   */
  @SubscribeMessage('cancel')
  handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CancelRequestDto,
  ) {
    const clientId = client.data.clientId;

    // Create event sender
    const sendEvent = (event: any) => {
      client.emit('message', event);
    };

    if (data.sessionId) {
      const session = this.sessionService.getSession(data.sessionId);
      if (session && session.clientId === clientId) {
        const cancelled = this.sessionService.cancelSession(data.sessionId, sendEvent);

        if (cancelled) {
          this.logger.log(`Cancelled session ${data.sessionId}`);
        } else {
          this.logger.warn(`Failed to cancel session ${data.sessionId} - may already be stopped`);
        }
      } else {
        this.logger.warn(`Cannot cancel session ${data.sessionId} - not found or wrong client`);
      }
    } else {
      // Cancel all sessions for this client
      const sessions = this.sessionService.getClientSessions(clientId);
      let cancelledCount = 0;

      for (const session of sessions) {
        const cancelled = this.sessionService.cancelSession(session.sessionId, sendEvent);
        if (cancelled) cancelledCount++;
      }

      this.logger.log(`Cancelled ${cancelledCount}/${sessions.length} sessions for client ${clientId}`);
    }
  }

  /**
   * Handle session reconnection
   */
  @SubscribeMessage('reconnect_session')
  handleReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ReconnectRequestDto,
  ) {
    const clientId = client.data.clientId;
    const session = this.sessionService.reconnectSession(data.sessionId, clientId, client);

    if (session) {
      client.emit('session_restored', {
        sessionId: data.sessionId,
        status: session.status,
        messageCount: session.messageCount,
        createdAt: session.createdAt.toISOString(),
      });
      this.logger.log(`Session ${data.sessionId} restored for client ${clientId}`);
    } else {
      client.emit('session_not_found', { sessionId: data.sessionId });
      this.logger.log(`Session ${data.sessionId} not found for reconnect`);
    }
  }

  /**
   * Handle page state changes from frontend
   */
  @SubscribeMessage('page_state_changed')
  async handlePageStateChanged(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Record<string, unknown>,
  ) {
    this.logger.debug(`Page state changed: ${JSON.stringify(data)}`);

    // Get session ID from data or find active session for this client
    const sessionId = data.sessionId as string | undefined;
    const clientId = client.data.clientId;

    if (sessionId) {
      try {
        await this.userContextService.recordContext({
          sessionId,
          pageUrl: data.url as string | undefined,
          pageTitle: data.title as string | undefined,
          selectedText: data.selectedText as string | undefined,
          customContext: data.context as Record<string, unknown> | undefined,
          viewport: data.viewport as { width: number; height: number } | undefined,
          darkMode: data.darkMode as boolean | undefined,
        });
      } catch (err) {
        this.logger.warn(`Failed to record page state: ${err}`);
      }
    }
  }

  /**
   * Handle get_stats request
   */
  @SubscribeMessage('get_stats')
  handleGetStats(@ConnectedSocket() client: Socket) {
    const stats = this.sessionService.getStats();
    client.emit('stats', stats);
  }

  /**
   * Handle get_sdk_connections request — returns all active SDK connections
   */
  @SubscribeMessage('get_sdk_connections')
  handleGetSdkConnections(@ConnectedSocket() client: Socket) {
    const connections = Array.from(this.sdkConnections.values());
    client.emit('sdk_connections', { connections });
  }

  /**
   * Get all SDK connections (for REST API / admin controller)
   */
  getSdkConnections() {
    return Array.from(this.sdkConnections.values());
  }

  /**
   * Get socket for a client (for REST API integration)
   */
  getClientSocket(clientId: string): Socket | undefined {
    return this.clientSockets.get(clientId);
  }
}
