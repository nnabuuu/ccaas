/**
 * Storage Controller
 *
 * API endpoints for content-addressed storage.
 */

import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ContentStoreService } from './content-store.service';

@Controller('api/v1/content')
export class StorageController {
  constructor(private readonly contentStoreService: ContentStoreService) {}

  /**
   * Get large content by hash
   * GET /api/v1/content/:hash
   */
  @Get(':hash')
  async getContent(
    @Param('hash') hash: string,
  ): Promise<{ hash: string; content: string }> {
    const content = await this.contentStoreService.getLargeContent(hash);
    if (!content) {
      throw new NotFoundException(`Content with hash ${hash} not found`);
    }
    return { hash, content };
  }

  /**
   * Get system prompt by hash
   * GET /api/v1/content/system-prompt/:hash
   */
  @Get('system-prompt/:hash')
  async getSystemPrompt(
    @Param('hash') hash: string,
  ): Promise<{
    hash: string;
    content: string;
    metadata: {
      size: number;
      label: string | null;
      refCount: number;
      createdAt: Date;
    } | null;
  }> {
    const content = await this.contentStoreService.getSystemPrompt(hash);
    if (!content) {
      throw new NotFoundException(`System prompt with hash ${hash} not found`);
    }

    const metadata = await this.contentStoreService.getSystemPromptMetadata(hash);

    return { hash, content, metadata };
  }
}
