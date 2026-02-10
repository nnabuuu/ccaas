/**
 * Create Completion DTO
 *
 * Data transfer object for creating a completion (sending a message).
 */

import { IsString, IsOptional, IsObject, IsArray, ValidateNested } from 'class-validator';
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
 * Attachment sent with a completion request (e.g. an uploaded image)
 */
export class AttachmentDto {
  @ApiProperty({
    description: '附件类型：image（图片）或 document（文档）/ Attachment type',
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
 * Request body for POST /api/v1/sessions/:sessionId/completion
 */
export class CreateCompletionDto {
  @ApiProperty({
    description: 'WebSocket 客户端 ID（从 Socket.io 连接获取）/ WebSocket client ID',
    example: 'client-abc123',
  })
  @IsString()
  clientId: string;

  @ApiProperty({
    description: '用户消息内容 / User message content',
    example: '请帮我分析这个错误日志',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: '租户 ID（必需，用于加载技能配置）/ Tenant ID (required for skill loading)',
    example: 'tenant-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    description: 'MCP 服务器配置（由解决方案后端传递）/ MCP server configurations',
    required: false,
    example: {
      'my-api': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-rest'],
        description: 'REST API MCP Server',
      },
    },
  })
  @IsOptional()
  @IsObject()
  mcpServers?: Record<string, McpServerConfig>;

  @ApiProperty({
    description: '技能文件路径（可选，用于临时技能注入）/ Skill file path for temporary injection',
    required: false,
    example: '/path/to/skill/SKILL.md',
  })
  @IsOptional()
  @IsString()
  skillPath?: string;

  @ApiProperty({
    description: '启用的技能 slug 列表（仅加载指定技能）/ Enabled skill slugs',
    required: false,
    type: [String],
    example: ['data-analyzer', 'code-reviewer'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkillSlugs?: string[];

  @ApiProperty({
    description: '附件列表（图片、文档等）/ Attachments (images, documents, etc.)',
    required: false,
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

/**
 * Request body for DELETE /api/v1/sessions/:sessionId/completion
 */
export class CancelCompletionDto {
  @ApiProperty({
    description: 'WebSocket 客户端 ID / WebSocket client ID',
    example: 'client-abc123',
  })
  @IsString()
  clientId: string;
}
