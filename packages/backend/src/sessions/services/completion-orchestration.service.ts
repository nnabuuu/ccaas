/**
 * Completion Orchestration Service
 *
 * Central orchestrator for message processing pipeline.
 * Eliminates duplication between WebSocket (SessionsGateway) and REST (SessionsController).
 *
 * Responsibilities:
 * - Orchestrate the 10-step message processing pipeline
 * - Transport-agnostic (supports both WebSocket and REST)
 * - Single source of truth for completion logic
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SessionService, ResolvedAttachment } from '../session.service';
import { EventMapperService } from '../event-mapper.service';
import { SkillSyncService } from '../../skills/skill-sync.service';
import { TenantsService } from '../../tenants/tenants.service';
import { MessagesService } from '../../messages/messages.service';
import { ConversationContextService } from '../../messages/conversation-context.service';
import { UserContextService } from '../../messages/user-context.service';
import { SkillsService } from '../../skills/skills.service';
import { ConversationMetadataService } from './conversation-metadata.service';
import { SkillManagementService } from './skill-management.service';
import { TurnsService } from '../../admin/services/turns.service';
import { McpPoolService } from '../../mcp/mcp-pool.service';
import { SessionEventsService } from '../../messages/session-events.service';
import type { FrontendEvent, ManagedSession } from '../../common/interfaces';

/**
 * MCP Server configuration from solution backend
 */
export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Input parameters for message processing orchestration
 */
export interface MessageProcessingInput {
  /** Pre-created or retrieved session */
  session: ManagedSession;

  /** Client identifier */
  clientId: string;

  /** Tenant identifier (slug or UUID) */
  tenantId: string;

  /** User message content */
  message: string;

  /** Page context from frontend */
  context?: Record<string, unknown>;

  /** Enabled skill slugs to sync */
  enabledSkillSlugs?: string[];

  /** File attachments (REST only) */
  attachments?: ResolvedAttachment[];

  /** System prompt for CLI --append-system-prompt (REST only) */
  systemPrompt?: string;

  /**
   * Per-template session TTL override (ms), already capped at plan max by the admin controller.
   * When set, the effective session TTL = min(tenant.sessionTtlMs, sessionTtlMs).
   */
  sessionTtlMs?: number;

  /**
   * Named session template to apply (looked up from tenant config).
   * Template fields fill in params not explicitly provided by the caller.
   */
  templateName?: string;

  /** Transport-agnostic event emitter */
  emitEvent: (event: FrontendEvent) => void;
}

/**
 * Output result from message processing orchestration
 */
export interface MessageProcessingOutput {
  /** Session identifier */
  sessionId: string;

  /** Created user message ID */
  userMessageId: string;

  /** Created assistant message ID */
  assistantMessageId: string;

  /** Number of skills synced */
  skillSyncedCount: number;
}

@Injectable()
export class CompletionOrchestrationService {
  private readonly logger = new Logger(CompletionOrchestrationService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly skillSyncService: SkillSyncService,
    private readonly tenantsService: TenantsService,
    private readonly messagesService: MessagesService,
    private readonly conversationContextService: ConversationContextService,
    private readonly userContextService: UserContextService,
    private readonly skillsService: SkillsService,
    private readonly conversationMetadataService: ConversationMetadataService,
    private readonly skillManagementService: SkillManagementService,
    private readonly turnsService: TurnsService,
    private readonly mcpPoolService: McpPoolService,
    private readonly sessionEventsService: SessionEventsService,
  ) {}

  /**
   * Orchestrate the complete message processing pipeline
   *
   * 10-step pipeline:
   * 1. Resolve tenant slug/id to UUID
   * 2. Configure MCP servers
   * 3. Sync tenant skills to workspace
   * 4. Copy skill file if provided
   * 5. Create user and assistant messages
   * 6. Write page context to workspace
   * 7. Create conversation context (first message)
   * 8. Setup event handlers
   * 9. Execute CLI process (new or resume)
   */
  async orchestrateMessage(
    input: MessageProcessingInput,
  ): Promise<MessageProcessingOutput> {
    const {
      session,
      clientId,
      tenantId,
      message,
      context,
      attachments,
      sessionTtlMs: templateTtlMs,
      templateName,
      emitEvent,
    } = input;

    // These are populated from template resolution below
    let mcpServers: Record<string, McpServerConfig> | undefined;
    let skillPath: string | undefined;
    let { enabledSkillSlugs, systemPrompt } = input;

    const sessionId = session.sessionId;

    this.logger.log(`Orchestrating message for session ${sessionId}`);

    // Step 1: Resolve tenant slug/id to actual tenant UUID
    let resolvedTenantId = tenantId;
    let resolvedTenant: Awaited<ReturnType<typeof this.tenantsService.findOne>> = null;
    try {
      resolvedTenant = await this.tenantsService.findOne(tenantId);
      if (resolvedTenant) {
        resolvedTenantId = resolvedTenant.id;
        this.logger.debug(`Resolved tenant ${tenantId} to UUID ${resolvedTenantId}`);
      } else {
        this.logger.warn(`Tenant not found: ${tenantId}, using as-is`);
      }
    } catch (error) {
      this.logger.warn(`Failed to resolve tenant: ${error}`);
    }

    // Store tenant context on session (use original for display, resolved for queries)
    session.tenantId = resolvedTenantId;
    if (resolvedTenant) {
      session.sessionTtlMs = resolvedTenant.sessionTtlMs;
    }

    // Apply per-template TTL override (already capped at plan max by admin controller)
    if (templateTtlMs !== undefined) {
      session.sessionTtlMs = Math.min(session.sessionTtlMs ?? 300000, templateTtlMs);
      this.logger.debug(`Session ${sessionId} TTL overridden by template: ${session.sessionTtlMs}ms`);
    }

    // Resolve named template — fills in params not explicitly provided by the caller
    const effectiveTemplateName =
      templateName ?? resolvedTenant?.config?.defaultSessionTemplate;

    let skillPromptMode: 'protocol' | 'inline' | undefined;
    let templateAppendPrompt: string | undefined;

    if (effectiveTemplateName) {
      const availableTemplates = Object.keys(resolvedTenant?.config?.sessionTemplates ?? {});
      this.logger.debug(
        `Template lookup: tenant=${resolvedTenantId}, template=${effectiveTemplateName}, ` +
        `available=[${availableTemplates.join(',')}], tenantFound=${!!resolvedTenant}, ` +
        `hasConfig=${!!resolvedTenant?.config}`,
      );

      // Tenant config is a JSON column — use explicit any cast for template fields
      const tmpl = resolvedTenant?.config?.sessionTemplates?.[effectiveTemplateName] as Record<string, any> | undefined;
      if (tmpl) {
        this.logger.log(`Applying template "${effectiveTemplateName}" for session ${sessionId}`);
        mcpServers = tmpl['mcpServers'] as Record<string, McpServerConfig> | undefined;
        if (!enabledSkillSlugs && tmpl['enabledSkillSlugs']) enabledSkillSlugs = tmpl['enabledSkillSlugs'];
        if (!systemPrompt && tmpl['appendSystemPrompt'])     systemPrompt = tmpl['appendSystemPrompt'];
        skillPath = tmpl['skillPath'] as string | undefined;
        skillPromptMode = tmpl['skillPromptMode'] as typeof skillPromptMode;
        templateAppendPrompt = tmpl['appendSystemPrompt'] as string | undefined;
        if (tmpl['sessionTtlMs']) {
          session.sessionTtlMs = Math.min(session.sessionTtlMs ?? 300000, tmpl['sessionTtlMs'] as number);
        }
        this.logger.debug(
          `Template "${effectiveTemplateName}" resolved: enabledSkillSlugs=${JSON.stringify(enabledSkillSlugs)}, ` +
          `skillPromptMode=${skillPromptMode}, skillPath=${skillPath}, ` +
          `hasSystemPrompt=${!!systemPrompt}, hasMcpServers=${!!mcpServers}`,
        );
      } else {
        this.logger.warn(`Template "${effectiveTemplateName}" not found for tenant ${resolvedTenantId}`);
        // Fallback: load all tenant skills to prevent silent no-skill degradation
        if (!enabledSkillSlugs) {
          const allSkills = await this.skillsService.findPublished(resolvedTenantId);
          enabledSkillSlugs = allSkills.filter(s => s.enabled).map(s => s.slug);
          this.logger.warn(`Template fallback: loaded ${enabledSkillSlugs.length} tenant skills`);
        }
      }
    }

    // Persist template name on session for later filtering.
    // For new sessions (messageCount === 0), persistSessionToDatabase will include it.
    // For resumed sessions, we need an explicit DB update.
    if (effectiveTemplateName) {
      session.templateName = effectiveTemplateName;
      if (session.messageCount > 0) {
        this.sessionService.persistTemplateName(session.sessionId, effectiveTemplateName).catch(
          (err) => this.logger.warn(`Failed to persist templateName: ${err.message}`),
        );
      }
    }

    // Step 3: Store MCP servers configuration from solution backend (if provided)
    if (mcpServers && Object.keys(mcpServers).length > 0) {
      session.mcpServers = mcpServers;
      this.logger.log(`Session ${sessionId} configured with MCP servers: ${Object.keys(mcpServers).join(', ')}`);

      // Create symlinks to tenant MCP servers
      try {
        await this.sessionService.createMcpSymlinks(session);
      } catch (error: any) {
        this.logger.warn(`Failed to create MCP symlinks: ${error.message}`);
        // Continue - non-fatal
      }
    }

    // Step 4: Sync tenant skills to session workspace
    let skillSyncedCount = 0;
    try {
      const syncResult = await this.skillSyncService.syncToSession(
        session.workspaceDir,
        resolvedTenantId,
        {
          publishedOnly: true,
          skillSlugs: enabledSkillSlugs,
        },
      );
      session.skillSyncedAt = new Date();
      skillSyncedCount = syncResult.skillCount;

      // Track which skills are synced to this session for precise restart
      if (syncResult.skillIds && syncResult.skillIds.length > 0) {
        this.sessionService.trackSyncedSkills(sessionId, syncResult.skillIds);
        this.logger.debug(`Tracked ${syncResult.skillIds.length} synced skills for session ${sessionId}`);
      }

      this.logger.log(`Synced ${syncResult.skillCount} skills for tenant ${tenantId} (${resolvedTenantId})`);
    } catch (error) {
      this.logger.warn(`Failed to sync skills: ${error}`);
      // Continue without skills - non-fatal
    }

    // Step 4b: If skillPromptMode is "inline", read SKILL.md files and replace
    // the protocol-style systemPrompt with inlined skill content. This eliminates
    // agent runtime file reads (Read/Glob/ToolSearch) visible to end users.
    if (skillPromptMode === 'inline' && skillSyncedCount > 0) {
      try {
        const skills = await this.skillManagementService.loadEnabledSkills(
          resolvedTenantId,
          enabledSkillSlugs,
        );
        const inlinePrompt = await this.skillManagementService.generateInlineSkillPrompt(
          session.workspaceDir,
          skills,
        );
        if (inlinePrompt) {
          // Rebuild systemPrompt: inlined skills + template appendSystemPrompt
          systemPrompt = templateAppendPrompt?.trim()
            ? `${inlinePrompt}\n\n${templateAppendPrompt}`
            : inlinePrompt;

          this.logger.log(`Using inline skill prompt for session ${sessionId} (${skills.length} skills)`);
        } else {
          this.logger.warn(`Inline skill prompt requested but no SKILL.md content found for session ${sessionId}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to generate inline skill prompt: ${error}`);
        // Fall back to protocol-style systemPrompt already set
      }
    }

    // Step 4c: Build MCP tool registry from DB for system prompt injection
    if (session.mcpServers && Object.keys(session.mcpServers).length > 0) {
      try {
        const registryEntries: Array<{ toolName: string; mcpPrefixedName: string }> = [];
        const serverSlugs = Object.keys(session.mcpServers);

        // Parallel DB lookups to avoid N+1
        const mcpServers = await Promise.all(
          serverSlugs.map(slug => this.mcpPoolService.findOne(resolvedTenantId, slug)),
        );

        for (let i = 0; i < serverSlugs.length; i++) {
          const mcpServer = mcpServers[i];
          if (!mcpServer) continue;

          const serverSlug = serverSlugs[i];

          // Prefer explicit tools list, fall back to toolEventTriggers
          const toolNames = mcpServer.config.tools
            ?? mcpServer.config.toolEventTriggers?.map(t => t.toolName)
            ?? [];

          for (const toolName of [...new Set(toolNames)]) {
            registryEntries.push({
              toolName,
              mcpPrefixedName: `mcp__${serverSlug}__${toolName}`,
            });
          }
        }

        if (registryEntries.length > 0) {
          const registryPrompt = this.skillManagementService.generateToolRegistryPrompt(registryEntries);
          systemPrompt = systemPrompt
            ? `${systemPrompt}\n\n${registryPrompt}`
            : registryPrompt;
          this.logger.log(`Injected tool registry (${registryEntries.length} tools) for session ${sessionId}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to build tool registry: ${error}`);
        // Continue without registry - non-fatal
      }
    }

    // Step 5: If solution provided a skill file path, copy it to session workspace
    if (skillPath && fs.existsSync(skillPath)) {
      try {
        const skillName = path.basename(path.dirname(skillPath));
        const targetDir = path.join(session.workspaceDir, '.claude', 'skills', skillName);
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(skillPath, path.join(targetDir, 'SKILL.md'));
        this.logger.log(`Copied skill ${skillName} to session workspace from ${skillPath}`);
      } catch (error) {
        this.logger.warn(`Failed to copy skill file: ${error}`);
        // Continue without skill - non-fatal
      }
    }

    // Step 6: Create message records for persistence
    const userMessage = await this.messagesService.create({
      sessionId,
      tenantId: resolvedTenantId,
      role: 'user',
      content: message,
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

    // Step 6a: Create Turn record for analytics (atomic turn number assignment)
    try {
      const turn = await this.turnsService.createNextTurn({
        sessionId,
        userMessageId: userMessage.id,
      });

      // Store turn ID on session for later completion
      session.currentTurnId = turn.id;

      this.logger.debug(
        `Created turn ${turn.turnNumber} for session ${sessionId}: ${turn.id}`,
      );
    } catch (err) {
      this.logger.warn(`Failed to create turn: ${err}`);
      // Continue without turn tracking - non-fatal
    }

    // Step 6b: Auto-generate conversation title from first user message
    if (session.messageCount === 0) {
      this.conversationMetadataService.autoGenerateTitle(sessionId, message).catch((err) => {
        this.logger.warn(`Failed to auto-generate title: ${err}`);
      });
    }

    // Step 7: Store page context if provided (Write to workspace for MCP tool to read)
    if (context) {
      try {
        const contextDir = path.join(session.workspaceDir, '.context');
        const contextPath = path.join(contextDir, 'page-context.json');

        // Ensure directory exists
        if (!fs.existsSync(contextDir)) {
          fs.mkdirSync(contextDir, { recursive: true });
        }

        // Write context to file (with timestamp)
        const contextData = {
          ...context,
          timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(contextPath, JSON.stringify(contextData, null, 2));

        this.logger.debug(`Wrote page context for session ${sessionId}: ${JSON.stringify(context).slice(0, 100)}...`);

        // Also persist to database (optional, for analytics)
        await this.userContextService.recordContext({
          sessionId,
          customContext: context,
        });
      } catch (err) {
        this.logger.warn(`Failed to write page context: ${err}`);
      }
    }

    // Step 8: Create or update ConversationContext (on first message)
    if (session.messageCount === 0) {
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

    // Step 9: Setup event handlers
    // Event persistence configuration (from tenant config)
    const DEFAULT_EXCLUDE_TYPES = new Set(['text_delta']);
    const eventConfig = resolvedTenant?.config?.features?.eventPersistence;
    const persistEnabled = eventConfig?.enabled !== false; // default: true
    const excludeTypes = eventConfig?.excludeTypes
      ? new Set(eventConfig.excludeTypes)
      : DEFAULT_EXCLUDE_TYPES;

    // Track accumulated text for message update
    let accumulatedText = '';

    // Completion promise: resolves when agent signals complete/error/cancelled,
    // or after a 10-minute safety timeout to prevent leaked connections.
    const COMPLETION_TIMEOUT_MS = 10 * 60 * 1000;

    let completionResolved = false;
    let resolveCompletion!: () => void;

    const basePromise = new Promise<void>((resolve) => {
      resolveCompletion = () => {
        if (!completionResolved) {
          completionResolved = true;
          resolve();
        }
      };
    });

    const timeoutPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.logger.warn(
          `Completion timeout (${COMPLETION_TIMEOUT_MS}ms) for session ${sessionId}`,
        );
        resolveCompletion();
        resolve();
      }, COMPLETION_TIMEOUT_MS);

      // Don't prevent process exit if this is the only remaining timer
      // (important for graceful shutdown and Jest test teardown)
      timer.unref();
    });

    const completionPromise = Promise.race([basePromise, timeoutPromise]);

    const handleEvent = (event: FrontendEvent) => {
      // Accumulate text_delta events
      if (event.type === 'text_delta' && (event as any).delta) {
        accumulatedText += (event as any).delta;
      }

      // Persist event (fire-and-forget)
      if (persistEnabled && !excludeTypes.has(event.type)) {
        this.sessionEventsService
          .recordEvent(sessionId, resolvedTenantId, event as any)
          .catch((err) => this.logger.warn(`Event persist failed: ${err.message}`));
      }

      // Emit to client (transport-agnostic)
      emitEvent(event);

      // On completion, update the assistant message with accumulated content
      if (event.type === 'agent_status' && (event as any).status === 'complete') {
        this.messagesService
          .updateContent(assistantMessage.id, accumulatedText)
          .catch((err) => this.logger.error(`Failed to update message content: ${err}`));

        // Complete Turn record with token usage and duration (with retry for timing)
        if (session.currentTurnId) {
          this.turnsService
            .completeTurnWithRetry({
              turnId: session.currentTurnId,
              assistantMessageId: assistantMessage.id,
              maxRetries: 2,
            })
            .then((turn) => {
              this.logger.debug(
                `Completed turn ${turn.turnNumber}: ${turn.totalTokens} tokens, ${turn.durationMs}ms`,
              );
            })
            .catch((err) => this.logger.error(`Failed to complete turn: ${err}`));

          // Clean up turn context
          session.currentTurnId = undefined;
        }
      }

      // Resolve completion promise when agent signals a terminal status
      if (event.type === 'agent_status') {
        const status = (event as any).status;
        if (status === 'complete' || status === 'error' || status === 'cancelled') {
          resolveCompletion();
        }
      }
    };

    // Step 10: Fire-and-forget CLI process (new or resume), then wait for completion signal
    if (session.messageCount > 0) {
      // Follow-up message - use --resume
      void this.sessionService
        .sendFollowUp(session, message, handleEvent, attachments)
        .catch((err) => {
          this.logger.error(`Failed to start follow-up for session ${sessionId}: ${err}`);
          resolveCompletion();
        });
    } else {
      // First message - spawn new CLI process
      void this.sessionService
        .ensureCLIProcess(session, message, handleEvent, attachments, systemPrompt)
        .catch((err) => {
          this.logger.error(`Failed to spawn CLI for session ${sessionId}: ${err}`);
          resolveCompletion();
        });
    }

    // Wait until agent emits agent_status: complete|error|cancelled
    await completionPromise;

    return {
      sessionId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      skillSyncedCount,
    };
  }

}
