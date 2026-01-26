/**
 * Create Completion DTO
 *
 * Data transfer object for creating a completion (sending a message).
 */

import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';

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
 * Request body for POST /api/v1/sessions/:sessionId/completion
 */
export class CreateCompletionDto {
  @IsString()
  clientId: string; // WebSocket client ID

  @IsString()
  message: string; // User message

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
 * Request body for DELETE /api/v1/sessions/:sessionId/completion
 */
export class CancelCompletionDto {
  @IsString()
  clientId: string; // WebSocket client ID
}
