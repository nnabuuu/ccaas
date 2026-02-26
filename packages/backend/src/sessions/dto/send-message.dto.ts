/**
 * Send Message DTO
 *
 * Data transfer object for the new HTTP Streaming endpoint.
 * POST /api/v1/sessions/:sessionId/messages
 *
 * Unlike the legacy /completion endpoint, this does NOT require
 * a WebSocket connection. Events stream back via SSE in the response.
 */

import { IsString, IsOptional, IsObject, IsArray, IsNumber, IsBoolean, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
  /**
   * tenantId is @IsOptional() here so class-validator does not reject the DTO
   * when the field is absent. Runtime enforcement happens inside sendMessage():
   * if tenantId is missing, an SSE error event is emitted and the stream is
   * closed immediately — resulting in an application-level 400-equivalent
   * response rather than an HTTP 400.
   */
  @IsOptional()
  @IsString()
  tenantId?: string;

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

  @ApiProperty({
    description: '会话模板名称 / Session template name to apply',
    required: false,
    example: 'teacher',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateName?: string;

  @ApiProperty({
    description: '处理完成后立即关闭 session / Auto-close session after processing completes',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoClose?: boolean;
}
