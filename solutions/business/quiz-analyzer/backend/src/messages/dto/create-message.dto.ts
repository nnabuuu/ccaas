import { IsString, IsIn, IsOptional, IsBoolean, IsObject, IsArray, MaxLength } from 'class-validator';

export class CreateMessageBodyDto {
  @IsIn(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @IsString()
  @MaxLength(100000)
  content: string;

  @IsOptional()
  @IsString()
  parentMessageId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isContinuation?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  toolCalls?: unknown[];

  @IsOptional()
  @IsArray()
  thinkingBlocks?: unknown[];
}

// Internal DTO with sessionId (used by service layer)
export interface CreateMessageDto {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parentMessageId?: string;
  branchId?: string;
  isContinuation?: boolean;
  metadata?: Record<string, unknown>;
  toolCalls?: unknown[];
  thinkingBlocks?: unknown[];
}
