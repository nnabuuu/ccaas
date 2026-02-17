/**
 * Send Message DTO
 *
 * Data transfer object for the new HTTP Streaming endpoint.
 * POST /api/v1/sessions/:sessionId/messages
 *
 * Unlike the legacy /completion endpoint, this does NOT require
 * a WebSocket connection. Events stream back via SSE in the response.
 */

import { IsString, IsOptional, IsObject, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
 * Attachment sent with a message
 */
export class MessageAttachmentDto {
  @ApiProperty({
    description: '附件类型 / Attachment type',
    enum: ['image', 'document'],
    example: 'image',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: '工作区相对路径 / Workspace-relative path',
    example: 'images/photo.png',
  })
  @IsString()
  path: string;
}

/**
 * Request body for POST /api/v1/sessions/:sessionId/messages
 *
 * SSE streaming endpoint - no WebSocket required.
 */
export class SendMessageDto {
  @ApiProperty({
    description: '用户消息内容 / User message content',
    example: '请帮我分析这个错误日志',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: '租户 ID / Tenant ID',
    example: 'tenant-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    description: 'MCP 服务器配置 / MCP server configurations',
    required: false,
  })
  @IsOptional()
  @IsObject()
  mcpServers?: Record<string, McpServerConfig>;

  @ApiProperty({
    description: '技能文件路径 / Skill file path',
    required: false,
  })
  @IsOptional()
  @IsString()
  skillPath?: string;

  @ApiProperty({
    description: '启用的技能 slug 列表 / Enabled skill slugs',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkillSlugs?: string[];

  @ApiProperty({
    description: '追加的系统提示词 / Additional system prompt',
    required: false,
  })
  @IsOptional()
  @IsString()
  appendSystemPrompt?: string;

  @ApiProperty({
    description: '附件列表 / Attachments',
    required: false,
    type: [MessageAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];

  @ApiProperty({
    description: '页面上下文 / Page context',
    required: false,
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiProperty({
    description: '断线重连：从此序号之后的事件开始重放 / Reconnect: replay events after this sequence number',
    required: false,
    example: 42,
  })
  @IsOptional()
  @IsNumber()
  afterSeq?: number;
}
