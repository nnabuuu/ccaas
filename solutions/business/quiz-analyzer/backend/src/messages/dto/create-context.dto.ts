import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class CreateConversationContextBodyDto {
  @IsString()
  tenantId: string;

  @IsOptional()
  @IsString()
  systemPromptHash?: string;

  @IsOptional()
  @IsArray()
  skillConfigHashes?: Array<{ slug: string; hash: string }>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mcpToolsList?: string[];

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  workspaceDir?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// Internal DTO with sessionId (used by service layer)
export interface CreateConversationContextDto {
  sessionId: string;
  tenantId: string;
  systemPromptHash?: string;
  skillConfigHashes?: Array<{ slug: string; hash: string }>;
  mcpToolsList?: string[];
  model?: string;
  workspaceDir?: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}
