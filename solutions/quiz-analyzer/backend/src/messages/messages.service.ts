import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../database/entities';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async createMessage(dto: CreateMessageDto): Promise<Message> {
    // Use transaction to prevent race condition in auto-incrementing message_index
    return this.messageRepository.manager.transaction(async (manager) => {
      const messageRepo = manager.getRepository(Message);

      // Use MAX + 1 instead of COUNT to get next index atomically
      const result = await messageRepo
        .createQueryBuilder('message')
        .select('MAX(message.message_index)', 'maxIndex')
        .where('message.session_id = :sessionId', { sessionId: dto.sessionId })
        .getRawOne();

      const nextIndex = result?.maxIndex != null ? result.maxIndex + 1 : 0;

      const message = messageRepo.create({
        id: `msg_${uuidv4()}`,
        session_id: dto.sessionId,
        role: dto.role,
        content: dto.content,
        message_index: nextIndex,
        parent_message_id: dto.parentMessageId || null,
        branch_id: dto.branchId || null,
        is_continuation: dto.isContinuation ? 1 : 0,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        tool_calls: dto.toolCalls ? JSON.stringify(dto.toolCalls) : null,
        thinking_blocks: dto.thinkingBlocks ? JSON.stringify(dto.thinkingBlocks) : null,
      });

      return messageRepo.save(message);
    });
  }

  async getMessagesBySession(
    sessionId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: Message[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [data, total] = await this.messageRepository.findAndCount({
      where: { session_id: sessionId },
      order: { message_index: 'ASC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  async getMessageCount(sessionId: string): Promise<number> {
    return this.messageRepository.count({
      where: { session_id: sessionId },
    });
  }
}
