/**
 * Chat Message DTOs
 *
 * Data transfer objects for chat-related operations.
 */

import { IsString, IsOptional, IsObject, IsBoolean, IsArray } from 'class-validator';

/**
 * MCP Server configuration passed from solution backends
 */
export interface McpServerConfig {
  command: string;
  args: string[];
  description?: string;
  env?: Record<string, string>;
}

/**
 * Chat message from frontend
 */
export class ChatMessageDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  resumeSession?: boolean;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsObject()
  mcpServers?: Record<string, McpServerConfig>;

  @IsOptional()
  @IsString()
  skillPath?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkillSlugs?: string[];
}

/**
 * Cancel request from frontend
 */
export class CancelRequestDto {
  @IsOptional()
  @IsString()
  sessionId?: string;
}

/**
 * Reconnect request from frontend
 */
export class ReconnectRequestDto {
  @IsString()
  sessionId: string;
}

/**
 * Send message via REST API (primary entry point)
 * Uses clientId to find WebSocket connection for streaming response
 */
export class SendMessageDto {
  @IsString()
  clientId: string; // Required: WebSocket client ID

  @IsString()
  message: string; // Required: User message

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsBoolean()
  resumeSession?: boolean;

  @IsOptional()
  @IsObject()
  mcpServers?: Record<string, McpServerConfig>;

  @IsOptional()
  @IsString()
  skillPath?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkillSlugs?: string[];
}

/**
 * Cancel operation via REST API
 */
export class CancelOperationDto {
  @IsString()
  clientId: string; // Required: WebSocket client ID

  @IsOptional()
  @IsString()
  sessionId?: string;
}
