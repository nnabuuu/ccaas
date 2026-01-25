/**
 * Chat Message DTOs
 *
 * Data transfer objects for chat-related operations.
 */

import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

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
