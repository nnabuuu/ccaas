import { IsString, IsOptional, IsEnum, IsObject, IsInt, Min } from 'class-validator';
import { MessageRole, MessageMetadata } from '../entities/message.entity';
import { ToolEventPhase, ToolDecisionLogic } from '../entities/tool-event.entity';

export class CreateMessageDto {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsString()
  solutionId?: string;

  @IsEnum(['user', 'assistant'])
  role: MessageRole;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  metadata?: MessageMetadata;

  @IsOptional()
  @IsInt()
  @Min(0)
  messageIndex?: number;
}

export class UpdateMessageContentDto {
  @IsString()
  content: string;
}

export class UpdateMessageMetadataDto {
  @IsOptional()
  @IsObject()
  metadata?: MessageMetadata;
}

export class MessageQueryDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  solutionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ToolEventResponseDto {
  id: string;
  toolUseId: string;
  toolName: string;
  phase: ToolEventPhase;
  toolInput: Record<string, unknown> | null;
  toolOutput: unknown;
  success: boolean | null;
  durationMs: number | null;
  agentType: string | null;
  decisionLogic: ToolDecisionLogic | null;
  createdAt: Date;
}

export class MessageResponseDto {
  id: string;
  sessionId: string;
  solutionId: string | null;
  role: MessageRole;
  content: string;
  metadata: MessageMetadata | null;
  messageIndex: number;
  createdAt: Date;
  files: Array<{
    id: string;
    filename: string;
    mimeType: string | null;
    size: number;
    downloadUrl: string;
  }>;
  toolEvents: ToolEventResponseDto[];
}
