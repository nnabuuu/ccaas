/**
 * Chat Message DTOs
 *
 * Data transfer objects for chat-related operations.
 */

import { IsString, IsOptional, IsObject, IsArray, MaxLength } from 'class-validator';

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
  @IsString()
  solutionId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkills?: string[];

  @IsOptional()
  @IsString()
  appendSystemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateName?: string;
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
  solutionId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>; // NEW: Page context sent with message

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkills?: string[];

  @IsOptional()
  @IsString()
  appendSystemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateName?: string;
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
