/**
 * Skill Router Service
 *
 * Routes chat requests to appropriate skills and manages skill context.
 * Integrates with session manager to provide skill-aware sessions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsService } from './skills.service';
import { McpPoolService } from '../mcp/mcp-pool.service';
import { Skill } from './entities/skill.entity';
import type { McpTool } from '../mcp/types';

// Local type definition matching the entity's trigger structure
interface TriggerConfig {
  type: 'keyword' | 'intent' | 'pattern' | 'context';
  value: string;
  priority?: number;
  description?: string;
}

// ============================================================================
// TYPES
// ============================================================================

export interface SkillWithContent extends Skill {
  mcpServers?: Array<{ mcpServerId: string; allowedTools?: string[] }>;
}

export interface SkillChatRequest {
  skillId?: string;
  skillSlug?: string;
  message: string;
  sessionId?: string;
  context?: Record<string, unknown>;
  options?: {
    model?: string;
    maxTokens?: number;
    stream?: boolean;
    includeToolActivity?: boolean;
  };
}

export interface SkillContext {
  skill: SkillWithContent;
  systemPrompt: string;
  tools: string[];
  mcpServers: string[];
  mcpTools: McpTool[];
}

export interface RoutedSession {
  sessionId: string;
  tenantId?: string;
  skillId?: string;
  skillSlug?: string;
  systemPrompt?: string;
  workspaceDir?: string;
}

// ============================================================================
// SKILL ROUTER SERVICE
// ============================================================================

@Injectable()
export class SkillRouterService {
  private readonly logger = new Logger(SkillRouterService.name);
  private readonly workspaceDir: string;
  private skillContextCache: Map<string, SkillContext> = new Map();

  constructor(
    private readonly skillsService: SkillsService,
    private readonly mcpPoolService: McpPoolService,
    private readonly configService: ConfigService,
  ) {
    this.workspaceDir = this.configService.get(
      'workspace.dir',
      '.agent-workspace',
    );
  }

  // ==========================================================================
  // ROUTING
  // ==========================================================================

  /**
   * Route a chat request to the appropriate skill
   */
  async routeChat(
    tenantId: string,
    request: SkillChatRequest,
  ): Promise<SkillContext | null> {
    let skill: Skill | null = null;

    // Resolve skill if specified
    if (request.skillId) {
      skill = await this.skillsService.findOne(tenantId, request.skillId);
    } else if (request.skillSlug) {
      skill = await this.skillsService.findOne(tenantId, request.skillSlug);
    } else {
      // Try to resolve from message content using triggers
      skill = await this.resolveSkillFromMessage(tenantId, request.message);
    }

    if (!skill) {
      return null;
    }

    // Build skill context
    return this.buildSkillContext(tenantId, skill as SkillWithContent);
  }

  /**
   * Resolve skill from message content using triggers
   */
  private async resolveSkillFromMessage(
    tenantId: string,
    message: string,
  ): Promise<Skill | null> {
    const publishedSkills = await this.skillsService.findPublished(tenantId);
    const messageLower = message.toLowerCase();

    // Sort by trigger priority
    const skillsWithMatches: Array<{ skill: Skill; priority: number }> = [];

    for (const skill of publishedSkills) {
      if (!skill.triggers || skill.triggers.length === 0) continue;

      for (const trigger of skill.triggers) {
        if (this.matchesTrigger(messageLower, message, trigger)) {
          skillsWithMatches.push({
            skill,
            priority: trigger.priority ?? 0,
          });
          break; // One match per skill is enough
        }
      }
    }

    if (skillsWithMatches.length === 0) {
      return null;
    }

    // Return highest priority match
    skillsWithMatches.sort((a, b) => b.priority - a.priority);
    return skillsWithMatches[0].skill;
  }

  /**
   * Check if message matches a trigger
   */
  private matchesTrigger(
    messageLower: string,
    messageOriginal: string,
    trigger: TriggerConfig,
  ): boolean {
    const valueLower = trigger.value.toLowerCase();

    switch (trigger.type) {
      case 'keyword':
        return messageLower.includes(valueLower);

      case 'pattern':
        try {
          const regex = new RegExp(trigger.value, 'i');
          return regex.test(messageOriginal);
        } catch {
          return false;
        }

      case 'intent':
        // Simple intent matching - check if message starts with or contains the intent
        return (
          messageLower.startsWith(valueLower) ||
          messageLower.includes(` ${valueLower} `) ||
          messageLower.includes(` ${valueLower}`)
        );

      case 'context':
        // Context triggers would need additional context from session
        // For now, treat as keyword match
        return messageLower.includes(valueLower);

      default:
        return false;
    }
  }

  // ==========================================================================
  // SKILL CONTEXT
  // ==========================================================================

  /**
   * Build context for a skill
   */
  private async buildSkillContext(
    tenantId: string,
    skill: SkillWithContent,
  ): Promise<SkillContext> {
    // Check cache
    const cacheKey = `${skill.id}:${skill.currentVersion}`;
    const cached = this.skillContextCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(skill);

    // Get allowed tools
    const tools = skill.allowedTools || [];

    // Get MCP servers and their tools
    const mcpServers = skill.mcpServers?.map((m) => m.mcpServerId) || [];
    const mcpTools = await this.mcpPoolService.getToolsForSession(
      tenantId,
      mcpServers.length > 0 ? mcpServers : undefined,
    );

    const context: SkillContext = {
      skill,
      systemPrompt,
      tools,
      mcpServers,
      mcpTools,
    };

    // Cache for future requests
    this.skillContextCache.set(cacheKey, context);

    return context;
  }

  /**
   * Build the system prompt for a skill
   */
  private buildSystemPrompt(skill: SkillWithContent): string {
    const parts: string[] = [];

    // Add skill header
    parts.push(`# Skill: ${skill.name}`);
    if (skill.description) {
      parts.push(`\n${skill.description}\n`);
    }

    // Add configuration notes for sub-agents
    if (skill.type === 'sub-agent') {
      const config = skill.config as { model?: string; maxTokens?: number };
      parts.push(`\n## Configuration`);
      if (config.model) {
        parts.push(`- Model: ${config.model}`);
      }
      if (config.maxTokens) {
        parts.push(`- Max Tokens: ${config.maxTokens}`);
      }
    }

    // Add tool restrictions
    if (skill.allowedTools && skill.allowedTools.length > 0) {
      parts.push(`\n## Available Tools`);
      parts.push(
        `Only use the following tools: ${skill.allowedTools.join(', ')}`,
      );
    }

    // Add the main skill content
    parts.push(`\n## Instructions\n`);
    parts.push(skill.content);

    return parts.join('\n');
  }

  // ==========================================================================
  // SESSION CONTEXT
  // ==========================================================================

  /**
   * Prepare session directory with skill context
   */
  async prepareSessionContext(
    session: RoutedSession,
    skillContext: SkillContext,
    userContext?: Record<string, unknown>,
  ): Promise<void> {
    const sessionDir = path.join(
      this.workspaceDir,
      'sessions',
      session.sessionId,
    );
    await fs.mkdir(sessionDir, { recursive: true });

    // Write context.json
    const contextData = {
      skill: {
        id: skillContext.skill.id,
        name: skillContext.skill.name,
        slug: skillContext.skill.slug,
        type: skillContext.skill.type,
        version: skillContext.skill.currentVersion,
      },
      allowedTools: skillContext.tools,
      mcpServers: skillContext.mcpServers,
      mcpTools: skillContext.mcpTools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      ...userContext,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(sessionDir, 'context.json'),
      JSON.stringify(contextData, null, 2),
      'utf-8',
    );

    // Write system prompt
    await fs.writeFile(
      path.join(sessionDir, 'system-prompt.md'),
      skillContext.systemPrompt,
      'utf-8',
    );

    // Write skill content for reference
    await fs.writeFile(
      path.join(sessionDir, 'skill.md'),
      skillContext.skill.content,
      'utf-8',
    );

    this.logger.debug(
      `Prepared session context for ${session.sessionId} with skill ${skillContext.skill.slug}`,
    );
  }

  /**
   * Generate CLI args for skill execution
   */
  generateCLIArgs(skillContext: SkillContext): string[] {
    const args: string[] = [];
    const config = skillContext.skill.config as {
      model?: string;
      maxTokens?: number;
    };

    // Add system prompt
    args.push('--system-prompt');
    args.push(skillContext.systemPrompt);

    // Add model if specified
    if (config.model) {
      args.push('--model');
      args.push(config.model);
    }

    // Add max tokens if specified (convert to max turns)
    if (config.maxTokens) {
      args.push('--max-turns');
      args.push(String(Math.ceil(config.maxTokens / 4096)));
    }

    // Add tool restrictions
    if (skillContext.tools.length > 0) {
      args.push('--allowed-tools');
      args.push(skillContext.tools.join(','));
    }

    return args;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Generate skill-aware message prefix
   */
  generateMessagePrefix(skillContext: SkillContext): string {
    if (skillContext.skill.type === 'sub-agent') {
      return `[Using skill: ${skillContext.skill.name}]\n\n`;
    }
    return '';
  }

  /**
   * Check if a message matches any skill triggers
   */
  async matchesTriggers(
    tenantId: string,
    message: string,
  ): Promise<{ matched: boolean; skill?: Skill }> {
    const skill = await this.resolveSkillFromMessage(tenantId, message);
    return {
      matched: skill !== null,
      skill: skill || undefined,
    };
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Clear cached skill context
   */
  clearCache(skillId?: string): void {
    if (skillId) {
      for (const key of this.skillContextCache.keys()) {
        if (key.startsWith(skillId)) {
          this.skillContextCache.delete(key);
        }
      }
    } else {
      this.skillContextCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; skills: string[] } {
    const skills = new Set<string>();
    for (const key of this.skillContextCache.keys()) {
      skills.add(key.split(':')[0]);
    }
    return {
      size: this.skillContextCache.size,
      skills: Array.from(skills),
    };
  }
}
