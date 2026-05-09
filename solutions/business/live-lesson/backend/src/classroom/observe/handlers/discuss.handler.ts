import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObserveType } from '../observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../observe-handler.interface';
import type { DiscussObserveData } from '../../../schemas/classroom/observe-data';
import { ChatMessage } from '../../../entities/chat-message.entity';

@Injectable()
@ObserveType('discuss')
export class DiscussObserveHandler implements ObserveHandler {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
  ) {}

  async compute(ctx: ObserveContext): Promise<DiscussObserveData> {
    if (ctx.answerKey && ctx.answerKey.type !== 'quiz') {
      throw new Error(`DiscussObserveHandler expects quiz answerKey, got ${ctx.answerKey.type}`);
    }
    const totalStudents = ctx.students.length;

    const threadId = `discuss:${ctx.stepIdx}`;
    const messages = await this.chatMessageRepo.find({
      where: { sessionId: ctx.sessionId, threadId },
      order: { seq: 'ASC' },
    });

    const msgsByStudent = new Map<string, typeof messages>();
    for (const m of messages) {
      if (!msgsByStudent.has(m.studentId)) msgsByStudent.set(m.studentId, []);
      msgsByStudent.get(m.studentId)!.push(m);
    }

    let discussedCount = 0;
    let goalReachedCount = 0;
    let totalRounds = 0;
    let totalTime = 0;
    let timeCount = 0;

    const studentResults: DiscussObserveData['students'] = [];

    for (const student of ctx.students) {
      const msgs = msgsByStudent.get(student.id);
      if (!msgs || msgs.length === 0) continue;

      discussedCount++;
      const studentMsgs = msgs.filter(m => m.role === 'student' || m.role === 'user');
      const rounds = studentMsgs.length;
      totalRounds += rounds;

      const lastMsg = msgs[msgs.length - 1];
      let goalReached = false;
      let completionType: DiscussObserveData['students'][0]['completionType'] = '';
      const method: 'socratic' | 'fallback' = 'socratic';

      if (lastMsg.content?.includes('goal_reached')) {
        goalReached = true;
        completionType = 'goal_reached';
      } else if (lastMsg.content?.includes('fallback')) {
        completionType = 'fallback_rounds';
      }

      if (goalReached) goalReachedCount++;

      const first = msgs[0].createdAt instanceof Date ? msgs[0].createdAt.getTime() : new Date(msgs[0].createdAt).getTime();
      const last = lastMsg.createdAt instanceof Date ? lastMsg.createdAt.getTime() : new Date(lastMsg.createdAt).getTime();
      const timeUsed = (last - first) / 1000;
      if (timeUsed > 0) { totalTime += timeUsed; timeCount++; }

      const conversation = msgs.map(m => ({
        role: (m.role === 'student' || m.role === 'user' ? 'student' : 'ai') as 'ai' | 'student',
        text: m.content,
      }));

      const insights: string[] = [];
      if (goalReached) insights.push('达成讨论目标');
      if (rounds <= 2) insights.push('对话轮次较少');

      studentResults.push({
        id: student.id,
        name: student.name,
        method,
        goalReached,
        roundsUsed: rounds,
        timeUsedSeconds: timeUsed,
        completionType,
        conversation,
        keyInsights: insights,
      });
    }

    return {
      stats: {
        totalStudents,
        discussedCount,
        goalReachedCount,
        avgRounds: discussedCount > 0 ? totalRounds / discussedCount : 0,
        avgTime: timeCount > 0 ? totalTime / timeCount : 0,
      },
      students: studentResults,
    };
  }
}
