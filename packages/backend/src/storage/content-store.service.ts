/**
 * Content Store Service
 *
 * Provides content-addressed storage for large outputs and system prompts.
 * Uses SHA-256 hashing for deduplication and efficient retrieval.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { LargeContent } from './entities/large-content.entity';
import { SystemPromptVersion } from './entities/system-prompt-version.entity';

/** Threshold for storing content as large content (10KB) */
const LARGE_CONTENT_THRESHOLD = 10 * 1024;

@Injectable()
export class ContentStoreService {
  private readonly logger = new Logger(ContentStoreService.name);

  constructor(
    @InjectRepository(LargeContent)
    private readonly largeContentRepository: Repository<LargeContent>,
    @InjectRepository(SystemPromptVersion)
    private readonly systemPromptRepository: Repository<SystemPromptVersion>,
  ) {}

  /**
   * Compute SHA-256 hash of content
   */
  hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Check if content should be stored as large content
   */
  isLargeContent(content: string): boolean {
    return Buffer.byteLength(content, 'utf8') > LARGE_CONTENT_THRESHOLD;
  }

  /**
   * Store large content if it doesn't exist, or increment ref count if it does
   * Returns the content hash
   */
  async storeLargeContent(
    content: string,
    mimeType?: string,
  ): Promise<{ hash: string; isNew: boolean }> {
    const hash = this.hashContent(content);
    const size = Buffer.byteLength(content, 'utf8');

    // Check if content already exists
    const existing = await this.largeContentRepository.findOne({
      where: { hash },
    });

    if (existing) {
      // Increment ref count
      await this.largeContentRepository.increment({ hash }, 'refCount', 1);
      this.logger.debug(`Large content ${hash.slice(0, 8)}... already exists, ref count incremented`);
      return { hash, isNew: false };
    }

    // Store new content
    const largeContent = this.largeContentRepository.create({
      hash,
      content,
      size,
      mimeType: mimeType || null,
      refCount: 1,
    });

    await this.largeContentRepository.save(largeContent);
    this.logger.debug(`Stored new large content ${hash.slice(0, 8)}... (${size} bytes)`);
    return { hash, isNew: true };
  }

  /**
   * Retrieve large content by hash
   */
  async getLargeContent(hash: string): Promise<string | null> {
    const content = await this.largeContentRepository.findOne({
      where: { hash },
    });
    return content?.content || null;
  }

  /**
   * Decrement ref count for large content, optionally delete if count reaches 0
   */
  async releaseLargeContent(hash: string, deleteIfZero = true): Promise<void> {
    const existing = await this.largeContentRepository.findOne({
      where: { hash },
    });

    if (!existing) return;

    if (existing.refCount <= 1 && deleteIfZero) {
      await this.largeContentRepository.delete({ hash });
      this.logger.debug(`Deleted large content ${hash.slice(0, 8)}... (ref count reached 0)`);
    } else {
      await this.largeContentRepository.decrement({ hash }, 'refCount', 1);
    }
  }

  /**
   * Store or retrieve a system prompt by content hash
   * Returns the hash for reference
   */
  async storeSystemPrompt(
    content: string,
    label?: string,
  ): Promise<{ hash: string; isNew: boolean }> {
    const hash = this.hashContent(content);
    const size = Buffer.byteLength(content, 'utf8');

    // Check if prompt already exists
    const existing = await this.systemPromptRepository.findOne({
      where: { hash },
    });

    if (existing) {
      // Increment ref count
      await this.systemPromptRepository.increment({ hash }, 'refCount', 1);
      this.logger.debug(`System prompt ${hash.slice(0, 8)}... already exists, ref count incremented`);
      return { hash, isNew: false };
    }

    // Store new prompt
    const prompt = this.systemPromptRepository.create({
      hash,
      content,
      size,
      label: label || null,
      refCount: 1,
    });

    await this.systemPromptRepository.save(prompt);
    this.logger.debug(`Stored new system prompt ${hash.slice(0, 8)}... (${size} bytes)`);
    return { hash, isNew: true };
  }

  /**
   * Retrieve system prompt by hash
   */
  async getSystemPrompt(hash: string): Promise<string | null> {
    const prompt = await this.systemPromptRepository.findOne({
      where: { hash },
    });
    return prompt?.content || null;
  }

  /**
   * Get system prompt metadata
   */
  async getSystemPromptMetadata(hash: string): Promise<{
    hash: string;
    size: number;
    label: string | null;
    refCount: number;
    createdAt: Date;
  } | null> {
    const prompt = await this.systemPromptRepository.findOne({
      where: { hash },
    });

    if (!prompt) return null;

    return {
      hash: prompt.hash,
      size: prompt.size,
      label: prompt.label,
      refCount: prompt.refCount,
      createdAt: prompt.createdAt,
    };
  }

  /**
   * Store content conditionally - if large, store in LargeContent and return hash
   * Otherwise return null (content should be stored inline)
   */
  async storeIfLarge(
    content: string,
    mimeType?: string,
  ): Promise<{ hash: string; stored: true } | { hash: null; stored: false }> {
    if (!this.isLargeContent(content)) {
      return { hash: null, stored: false };
    }

    const { hash } = await this.storeLargeContent(content, mimeType);
    return { hash, stored: true };
  }

  /**
   * Resolve content - if hash is provided, retrieve from storage, otherwise return inline content
   */
  async resolveContent(
    inlineContent: string | null,
    contentHash: string | null,
  ): Promise<string | null> {
    if (contentHash) {
      return this.getLargeContent(contentHash);
    }
    return inlineContent;
  }
}
