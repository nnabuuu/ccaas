import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import type { ChatMessageRecord } from '../../../domain/types/chat-message';
import type {
  ChatMessageCountRow,
  ChatMessageRepoPort,
  ContinueChatTurnInsert,
  DiscussTurnInsert,
  TranslateTurnInsert,
} from '../../../domain/ports/chat-message-repo.port';

@Injectable()
export class TypeOrmChatMessageRepository implements ChatMessageRepoPort {
  constructor(
    @InjectRepository(ChatMessage) private readonly repo: Repository<ChatMessage>,
  ) {}

  findByThread(sessionId: string, threadId: string): Promise<ChatMessageRecord[]> {
    return this.repo.find({
      where: { sessionId, threadId },
      order: { seq: 'ASC' },
    });
  }

  findBySessionAndStudent(
    sessionId: string,
    studentId: string,
    threadId?: string,
  ): Promise<ChatMessageRecord[]> {
    const where: { sessionId: string; studentId: string; threadId?: string } = {
      sessionId,
      studentId,
    };
    if (threadId) where.threadId = threadId;
    return this.repo.find({ where, order: { seq: 'ASC' } });
  }

  countDiscussBySessionGroupByStudent(sessionId: string): Promise<ChatMessageCountRow[]> {
    return this.repo
      .createQueryBuilder('m')
      .select('m.studentId', 'studentId')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.sessionId = :sessionId', { sessionId })
      .andWhere('m.role = :role', { role: 'user' })
      .andWhere('m.threadId LIKE :prefix', { prefix: 'discuss-%' })
      .groupBy('m.studentId')
      .getRawMany<ChatMessageCountRow>();
  }

  async countTranslateThreadsBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<number> {
    const row = (await this.repo
      .createQueryBuilder('m')
      .select('COUNT(DISTINCT m.threadId)', 'cnt')
      .where('m.sessionId = :sid AND m.studentId = :stid AND m.threadId LIKE :prefix', {
        sid: sessionId,
        stid: studentId,
        prefix: 'translate:%',
      })
      .getRawOne()) as { cnt: string } | undefined;
    return parseInt(row?.cnt ?? '0', 10);
  }

  async appendContinueChatTurn(insert: ContinueChatTurnInsert): Promise<void> {
    const { sessionId, studentId, threadId, studentContent, aiContent } = insert;
    await this.repo.manager.transaction(async em => {
      const r = em.getRepository(ChatMessage);
      const existingCount = await r.count({ where: { sessionId, studentId, threadId } });
      await r.save([
        r.create({
          sessionId, studentId, threadId,
          role: 'student', content: studentContent,
          seq: existingCount,
        }),
        r.create({
          sessionId, studentId, threadId,
          role: 'ai', content: aiContent,
          seq: existingCount + 1,
        }),
      ]);
    });
  }

  async appendDiscussThread(insert: DiscussTurnInsert): Promise<void> {
    const { sessionId, studentId, threadId, messages, aiReply, imageDescription } = insert;
    await this.repo.manager.transaction(async em => {
      const r = em.getRepository(ChatMessage);
      const existingCount = await r.count({ where: { sessionId, studentId, threadId } });
      const fullThread: Array<{ role: 'ai' | 'student'; text: string; images?: string[] }> = [
        ...messages,
        { role: 'ai', text: aiReply },
      ];
      const newMsgs = fullThread.slice(existingCount);
      if (!newMsgs.length) return;
      await r.save(
        newMsgs.map((m, i) =>
          r.create({
            sessionId, studentId, threadId,
            role: m.role, content: m.text,
            images: m.images?.length ? JSON.stringify(m.images) : null,
            imageDescription: m.images?.length ? (imageDescription ?? null) : null,
            seq: existingCount + i,
          }),
        ),
      );
    });
  }

  async appendTranslateTurn(insert: TranslateTurnInsert): Promise<void> {
    const { sessionId, studentId, threadId, question, reply } = insert;
    await this.repo.manager.transaction(async em => {
      const r = em.getRepository(ChatMessage);
      const maxResult = (await r
        .createQueryBuilder('m')
        .select('MAX(m.seq)', 'max')
        .where('m.sessionId = :sid AND m.studentId = :stid AND m.threadId = :tid', {
          sid: sessionId, stid: studentId, tid: threadId,
        })
        .getRawOne()) as { max: number | null } | undefined;
      const nextSeq = (maxResult?.max ?? -1) + 1;
      await r.save(r.create({
        sessionId, studentId, threadId,
        role: 'student', content: question,
        seq: nextSeq,
      }));
      await r.save(r.create({
        sessionId, studentId, threadId,
        role: 'ai', content: reply,
        seq: nextSeq + 1,
      }));
    });
  }
}
