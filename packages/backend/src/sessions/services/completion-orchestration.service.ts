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
import { SolutionsService } from '../../solutions/solutions.service';
import { MessagesService } from '../../messages/messages.service';
import { ConversationContextService } from '../../messages/conversation-context.service';
import { UserContextService } from '../../messages/user-context.service';
import { SkillsService } from '../../skills/skills.service';
import { ConversationMetadataService } from './conversation-metadata.service';
import { SkillManagementService } from './skill-management.service';
import { TurnsService } from '../../admin/services/turns.service';
import { McpPoolService } from '../../mcp/mcp-pool.service';
import { SessionEventsService } from '../../messages/session-events.service';
import type { SessionEvent, ManagedSession } from '../../common/interfaces';
import { BundleService } from '../../bundles/bundle.service';

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

  /** Solution identifier (slug or UUID) */
  solutionId: string;

  /** User message content */
  message: string;

  /** Page context from frontend */
  context?: Record<string, unknown>;

  /** Enabled skill slugs to sync */
  enabledSkills?: string[];

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
  emitEvent: (event: SessionEvent) => void;
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
    private readonly tenantsService: SolutionsService,
    private readonly messagesService: MessagesService,
    private readonly conversationContextService: ConversationContextService,
    private readonly userContextService: UserContextService,
    private readonly skillsService: SkillsService,
    private readonly conversationMetadataService: ConversationMetadataService,
    private readonly skillManagementService: SkillManagementService,
    private readonly turnsService: TurnsService,
    private readonly mcpPoolService: McpPoolService,
    private readonly sessionEventsService: SessionEventsService,
    private readonly bundleService: BundleService,
    private readonly eventMapper: EventMapperService,
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
      solutionId,
      message,
      context,
      attachments,
      sessionTtlMs: templateTtlMs,
      templateName,
      emitEvent,
    } = input;

    // These are populated from template resolution below
    let mcpServers: Record<string, McpServerConfig> | undefined;
    let mcpServerSlugs: string[] | undefined;
    let skillPath: string | undefined;
    let { enabledSkills, systemPrompt } = input;

    const sessionId = session.sessionId;

    this.logger.log(`Orchestrating message for session ${sessionId}`);

    // Step 1: Resolve tenant slug/id to actual tenant UUID
    let resolvedTenantId = solutionId;
    let resolvedTenant: Awaited<ReturnType<typeof this.tenantsService.findOne>> = null;
    try {
      resolvedTenant = await this.tenantsService.findOne(solutionId);
      if (resolvedTenant) {
        resolvedTenantId = resolvedTenant.id;
        this.logger.debug(`Resolved tenant ${solutionId} to UUID ${resolvedTenantId}`);
      } else {
        this.logger.warn(`Solution not found: ${solutionId}, using as-is`);
      }
    } catch (error) {
      this.logger.warn(`Failed to resolve tenant: ${error}`);
    }

    // Store tenant context on session (use original for display, resolved for queries)
    session.solutionId = resolvedTenantId;
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
    let skillPromptModeMap: Record<string, 'protocol' | 'inline'> = {};
    let templateAppendPrompt: string | undefined;

    if (effectiveTemplateName) {
      const availableTemplates = Object.keys(resolvedTenant?.config?.sessionTemplates ?? {});
      this.logger.debug(
        `Template lookup: tenant=${resolvedTenantId}, template=${effectiveTemplateName}, ` +
        `available=[${availableTemplates.join(',')}], tenantFound=${!!resolvedTenant}, ` +
        `hasConfig=${!!resolvedTenant?.config}`,
      );

      // Solution config is a JSON column — use explicit any cast for template fields
      const tmpl = resolvedTenant?.config?.sessionTemplates?.[effectiveTemplateName] as Record<string, any> | undefined;
      if (tmpl) {
        this.logger.log(`Applying template "${effectiveTemplateName}" for session ${sessionId}`);
        mcpServers = tmpl['mcpServers'] as Record<string, McpServerConfig> | undefined;
        if (Array.isArray(tmpl['mcpServerSlugs'])) {
          mcpServerSlugs = tmpl['mcpServerSlugs'].filter(
            (s): s is string => typeof s === 'string' && s.length > 0,
          );
        }
        if (!enabledSkills && Array.isArray(tmpl['enabledSkills'])) {
          const resolved = this.resolveEnabledSkills(tmpl['enabledSkills']);
          enabledSkills = resolved.slugs;
          skillPromptModeMap = resolved.promptModeMap;
        }
        if (!systemPrompt && tmpl['appendSystemPrompt'])     systemPrompt = tmpl['appendSystemPrompt'];
        skillPath = tmpl['skillPath'] as string | undefined;
        skillPromptMode = tmpl['skillPromptMode'] as typeof skillPromptMode;
        templateAppendPrompt = tmpl['appendSystemPrompt'] as string | undefined;
        if (tmpl['sessionTtlMs']) {
          session.sessionTtlMs = Math.min(session.sessionTtlMs ?? 300000, tmpl['sessionTtlMs'] as number);
        }
        this.logger.debug(
          `Template "${effectiveTemplateName}" resolved: enabledSkills=${JSON.stringify(enabledSkills)}, ` +
          `skillPromptMode=${skillPromptMode}, skillPath=${skillPath}, ` +
          `hasSystemPrompt=${!!systemPrompt}, hasMcpServers=${!!mcpServers}`,
        );
      } else {
        this.logger.warn(`Template "${effectiveTemplateName}" not found for tenant ${resolvedTenantId}`);
        // Fallback: load all tenant skills to prevent silent no-skill degradation
        if (!enabledSkills) {
          const allSkills = await this.skillsService.findPublished(resolvedTenantId);
          enabledSkills = allSkills.filter(s => s.enabled).map(s => s.slug);
          this.logger.warn(`Template fallback: loaded ${enabledSkills.length} tenant skills`);
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

    // Step 2b: Resolve active bundles and inject their MCP servers / system prompts
    const tenantEnabledBundles = resolvedTenant?.config?.enabledBundles ?? [];
    if (tenantEnabledBundles.length > 0) {
      // Template bundles (if specified) are filtered against tenant-enabled bundles
      const tmpl = effectiveTemplateName
        ? resolvedTenant?.config?.sessionTemplates?.[effectiveTemplateName] as Record<string, any> | undefined
        : undefined;
      const templateBundles = tmpl?.['bundles'] as string[] | undefined;

      const bundleResolution = this.bundleService.resolveActiveBundles(
        templateBundles,
        tenantEnabledBundles,
      );

      // Inject bundle MCP servers
      if (Object.keys(bundleResolution.mcpServers).length > 0) {
        mcpServers = { ...(mcpServers ?? {}), ...bundleResolution.mcpServers };
        this.logger.log(
          `Session ${sessionId} bundle MCP servers: ${Object.keys(bundleResolution.mcpServers).join(', ')}`,
        );
      }

      // Append bundle system prompts
      for (const prompt of bundleResolution.appendSystemPrompts) {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      }

      if (bundleResolution.activeBundleIds.length > 0) {
        this.logger.debug(
          `Session ${sessionId} active bundles: ${bundleResolution.activeBundleIds.join(', ')}`,
        );
      }

      // Ensure bundle triggers are registered in the running EventMapperService.
      // SolutionLoaderService registers triggers at import time in a separate process,
      // but those registrations are lost when that process exits. This ensures the
      // running backend always has the correct triggers for event generation.
      if (bundleResolution.toolEventTriggers.length > 0) {
        this.eventMapper.registerBundleTriggers(
          resolvedTenantId,
          bundleResolution.toolEventTriggers,
        );
      }
    }

    // Step 2c: Auto-load tenant-registered MCP servers and merge with template/bundle servers
    // Priority: mcpServerSlugs (selective) > load all active (fallback)
    try {
      const tenantMcpServers = await this.mcpPoolService.findAllByTenantId(resolvedTenantId);
      let activeServers = tenantMcpServers.filter(s => s.status === 'active');

      // If template specifies mcpServerSlugs, only load those named servers
      if (mcpServerSlugs && mcpServerSlugs.length > 0) {
        const slugSet = new Set(mcpServerSlugs);
        activeServers = activeServers.filter(s => slugSet.has(s.slug));
        const foundSlugs = new Set(activeServers.map(s => s.slug));
        const missing = mcpServerSlugs.filter(s => !foundSlugs.has(s));
        if (missing.length > 0) {
          this.logger.warn(`MCP server slugs not found: [${missing.join(',')}]`);
        }
        this.logger.debug(
          `Selective MCP loading: requested=[${mcpServerSlugs.join(',')}], found=[${activeServers.map(s => s.slug).join(',')}]`,
        );
      }

      if (activeServers.length > 0) {
        const tenantMcpConfigs: Record<string, McpServerConfig> = {};
        for (const server of activeServers) {
          // REST adapter → wrap as stdio bridge process.
          // Note: restAdapter config (including auth credentials) is passed via env var.
          // This matches how all stdio MCP servers receive config and is acceptable since
          // the bridge runs as a server-side child process, not exposed to the LLM directly.
          if (!server.config?.command && server.config?.restAdapter) {
            const coreMcpDir = process.env.CORE_MCP_DIR
              || path.resolve(__dirname, '..', '..', '..', '..', 'mcp');
            tenantMcpConfigs[server.slug] = {
              command: 'node',
              args: [path.join(coreMcpDir, 'rest-adapter-bridge', 'dist', 'index.js')],
              env: {
                REST_ADAPTER_CONFIG: JSON.stringify(server.config.restAdapter),
                ...(server.config?.env as Record<string, string> ?? {}),
              },
            };
            this.logger.log(`REST adapter "${server.slug}" wrapped as stdio bridge`);
            continue;
          }

          // Skip servers with incomplete config (neither command nor restAdapter)
          if (!server.config?.command) {
            this.logger.warn(`Skipping MCP server "${server.slug}": missing command and restAdapter`);
            continue;
          }
          tenantMcpConfigs[server.slug] = {
            command: server.config.command,
            args: (server.config?.args ?? []).map((arg: string) => {
              // Already-resolved formats: absolute path, tenant path, CLI flag, template var
              if (arg.startsWith('/') || arg.startsWith('tenants/') ||
                  arg.startsWith('-') || arg.startsWith('${')) {
                return arg;
              }
              // Non-path patterns: URL, pure digits, JSON, key=value
              if (/^https?:\/\//.test(arg) || /^\d+$/.test(arg) ||
                  arg.startsWith('{') || arg.startsWith('[') || arg.includes('=')) {
                return arg;
              }
              // Skip prefixing for path traversal — pass through unchanged
              if (arg.includes('..')) {
                this.logger.warn(`Skipping tenant-path prefix for arg with traversal: "${arg}"`);
                return arg;
              }
              // Heuristic: only transform args that look like file paths (contain . or /)
              if (!arg.includes('.') && !arg.includes('/')) {
                return arg;
              }
              return `tenants/${resolvedTenantId}/mcp-servers/${server.slug}/${arg}`;
            }),
            env: server.config?.env as Record<string, string> | undefined,
          };
        }
        // Merge: tenant servers first, then template/bundle overrides on top
        if (Object.keys(tenantMcpConfigs).length > 0) {
          mcpServers = { ...tenantMcpConfigs, ...(mcpServers ?? {}) };
          this.logger.log(
            `Session ${sessionId} merged ${Object.keys(tenantMcpConfigs).length} tenant MCP server(s): ${Object.keys(tenantMcpConfigs).join(', ')}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to auto-load tenant MCP servers: ${error.message}`);
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
          skillSlugs: enabledSkills,
        },
      );
      session.skillSyncedAt = new Date();
      skillSyncedCount = syncResult.skillCount;

      // Track which skills are synced to this session for precise restart
      if (syncResult.skillIds && syncResult.skillIds.length > 0) {
        this.sessionService.trackSyncedSkills(sessionId, syncResult.skillIds);
        this.logger.debug(`Tracked ${syncResult.skillIds.length} synced skills for session ${sessionId}`);
      }

      this.logger.log(`Synced ${syncResult.skillCount} skills for tenant ${solutionId} (${resolvedTenantId})`);
    } catch (error) {
      this.logger.warn(`Failed to sync skills: ${error}`);
      // Continue without skills - non-fatal
    }

    // Step 4b: Generate skill prompt based on per-skill or global promptMode.
    // Mixed mode (per-skill overrides) or inline mode generate system prompts here.
    // Protocol mode (default) is unchanged — agent reads SKILL.md at runtime.
    const hasPerSkillOverrides = Object.keys(skillPromptModeMap).length > 0;
    if (skillSyncedCount > 0 && (hasPerSkillOverrides || skillPromptMode === 'inline')) {
      try {
        const skills = await this.skillManagementService.loadEnabledSkills(
          resolvedTenantId,
          enabledSkills,
        );
        let skillPromptContent: string | undefined;

        if (hasPerSkillOverrides) {
          skillPromptContent = await this.skillManagementService.generateMixedSkillPrompt(
            session.workspaceDir,
            skills,
            skillPromptModeMap,
            skillPromptMode ?? 'protocol',
          );
        } else {
          skillPromptContent = await this.skillManagementService.generateInlineSkillPrompt(
            session.workspaceDir,
            skills,
          );
        }

        if (skillPromptContent) {
          systemPrompt = templateAppendPrompt?.trim()
            ? `${skillPromptContent}\n\n${templateAppendPrompt}`
            : skillPromptContent;
        }
      } catch (error) {
        this.logger.warn(`Failed to generate skill prompt: ${error}`);
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

    // Step 5: Filesystem fallback — only copy skill directories if DB has no files.
    // SkillSyncService (Step 4) now writes files from DB. This cpSync fallback is only
    // needed when skills haven't been imported to DB yet (e.g. local dev without skill:import).
    if (skillPath && fs.existsSync(skillPath)) {
      try {
        const skillSourceDir = path.dirname(skillPath);
        const skillName = path.basename(skillSourceDir);
        const targetDir = path.join(session.workspaceDir, '.claude', 'skills', skillName);

        // Check if DB-synced files already exist (SkillSyncService wrote them)
        const skillMdPath = path.join(targetDir, 'SKILL.md');
        const hasDbFiles = fs.existsSync(skillMdPath);

        if (!hasDbFiles) {
          this.logger.warn(
            `Skill ${skillName} not found in DB sync output — falling back to cpSync from filesystem. ` +
            `Run "npm run skill:import" to import skills into DB for proper management.`,
          );
          fs.cpSync(skillSourceDir, targetDir, {
            recursive: true,
            filter: (src) => !path.basename(src).startsWith('.'),
          });
          this.logger.log(`Copied skill directory ${skillName} to session workspace (filesystem fallback)`);
        }

        // Step 5b: Fallback for sibling skill directories
        if (enabledSkills && enabledSkills.length > 0) {
          const skillsParentDir = path.dirname(skillSourceDir);
          for (const slug of enabledSkills) {
            if (slug === skillName) continue;
            const siblingTarget = path.join(session.workspaceDir, '.claude', 'skills', slug);
            const siblingSkillMd = path.join(siblingTarget, 'SKILL.md');

            // Only copy from filesystem if DB sync didn't handle it
            if (!fs.existsSync(siblingSkillMd)) {
              const siblingDir = path.join(skillsParentDir, slug);
              if (fs.existsSync(siblingDir) && fs.statSync(siblingDir).isDirectory()) {
                fs.cpSync(siblingDir, siblingTarget, {
                  recursive: true,
                  filter: (src) => !path.basename(src).startsWith('.'),
                });
                this.logger.debug(`Copied sibling skill directory ${slug} to session workspace (filesystem fallback)`);
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to copy skill directory: ${error}`);
        // Continue without skill - non-fatal
      }
    }

    // Step 6: Create message records for persistence
    const userMessage = await this.messagesService.create({
      sessionId,
      solutionId: resolvedTenantId,
      role: 'user',
      content: message,
    });

    const assistantMessage = await this.messagesService.create({
      sessionId,
      solutionId: resolvedTenantId,
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
          solutionId: resolvedTenantId,
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

    const handleEvent = (event: SessionEvent) => {
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

      // Emit to client with turn context (CCAAS-provided metadata)
      emitEvent({
        ...event,
        ...(session.currentTurnId && { turnId: session.currentTurnId }),
      });

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

  /**
   * Parse enabledSkills array (string | object union) into slugs and per-skill promptMode map.
   */
  private resolveEnabledSkills(
    enabledSkills: Array<string | { slug: string; promptMode?: 'protocol' | 'inline' }>,
  ): { slugs: string[]; promptModeMap: Record<string, 'protocol' | 'inline'> } {
    const slugs: string[] = [];
    const promptModeMap: Record<string, 'protocol' | 'inline'> = {};
    for (const entry of enabledSkills) {
      if (typeof entry === 'string') {
        slugs.push(entry);
      } else if (entry && typeof entry === 'object' && typeof entry.slug === 'string') {
        slugs.push(entry.slug);
        if (entry.promptMode === 'protocol' || entry.promptMode === 'inline') {
          promptModeMap[entry.slug] = entry.promptMode;
        }
      }
    }
    return { slugs, promptModeMap };
  }
}
