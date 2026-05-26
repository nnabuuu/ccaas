import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageMetadata } from './entities/message.entity';
import { CreateMessageDto, MessageQueryDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Create a new message record
   */
  async create(dto: CreateMessageDto): Promise<Message> {
    // Get the next message index for this session
    const messageIndex =
      dto.messageIndex ??
      (await this.getNextMessageIndex(dto.sessionId));

    const message = this.messageRepository.create({
      sessionId: dto.sessionId,
      solutionId: dto.solutionId || null,
      role: dto.role,
      content: dto.content || '',
      metadata: dto.metadata || null,
      messageIndex,
    });

    const saved = await this.messageRepository.save(message);
    this.logger.debug(
      `Created ${dto.role} message ${saved.id} for session ${dto.sessionId}`,
    );
    return saved;
  }

  /**
   * Get the next message index for a session
   */
  private async getNextMessageIndex(sessionId: string): Promise<number> {
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .select('MAX(message.messageIndex)', 'maxIndex')
      .where('message.sessionId = :sessionId', { sessionId })
      .getRawOne();

    return (result?.maxIndex ?? -1) + 1;
  }

  /**
   * Find a message by ID
   */
  async findById(id: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id },
      relations: ['files', 'toolEvents'],
    });
  }

  /**
   * Find a message by ID or throw
   */
  async findByIdOrFail(id: string): Promise<Message> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundException(`Message ${id} not found`);
    }
    return message;
  }

  /**
   * Find all messages for a session
   */
  async findBySessionId(
    sessionId: string,
    options?: { limit?: number; offset?: number; includeToolEvents?: boolean },
  ): Promise<Message[]> {
    const relations = ['files'];
    if (options?.includeToolEvents) {
      relations.push('toolEvents');
    }

    return this.messageRepository.find({
      where: { sessionId },
      relations,
      order: { messageIndex: 'ASC' },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  /**
   * Update message content (for streaming accumulation)
   */
  async updateContent(id: string, content: string): Promise<Message> {
    await this.messageRepository.update(id, { content });
    return this.findByIdOrFail(id);
  }

  /**
   * Append content to message (for streaming)
   */
  async appendContent(id: string, additionalContent: string): Promise<Message> {
    const message = await this.findByIdOrFail(id);
    const newContent = message.content + additionalContent;
    return this.updateContent(id, newContent);
  }

  /**
   * Update message metadata (for token usage, etc.)
   */
  async updateMetadata(
    id: string,
    metadata: Partial<MessageMetadata>,
  ): Promise<Message> {
    const message = await this.findByIdOrFail(id);
    const mergedMetadata = { ...message.metadata, ...metadata };
    await this.messageRepository.update(id, { metadata: mergedMetadata });
    return this.findByIdOrFail(id);
  }

  /**
   * Query messages with filters
   */
  async query(dto: MessageQueryDto): Promise<Message[]> {
    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.files', 'files')
      .leftJoinAndSelect('message.toolEvents', 'toolEvents')
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('toolEvents.createdAt', 'ASC');

    if (dto.sessionId) {
      qb.andWhere('message.sessionId = :sessionId', {
        sessionId: dto.sessionId,
      });
    }

    if (dto.solutionId) {
      qb.andWhere('message.solutionId = :solutionId', { solutionId: dto.solutionId });
    }

    if (dto.limit) {
      qb.take(dto.limit);
    }

    if (dto.offset) {
      qb.skip(dto.offset);
    }

    return qb.getMany();
  }

  /**
   * Delete all messages for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.messageRepository.delete({ sessionId });
    this.logger.debug(
      `Deleted ${result.affected} messages for session ${sessionId}`,
    );
    return result.affected || 0;
  }

  /**
   * Count messages in a session
   */
  async countBySessionId(sessionId: string): Promise<number> {
    return this.messageRepository.count({ where: { sessionId } });
  }
}
